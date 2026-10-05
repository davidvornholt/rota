import { Effect, Schedule, Schema } from 'effect';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';

export class SuggestionRequestError extends Schema.TaggedError<SuggestionRequestError>()(
  'SuggestionRequestError',
  { message: Schema.String },
) {}

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
    Effect.timeoutOrElse({
      duration: '15 seconds',
      orElse: () => Effect.fail(interrupted()),
    }),
    Effect.retry(
      Schedule.max([Schedule.spaced('2 seconds'), Schedule.recurs(2)]),
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
    Effect.timeoutOrElse({
      duration: '8 minutes',
      orElse: () => Effect.fail(interrupted()),
    }),
  );
