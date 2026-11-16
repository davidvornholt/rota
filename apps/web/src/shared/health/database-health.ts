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
 * exhausted application pool cannot make the app report itself down.
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
        onNone: () => logUnavailable('timeout').pipe(Effect.as(false)),
        onSome: () => Effect.succeed(true),
      }),
    ),
    Effect.catchCause(() => logUnavailable('error').pipe(Effect.as(false))),
  );

/**
 * Concurrent calls share one check, so a flood of requests to the public
 * health route cannot open more than one database connection at a time.
 */
export const makeDatabaseCheck = (
  databaseUrl: string,
): (() => Promise<boolean>) => {
  let inFlight: Promise<boolean> | undefined;
  return () => {
    inFlight ??= Effect.runPromise(databaseAnswers(databaseUrl)).finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
};
