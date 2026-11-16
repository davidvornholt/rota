import { pgClientLayer } from '@rota/db/connections';
import { Effect, Option } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

/**
 * The host's start-up probe gives each request five seconds, so the check
 * must answer well inside that, whether the database is down or only slow.
 */
export const databaseHealthDeadlineMs = 1500;

type DatabaseUnavailableReason = 'error' | 'timeout';

const logUnavailable = (reason: DatabaseUnavailableReason) =>
  Effect.logWarning(`Health check: database unavailable (${reason})`);

/**
 * A pool of its own for each check keeps no state between checks, so a
 * database that comes back answers the next check without a restart, and an
 * exhausted application pool cannot make the app report itself down. The
 * timeout here only makes sure the check cleans up; callers stop waiting at
 * the same deadline through `boundedAt`.
 */
const databaseAnswers = (databaseUrl: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    yield* sql`select 1`;
  }).pipe(
    Effect.provide(pgClientLayer(databaseUrl)),
    Effect.timeoutOption(databaseHealthDeadlineMs),
    Effect.flatMap(
      Option.match({
        // The caller logs the timeout when it stops waiting.
        onNone: () => Effect.succeed(false),
        onSome: () => Effect.succeed(true),
      }),
    ),
    Effect.catchCause(() => logUnavailable('error').pipe(Effect.as(false))),
  );

/**
 * Stops waiting for a check at the deadline. The check's own timeout cannot do
 * that: interrupting a query the database never answers waits for the driver
 * to cancel it, which takes several seconds more, so the answer is bounded here
 * and the check is left to clean up in the background.
 */
const boundedAt = (
  work: Promise<boolean>,
  onTimeout: () => void,
): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      onTimeout();
      resolve(false);
    }, databaseHealthDeadlineMs);
    work.then(resolve, () => resolve(false)).finally(() => {
      clearTimeout(timer);
    });
  });

/**
 * Concurrent calls share one check, so a flood of requests to the public
 * health route cannot open more than one database connection at a time. The
 * check stays shared until it has cleaned up, even if callers stopped waiting
 * for it, so a database that hangs cannot pile up connections.
 */
export const makeDatabaseCheck = (
  databaseUrl: string,
): (() => Promise<boolean>) => {
  let inFlight: { work: Promise<boolean>; timeoutLogged: boolean } | undefined;
  return () => {
    const check = (inFlight ??= {
      work: Effect.runPromise(databaseAnswers(databaseUrl))
        .catch(() => false)
        .finally(() => {
          inFlight = undefined;
        }),
      timeoutLogged: false,
    });
    return boundedAt(check.work, () => {
      if (!check.timeoutLogged) {
        check.timeoutLogged = true;
        Effect.runSync(logUnavailable('timeout'));
      }
    });
  };
};
