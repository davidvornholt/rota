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
