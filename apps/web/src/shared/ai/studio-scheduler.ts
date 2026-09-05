import { Clock, Duration, Effect, Random } from 'effect';
import { StudioRateLimit, StudioRenderError } from './errors/ai-errors.ts';
import type { StudioProgress } from './studio-progress.ts';

const maxRetries = 3;
const baseDelayMs = 2000;
const maxDelayMs = 30_000;
const millisecondsPerSecond = 1000;

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
    return milliseconds;
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
    return seconds * millisecondsPerSecond;
  }
  if (Number.isFinite(seconds) && seconds < 0) {
    return undefined;
  }
  const date =
    error.retryAfterSeconds === null
      ? Number.NaN
      : Date.parse(error.retryAfterSeconds);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
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
        if (!(error instanceof StudioRateLimit)) {
          return yield* Effect.fail(error);
        }
        const failedAt = yield* Clock.currentTimeMillis;
        const jitter = yield* Random.next;
        const delay = delayFor(error, failedAt, retries, jitter);
        cooldownUntil = Math.max(cooldownUntil, failedAt + delay);
        yield* Effect.logWarning('Studio image request rate limited.', {
          retries,
          retryAt: cooldownUntil,
          cause: error.cause,
        });
        if (retries >= maxRetries) {
          return yield* Effect.fail(
            new StudioRenderError({ message: error.message, cause: error }),
          );
        }
        retries += 1;
      }
    }).pipe(permit.withPermits(1));
  return { schedule };
});
