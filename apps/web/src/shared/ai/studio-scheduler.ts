import { Clock, Duration, Effect, Random } from 'effect';
import { StudioRateLimit, StudioRenderError } from './errors/ai-errors.ts';
import type { StudioProgress } from './studio-progress.ts';

const maxRetries = 3;
const baseDelayMs = 2000;
const maxDelayMs = 30_000;
const millisecondsPerSecond = 1000;
/** A provider hint cannot hold the process-wide permit past one job budget. */
const maxCooldownMs = Duration.toMillis(Duration.minutes(10));
const cooldownTimeoutMessage =
  'The studio picture took too long. Try again later.';

const capCooldown = (milliseconds: number): number =>
  Math.min(maxCooldownMs, milliseconds);

export const retryDelay = (
  error: StudioRateLimit,
  now: number,
): number | undefined => {
  const milliseconds =
    error.retryAfter === null ? Number.NaN : Number(error.retryAfter);
  if (
    error.retryAfter?.trim() &&
    Number.isFinite(milliseconds) &&
    milliseconds >= 0
  ) {
    return capCooldown(milliseconds);
  }
  const seconds =
    error.retryAfterSeconds === null
      ? Number.NaN
      : Number(error.retryAfterSeconds);
  if (
    error.retryAfterSeconds?.trim() &&
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return capCooldown(seconds * millisecondsPerSecond);
  }
  if (Number.isFinite(seconds) && seconds < 0) {
    return undefined;
  }
  const date =
    error.retryAfterSeconds === null
      ? Number.NaN
      : Date.parse(error.retryAfterSeconds);
  return Number.isFinite(date)
    ? capCooldown(Math.max(0, date - now))
    : undefined;
};

const delayFor = (
  error: StudioRateLimit,
  now: number,
  retries: number,
  jitter: number,
) =>
  retryDelay(error, now) ??
  Math.min(maxDelayMs, baseDelayMs * 2 ** retries) * (1 + jitter);

export type ReportStudioProgress = (
  progress: StudioProgress,
) => Effect.Effect<void>;

/** One deployment permit also spaces subsequent jobs after an exhausted 429. */
export const makeStudioScheduler = Effect.gen(function* () {
  const permit = yield* Effect.makeSemaphore(1);
  let cooldownUntil = 0;
  const waitForCooldown = (report: ReportStudioProgress) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      if (cooldownUntil > now) {
        yield* report({ status: 'waiting', retryAt: cooldownUntil });
        yield* Effect.sleep(Duration.millis(cooldownUntil - now));
      }
    });
  const handleRateLimit = (
    error: StudioRateLimit,
    retries: number,
    report: ReportStudioProgress,
  ) =>
    Effect.gen(function* () {
      const failedAt = yield* Clock.currentTimeMillis;
      const jitter = yield* Random.next;
      const delay = delayFor(error, failedAt, retries, jitter);
      cooldownUntil = Math.max(cooldownUntil, failedAt + delay);
      yield* Effect.logWarning('Studio image request rate limited.', {
        retries,
        retryAt: cooldownUntil,
        cause: error.cause,
      });
      // A capped provider delay consumes this job's budget, so do not retry at
      // the deadline. The cooldown remains available to the next job.
      if (delay >= maxCooldownMs) {
        yield* report({ status: 'waiting', retryAt: cooldownUntil });
        yield* Effect.sleep(Duration.millis(maxCooldownMs));
        return yield* Effect.fail(
          new StudioRenderError({
            message: cooldownTimeoutMessage,
            cause: error,
          }),
        );
      }
      if (retries >= maxRetries) {
        return yield* Effect.fail(
          new StudioRenderError({ message: error.message, cause: error }),
        );
      }
      return retries + 1;
    });
  const schedule = <A, E>(
    request: Effect.Effect<A, E | StudioRateLimit>,
    report: ReportStudioProgress,
  ) =>
    Effect.gen(function* () {
      let retries = 0;
      while (true) {
        yield* waitForCooldown(report);
        yield* report({ status: 'rendering' });
        const result = yield* Effect.either(request);
        if (result._tag === 'Right') {
          return result.right;
        }
        const error = result.left;
        if (error instanceof StudioRateLimit) {
          retries = yield* handleRateLimit(error, retries, report);
        } else {
          return yield* Effect.fail(error);
        }
      }
    }).pipe(permit.withPermits(1));
  return { schedule };
});
