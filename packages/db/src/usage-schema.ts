import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** Each provider attempt, including failures with an unknown billing outcome. */
export const apiUsage = pgTable('api_usage', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  operation: text('operation').notNull(),
  status: text('status').notNull().default('pending'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  usage: jsonb('usage'),
  priceSnapshot: jsonb('price_snapshot'),
  estimatedUsd: numeric('estimated_usd', { precision: 18, scale: 8 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Rates are entered by the owner from their provider contract; missing means unknown, never free. */
export const apiPrice = pgTable('api_price', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputPerMillion: numeric('input_per_million', {
    precision: 14,
    scale: 6,
  }).notNull(),
  outputPerMillion: numeric('output_per_million', {
    precision: 14,
    scale: 6,
  }).notNull(),
  imageInputPerMillion: numeric('image_input_per_million', {
    precision: 14,
    scale: 6,
  }).notNull(),
  imageOutputPerMillion: numeric('image_output_per_million', {
    precision: 14,
    scale: 6,
  }).notNull(),
  cachedInputPerMillion: numeric('cached_input_per_million', {
    precision: 14,
    scale: 6,
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
