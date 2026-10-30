/**
 * When the scheduler may try a day's proposal again after it failed. Every
 * scheduled attempt can be a paid model call, so the wait doubles after each
 * failure and a day allows only a few attempts. Only the scheduler is held
 * back: a suggestion the wearer asks for always runs.
 */

import { Duration } from 'effect';
import type { ScheduledFailures } from '#/shared/data/proposal-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';

/** The wait after the first failure; each further failure doubles it. */
export const firstRetryDelay = Duration.minutes(10);

/** Scheduled attempts per wardrobe and day, the first one included. */
export const scheduledAttemptsPerDay = 5;

/** The wait after `failures` failed attempts. */
export const retryDelay = (failures: number): Duration.Duration =>
  Duration.times(firstRetryDelay, 2 ** (failures - 1));

/**
 * Whether the scheduler may ask the model for `today` at `now`. Failures
 * counted for another day no longer apply, so each day starts fresh.
 */
export const scheduledAttempt = (
  state: ScheduledFailures | undefined,
  today: LocalDate,
  now: Date,
): 'due' | 'waiting' | 'exhausted' => {
  if (state === undefined || state.forDate !== today) {
    return 'due';
  }
  if (state.failures >= scheduledAttemptsPerDay) {
    return 'exhausted';
  }
  const dueAt =
    state.lastFailedAt.getTime() +
    Duration.toMillis(retryDelay(state.failures));
  return now.getTime() >= dueAt ? 'due' : 'waiting';
};

/** The state after one more failed scheduled attempt for `today` at `at`. */
export const afterFailure = (
  state: ScheduledFailures | undefined,
  today: LocalDate,
  at: Date,
): ScheduledFailures => ({
  forDate: today,
  failures: state?.forDate === today ? state.failures + 1 : 1,
  lastFailedAt: at,
});
