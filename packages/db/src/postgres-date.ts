import pg from 'pg';

const postgresDateOid = 1082;

/**
 * DATE values are calendar dates and must never pass through a timezone: pg's
 * stock parser turns '2026-08-23' into a Date at local midnight, which shifts
 * the day for anyone east or west of the server.
 *
 * This guard only covers raw `pool.query` reads. Drizzle never relies on it,
 * because its node-postgres session attaches a per-query `types.getTypeParser`
 * that already returns DATE, TIMESTAMP, and TIMESTAMPTZ as text, and a
 * per-query parser wins over the global one. The app reads exclusively through
 * Drizzle today, so nothing currently depends on this; it stays so the first
 * raw query added later is correct by default rather than subtly off by a day.
 */
export const preservePostgresDates = (): void => {
  pg.types.setTypeParser(postgresDateOid, (value) => value);
};
