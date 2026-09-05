import { expect, it } from 'bun:test';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';

import { garment, garmentImage, settings, wearLog } from './schema.ts';

const dialect = new PgDialect();

/** Renders a check predicate the way Postgres receives it, so a test pins what it refuses. */
const renderSql = (value: unknown): string =>
  is(value, SQL)
    ? dialect.sqlToQuery(value).sql.replace(/\s+/gu, ' ').trim()
    : `not sql: ${String(value)}`;

const checks = (table: Parameters<typeof getTableConfig>[0]) =>
  Object.fromEntries(
    getTableConfig(table).checks.map((check) => [
      check.name,
      renderSql(check.value),
    ]),
  );

const uniqueColumns = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table)
    .indexes.filter((index) => index.config.unique)
    .map((index) =>
      index.config.columns.map((column) =>
        'name' in column ? column.name : '?',
      ),
    );

it('a day holds one garment per slot, which is what makes the log an outfit', () => {
  expect(uniqueColumns(wearLog)).toEqual([['worn_on', 'slot']]);
});

it('a garment keeps at most one image of each kind', () => {
  expect(uniqueColumns(garmentImage)).toEqual([['garment_id', 'kind']]);
});

it('warmth and formality stay on the three-step scale the reading uses', () => {
  const rendered = checks(garment);
  expect(rendered.garment_warmth_range).toContain('between 1 and 3');
  expect(rendered.garment_formality_range).toContain('between 1 and 3');
});

it('settings is a single row', () => {
  expect(checks(settings).settings_singleton).toContain("= 'singleton'");
});
