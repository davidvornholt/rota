import { pgClientLayer } from '@rota/db/connections';
import { Effect, Option } from 'effect';
import { SqlClient } from 'effect/sql/SqlClient';

/**
 * The host's start-up probe gives each request five seconds, so the check
 * must answer well inside that, whether the database is down or only slow.
 */
export const databaseHealthDeadlineMs = 1500;

type DatabaseUnavailableReason = 'error' | 'timeout';
type DatabaseState = 'available' | DatabaseUnavailableReason;

type InFlightCheck = {
  readonly state: Promise<DatabaseState>;
  reported: boolean;
};

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
    Effect.map(
      Option.match({
        onNone: (): DatabaseState => 'timeout',
        onSome: (): DatabaseState => 'available',
      }),
    ),
    Effect.catchCause(() => Effect.succeed<DatabaseState>('error')),
  );

/**
 * Stops waiting for a check at the deadline. The check's own timeout cannot do
 * that: interrupting a query the database never answers waits for the driver
 * to cancel it, which takes several seconds more, so the answer is bounded here
 * and the check is left to clean up in the background.
 */
// Logs the reason once per check, whichever of the check or its caller sees it first.
const report = (check: InFlightCheck, reason: DatabaseUnavailableReason) => {
  if (!check.reported) {
    check.reported = true;
    Effect.runSync(logUnavailable(reason));
  }
};

const boundedAt = (check: InFlightCheck): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      report(check, 'timeout');
      resolve(false);
    }, databaseHealthDeadlineMs);
    check.state
      .then(
        (state) => resolve(state === 'available'),
        () => resolve(false),
      )
      .finally(() => {
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
  let inFlight: InFlightCheck | undefined;
  return () => {
    if (inFlight === undefined) {
      const check: InFlightCheck = {
        reported: false,
        state: Effect.runPromise(databaseAnswers(databaseUrl))
          .catch((): DatabaseState => 'error')
          .finally(() => {
            inFlight = undefined;
          }),
      };
      check.state.then(
        (state) => {
          if (state !== 'available') {
            report(check, state);
          }
        },
        () => undefined,
      );
      inFlight = check;
    }
    return boundedAt(inFlight);
  };
};
