import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';
import { outfitOn } from '../rotation.ts';
import {
  decodeAlternativesInput,
  decodeBackfillInput,
  decodeLogOutfitInput,
  decodeOccasionInput,
  decodeProposalId,
  decodeRerollInput,
} from '../schemas/today-input.ts';
import type { TodayView } from '../schemas/today-view.ts';
import { ProposalService } from './proposal-service.ts';
import { rotaRuntime } from './rota-runtime.ts';
import type { AlternativesView } from './today-actions.ts';
import { TodayService } from './today-service.ts';

// Functions, not module-level Effects: the browser imports this module for its
// RPC stubs, and a top-level Effect would drag the server runtime along.
const todayView = () =>
  Effect.gen(function* () {
    const clock = yield* readWardrobeClock();
    const today = yield* TodayService;
    return yield* today.view(clock);
  });

export const todayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler((): Promise<TodayView> => rotaRuntime.run(todayView()));

/** Waits for the day's proposal; the page calls it once it is on screen. */
export const decideTodayFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .handler(
    (): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          const today = yield* TodayService;
          return yield* today.decide(clock);
        }),
      ),
  );

export const confirmProposalFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeProposalId(input))
  .handler(
    ({ data }): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const proposals = yield* ProposalService;
          yield* proposals.confirm(data.id);
          return yield* todayView();
        }),
      ),
  );

export const rerollProposalFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeRerollInput(input))
  .handler(
    ({ data }): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          const proposals = yield* ProposalService;
          const today = yield* TodayService;
          yield* proposals.reroll(clock, data.id, data.scope);
          return yield* today.view(clock);
        }),
      ),
  );

/**
 * A note changes the question, so a pending proposal is remade with it. A
 * decided day only keeps the note.
 */
export const saveOccasionFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeOccasionInput(input))
  .handler(
    ({ data }): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          const notes = yield* DayNoteRepository;
          const proposals = yield* ProposalRepository;
          const today = yield* TodayService;
          yield* notes.save(clock.today, data.occasion);
          const latest = yield* proposals.latestForDate(clock.today);
          if (latest?.status === 'pending') {
            yield* proposals.setStatus(latest.id, 'superseded');
            return yield* today.decide(clock);
          }
          return yield* today.view(clock);
        }),
      ),
  );

export const logOutfitFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeLogOutfitInput(input))
  .handler(
    ({ data }): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          if (data.date > clock.today) {
            return yield* new ProposalStateError(
              'Tomorrow has not happened yet.',
            );
          }
          const proposals = yield* ProposalService;
          yield* proposals.logOutfit(data.date, data.entries, data.source);
          return yield* todayView();
        }),
      ),
  );

/** "Same as the day before": the last logged outfit is copied onto an unlogged day. */
export const backfillFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeBackfillInput(input))
  .handler(
    ({ data }): Promise<TodayView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          if (data.date >= clock.today) {
            return yield* new ProposalStateError(
              'Only a past day can be filled in from the day before it.',
            );
          }
          const wearLog = yield* WearLogRepository;
          const proposals = yield* ProposalService;
          const source = yield* wearLog.readDay(data.copyFrom);
          const outfit = outfitOn(source, data.copyFrom);
          const entries = Object.entries(outfit).flatMap(([slot, garmentId]) =>
            garmentId === undefined
              ? []
              : [{ slot: slot as keyof typeof outfit, garmentId }],
          );
          if (entries.length === 0) {
            return yield* new ProposalStateError(
              'There is nothing logged on that day to copy.',
            );
          }
          yield* proposals.logOutfit(data.date, entries, 'backfill');
          return yield* todayView();
        }),
      ),
  );

export const alternativesFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeAlternativesInput(input))
  .handler(
    ({ data }): Promise<AlternativesView> =>
      rotaRuntime.run(
        Effect.gen(function* () {
          const clock = yield* readWardrobeClock();
          const today = yield* TodayService;
          return yield* today.alternatives(clock, data.slot, data.currentIds);
        }),
      ),
  );
