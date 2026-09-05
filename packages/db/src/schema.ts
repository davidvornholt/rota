import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The four places a garment can sit on the body, in the order they are worn.
 * `under` is a layer beneath the top (an undershirt); `over` is a layer above
 * it (a jumper, a cardigan, an overshirt). A garment may be eligible for more
 * than one slot: a shirt is a `top` on its own and an `over` above a tee.
 */
export const garmentSlot = pgEnum('garment_slot', [
  'bottom',
  'under',
  'top',
  'over',
]);

/**
 * `processing` while the ingest pipeline is still reading the photo and
 * rendering the studio image; `review` once it is ready for the one-tap
 * accept; `active` once accepted; `retired` when it has left the wardrobe but
 * its history stays.
 */
export const garmentStatus = pgEnum('garment_status', [
  'processing',
  'review',
  'active',
  'retired',
]);

export const garmentImageKind = pgEnum('garment_image_kind', [
  'original',
  'studio',
]);

/** Which image the wardrobe shows for a garment. */
export const garmentImageChoice = pgEnum('garment_image_choice', [
  'studio',
  'original',
]);

/**
 * How a wear-log row came to be. `proposed` is the one-tap confirmation of the
 * day's proposal; `override` a swap made before confirming; `backfill` an
 * unlogged day filled in later; `edited` a correction to a past day.
 */
export const wearSource = pgEnum('wear_source', [
  'proposed',
  'override',
  'backfill',
  'edited',
]);

export const proposalStatus = pgEnum('proposal_status', [
  'pending',
  'confirmed',
  'rejected',
  'superseded',
]);

/**
 * One garment. The decision-relevant attributes (slots, warmth, rain, formality,
 * colours, wear budget) are what the rotation engine filters and ranks on; the
 * rest is what the wardrobe shows. `extraction` keeps the model's raw answer so
 * a later re-read can be compared with what was accepted.
 *
 * `wear_budget` is the per-garment override of the category default in
 * settings; null means "use the category default".
 */
const pricePrecision = 10;
const priceScale = 2;
/** Where an unread garment sits on the three-step warmth and formality scales. */
const scaleMiddle = 2;
/** A garment rests a week before the engine offers it again, unless settings say otherwise. */
const defaultCooldownDays = 7;
/** The morning hour the day is decided at, unless settings say otherwise. */
const defaultProposalHour = 5;

export const garment = pgTable(
  'garment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: garmentStatus('status').notNull().default('processing'),
    name: text('name').notNull().default(''),
    category: text('category').notNull().default(''),
    subcategory: text('subcategory').notNull().default(''),
    slots: garmentSlot('slots').array().notNull().default([]),
    warmth: integer('warmth').notNull().default(scaleMiddle),
    rainOk: boolean('rain_ok').notNull().default(true),
    formality: integer('formality').notNull().default(scaleMiddle),
    wearBudget: integer('wear_budget'),
    colors: jsonb('colors').notNull().default([]),
    pattern: text('pattern').notNull().default(''),
    material: text('material').notNull().default(''),
    fit: text('fit').notNull().default(''),
    sleeve: text('sleeve').notNull().default(''),
    brand: text('brand').notNull().default(''),
    seasons: text('seasons').array().notNull().default([]),
    notes: text('notes').notNull().default(''),
    price: numeric('price', { precision: pricePrecision, scale: priceScale }),
    purchasedOn: date('purchased_on'),
    imageChoice: garmentImageChoice('image_choice').notNull().default('studio'),
    extraction: jsonb('extraction'),
    processingError: text('processing_error'),
    /** The render currently allowed to write the studio image, if any. */
    studioRenderId: uuid('studio_render_id'),
    /** The render whose studio image was most recently attached, if any. */
    studioRenderCompletedId: uuid('studio_render_completed_id'),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('garment_warmth_range', sql`${table.warmth} between 1 and 3`),
    check('garment_formality_range', sql`${table.formality} between 1 and 3`),
    check(
      'garment_wear_budget_positive',
      sql`${table.wearBudget} is null or ${table.wearBudget} between 1 and 30`,
    ),
    index('garment_status_idx').on(table.status),
  ],
);

/**
 * The stored files behind a garment: the phone photo as uploaded and the
 * studio render. `storage_key` is the content hash the media store keyed the
 * bytes under, so a key names exactly one immutable image forever.
 */
export const garmentImage = pgTable(
  'garment_image',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    garmentId: uuid('garment_id')
      .notNull()
      .references(() => garment.id, { onDelete: 'cascade' }),
    kind: garmentImageKind('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    mime: text('mime').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('garment_image_garment_kind_unique').on(
      table.garmentId,
      table.kind,
    ),
  ],
);

/**
 * The only truth about what was worn. One row per garment per day; a day has
 * at most one garment per slot. Consecutive-wear counts, cooldowns, and every
 * statistic derive from this table and nothing stores them separately.
 */
export const wearLog = pgTable(
  'wear_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wornOn: date('worn_on').notNull(),
    garmentId: uuid('garment_id')
      .notNull()
      .references(() => garment.id, { onDelete: 'restrict' }),
    slot: garmentSlot('slot').notNull(),
    source: wearSource('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('wear_log_day_slot_unique').on(table.wornOn, table.slot),
    index('wear_log_garment_idx').on(table.garmentId, table.wornOn),
  ],
);

/**
 * What the model proposed for a day and what became of it. `payload` is the
 * full outfit with the per-item reasoning; `status` moves from `pending` to
 * `confirmed`, or to `rejected` when another suggestion was asked for, or to
 * `superseded` when a newer proposal for the same day replaced it.
 */
export const proposal = pgTable(
  'proposal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    forDate: date('for_date').notNull(),
    status: proposalStatus('status').notNull().default('pending'),
    payload: jsonb('payload').notNull(),
    reason: text('reason').notNull().default(''),
    model: text('model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [
    index('proposal_for_date_idx').on(table.forDate, table.createdAt),
  ],
);

/** The free-text occasion note for a day, when there is one. */
export const dayNote = pgTable('day_note', {
  forDate: date('for_date').primaryKey(),
  occasion: text('occasion').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The forecast a day was decided on. One row per calendar day, replaced when a
 * fresher forecast arrives. `issued_on` is the day the forecast was fetched, so
 * a proposal made on yesterday's forecast can say so.
 */
export const weatherDay = pgTable('weather_day', {
  forDate: date('for_date').primaryKey(),
  issuedOn: date('issued_on').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  locationLabel: text('location_label').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  precipitationProbability: integer('precipitation_probability').notNull(),
  precipitationMm: real('precipitation_mm').notNull(),
  windKmh: real('wind_kmh').notNull(),
  weatherCode: integer('weather_code').notNull(),
});

/**
 * The single settings row. `location` is null until the first-run setup picks
 * one; nothing weather-related runs before then.
 */
export const settings = pgTable(
  'settings',
  {
    id: text('id').primaryKey().default('singleton'),
    location: jsonb('location'),
    cooldownDays: integer('cooldown_days')
      .notNull()
      .default(defaultCooldownDays),
    categoryBudgets: jsonb('category_budgets').notNull().default({}),
    proposalHour: integer('proposal_hour')
      .notNull()
      .default(defaultProposalHour),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('settings_singleton', sql`${table.id} = 'singleton'`),
    check(
      'settings_cooldown_range',
      sql`${table.cooldownDays} between 0 and 60`,
    ),
    check(
      'settings_proposal_hour_range',
      sql`${table.proposalHour} between 0 and 23`,
    ),
  ],
);
