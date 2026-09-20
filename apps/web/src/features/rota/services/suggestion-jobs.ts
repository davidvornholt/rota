import { Cause, Duration, Effect, Exit, Option } from 'effect';
import type { LocalDate } from '#/shared/time/local-date.ts';
import {
  ProposalGenerationError,
  ProposalStateError,
} from '../errors/rota-errors.ts';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';

const retentionMs = Duration.toMillis('1 hour');
const retainedJobs = 16;
const failureMessage = (cause: Cause.Cause<unknown>) => {
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure)) {
    const error = failure.value;
    if (
      typeof error === 'object' &&
      error !== null &&
      'httpStatus' in error &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }
  }
  return 'Rota could not finish this suggestion. Your previous selection is unchanged. Please try again.';
};

/** One instance per wardrobe runtime, independent of the initiating HTTP request. */
export const makeSuggestionJobs = () => {
  const jobs = new Map<string, SuggestionJob>();
  const prune = (now: number) => {
    for (const [id, job] of jobs) {
      if (job.status !== 'running' && now - job.startedAt > retentionMs) {
        jobs.delete(id);
      }
    }
    for (const [id, job] of jobs) {
      if (jobs.size <= retainedJobs) {
        break;
      }
      if (job.status !== 'running' || id !== job.id) {
        jobs.delete(id);
      }
    }
  };
  const finish = (job: SuggestionJob, exit: Exit.Exit<unknown, unknown>) =>
    Effect.gen(function* () {
      const endedAt = yield* Effect.clockWith(
        (clock) => clock.currentTimeMillis,
      );
      const status = Exit.isSuccess(exit) ? 'succeeded' : 'failed';
      const finished: SuggestionJob = {
        ...job,
        status,
        message: Exit.isFailure(exit) ? failureMessage(exit.cause) : null,
      };
      for (const [requestId, candidate] of jobs) {
        if (candidate.id === job.id) {
          jobs.set(requestId, finished);
        }
      }
      yield* Effect.logInfo('Outfit suggestion finished').pipe(
        Effect.annotateLogs({
          jobId: job.id,
          date: job.date,
          status,
          durationMs: endedAt - job.startedAt,
        }),
      );
    });
  const start = <A, E, R>(
    date: LocalDate,
    id: string,
    work: Effect.Effect<A, E, R>,
  ) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        prune(now);
        const existing = jobs.get(id);
        if (existing !== undefined) {
          if (existing.date !== date) {
            return yield* new ProposalStateError(
              'This suggestion request belongs to another date. Please try again.',
            );
          }
          return existing;
        }
        const active = [...jobs.values()].find(
          (candidate) =>
            candidate.date === date && candidate.status === 'running',
        );
        if (active !== undefined) {
          jobs.set(id, active);
          prune(now);
          return active;
        }
        const job: SuggestionJob = {
          id,
          date,
          status: 'running',
          startedAt: now,
          message: null,
        };
        jobs.set(id, job);
        prune(now);
        yield* work.pipe(
          Effect.timeoutFail({
            duration: '360 seconds',
            onTimeout: () => new ProposalGenerationError(true, undefined),
          }),
          restore,
          Effect.onExit((exit) => finish(job, exit)),
          Effect.catchAllCause(() => Effect.void),
          Effect.forkDaemon,
        );
        return job;
      }),
    );
  const status = (date: LocalDate, id: string | null) =>
    Effect.gen(function* () {
      const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
      prune(now);
      if (id !== null) {
        const job = jobs.get(id);
        return job?.date === date
          ? job
          : {
              id,
              date,
              status: 'lost' as const,
              startedAt: now,
              message:
                'This suggestion is no longer running. Refresh to check your saved selection, then try again.',
            };
      }
      return (
        [...jobs.values()]
          .reverse()
          .find((job) => job.date === date && job.status === 'running') ?? null
      );
    });
  return { start, status };
};

export class SuggestionJobs extends Effect.Service<SuggestionJobs>()(
  'SuggestionJobs',
  { sync: makeSuggestionJobs },
) {}
