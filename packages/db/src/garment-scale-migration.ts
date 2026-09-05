import { sql } from 'drizzle-orm';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { PgDialect } from 'drizzle-orm/pg-core';

import { garment } from './schema.ts';

// Drizzle Kit generates the constraints; this data conversion runs before them
// in the same journaled transaction. The timestamp identifies 0001_garment_scales.
const garmentScaleMigrationTime = 1_788_625_611_504;
const backfill = new PgDialect().sqlToQuery(sql`
  UPDATE ${garment}
  SET warmth = CASE WHEN warmth <= 2 THEN 1 WHEN warmth = 3 THEN 2 ELSE 3 END,
      formality = CASE WHEN formality <= 2 THEN 1 WHEN formality <= 4 THEN 2 ELSE 3 END
`).sql;

export const withGarmentScaleBackfill = (
  migrations: ReadonlyArray<MigrationMeta>,
): Array<MigrationMeta> =>
  migrations.map((migration) =>
    migration.folderMillis === garmentScaleMigrationTime
      ? { ...migration, sql: [backfill, ...migration.sql] }
      : migration,
  );
