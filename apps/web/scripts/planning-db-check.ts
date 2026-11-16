import { Effect } from 'effect';

// `test:planning-db` runs in the root `check`. CI's quality job provides a
// Postgres service and exports DATABASE_URL, so there a missing DATABASE_URL
// fails the gate instead of passing as a skip. A developer machine runs the
// check only when DATABASE_URL is set, so the local gate needs no database.
const ciOffValues = new Set(['', '0', 'false']);
const inCi = !ciOffValues.has((process.env.CI ?? '').trim().toLowerCase());

if (process.env.DATABASE_URL?.trim()) {
  // Imported only now, because the check's app modules validate the server
  // environment while they load.
  await import('./verify-planning.ts');
} else if (inCi) {
  throw new Error(
    'CI must set DATABASE_URL to run the planning database check. CI never skips it.',
  );
} else {
  await Effect.runPromise(
    Effect.logInfo(
      'Skipped the planning database check because DATABASE_URL is not set. CI always runs it. To run it here, start the database with `just dev-db-start` and run `bun --env-file=.env.local run test:planning-db` in apps/web.',
    ),
  );
}
