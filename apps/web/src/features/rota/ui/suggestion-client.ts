import { Effect } from 'effect';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';
import {
  planningFn,
  startSuggestionFn,
  suggestionStatusFn,
} from '../services/planning-fns.ts';
import { suggestionRequest, waitForSuggestion } from './suggestion-request.ts';

const key = (date: LocalDate) => `rota-suggestion-${date}`;
const remember = (date: LocalDate, id: string | null) => {
  try {
    if (id === null) {
      sessionStorage.removeItem(key(date));
    } else {
      sessionStorage.setItem(key(date), id);
    }
  } catch {
    // Storage can be disabled; the server can still recover an active job by date.
  }
};
const remembered = (date: LocalDate) => {
  try {
    return sessionStorage.getItem(key(date));
  } catch {
    return null;
  }
};
const requestFetch =
  (signal: AbortSignal): typeof serverFunctionFetch =>
  (input, init) =>
    serverFunctionFetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
    });

export const recoverSuggestion = (date: LocalDate, signal: AbortSignal) =>
  Effect.runPromise(
    suggestionRequest((requestSignal) =>
      suggestionStatusFn({
        data: { date, requestId: remembered(date) },
        fetch: requestFetch(requestSignal),
      }),
    ),
    { signal },
  );

export const runSuggestion = (
  date: LocalDate,
  entries: ReadonlyArray<OutfitEntry>,
  resumed: SuggestionJob | undefined,
  lifetimeSignal: AbortSignal,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const requestId = resumed?.id ?? remembered(date) ?? crypto.randomUUID();
      remember(date, requestId);
      const job =
        resumed ??
        (yield* suggestionRequest((signal) =>
          startSuggestionFn({
            data: { date, entries, requestId },
            fetch: requestFetch(signal),
          }),
        ));
      const track = (next: SuggestionJob | null) => {
        if (next?.status === 'failed' || next?.status === 'lost') {
          remember(date, null);
        }
        return next;
      };
      remember(date, job.id);
      track(job);
      yield* waitForSuggestion(job, (signal) =>
        suggestionStatusFn({
          data: { date, requestId: job.id },
          fetch: requestFetch(signal),
        }).then(track),
      );
      const view = yield* suggestionRequest((signal) =>
        planningFn({
          data: { date },
          fetch: requestFetch(signal),
        }),
      );
      remember(date, null);
      return view;
    }),
    { signal: lifetimeSignal },
  );
