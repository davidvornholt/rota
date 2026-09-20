import { Data, Effect, Schedule } from 'effect';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';

export class SuggestionRequestError extends Data.TaggedError(
  'SuggestionRequestError',
)<{
  readonly message: string;
}> {}

const interrupted = () =>
  new SuggestionRequestError({
    message:
      'Cannot check your suggestion right now. Refresh to reconnect; your current outfit is unchanged.',
  });

/** Every HTTP request is short; retrying uses the same job, never another generation. */
export const suggestionRequest = <A>(
  run: (signal: AbortSignal) => Promise<A>,
) =>
  Effect.tryPromise({ try: run, catch: interrupted }).pipe(
    Effect.timeoutFail({ duration: '15 seconds', onTimeout: interrupted }),
    Effect.retry(
      Schedule.spaced('2 seconds').pipe(Schedule.intersect(Schedule.recurs(2))),
    ),
  );

export const waitForSuggestion = (
  initial: SuggestionJob,
  read: (signal: AbortSignal) => Promise<SuggestionJob | null>,
) =>
  Effect.gen(function* () {
    let job = initial;
    while (job.status === 'running') {
      yield* Effect.sleep('2 seconds');
      const next = yield* suggestionRequest(read);
      if (next === null) {
        return yield* interrupted();
      }
      job = next;
    }
    if (job.status !== 'succeeded') {
      return yield* new SuggestionRequestError({
        message:
          job.message ??
          'The suggestion could not finish. Your current outfit is unchanged. Try again.',
      });
    }
    return job;
  }).pipe(
    Effect.timeoutFail({ duration: '8 minutes', onTimeout: interrupted }),
  );
