// biome-ignore-all lint/suspicious/noMisplacedAssertion: This executable database smoke check runs directly with Bun and uses node:assert, not a test-runner callback.
import assert from 'node:assert/strict';
import { SqlClient } from '@effect/sql';
import { pgClientLayer } from '@rota/db/effect-client';
import { migrateDatabase } from '@rota/db/migrate';
import { createPool } from '@rota/db/pool';
import { Effect, Layer, Schema } from 'effect';
import { ForecastService } from '#/features/rota/services/forecast-service.ts';
import {
  changePlanning,
  planningView,
} from '#/features/rota/services/planning-service.ts';
import { ProposalService } from '#/features/rota/services/proposal-service.ts';
import { TodayService } from '#/features/rota/services/today-service.ts';
import { GeminiError } from '#/shared/ai/errors/ai-errors.ts';
import { Gemini } from '#/shared/ai/gemini.ts';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import { defaultSettings } from '#/shared/data/settings.ts';
import { SettingsRepository } from '#/shared/data/settings-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { addDays, localDate } from '#/shared/time/local-date.ts';
import { verifyCare, verifyDailyDrafts } from './verify-daily-drafts.ts';
import { verifyDirectLaundry } from './verify-direct-laundry.ts';
import { verifyPlanningIsolation } from './verify-planning-isolation.ts';
import { verifySuggestionRollback } from './verify-suggestion-rollback.ts';

const owner = {
  id: 'planning-demo',
  userId: 'planning-demo',
  name: 'Demo',
  admin: false,
};
const today = localDate('2026-09-19');
const tomorrow = localDate('2026-09-20');
const clock = {
  settings: defaultSettings,
  timeZone: 'Europe/Berlin',
  today,
  actualToday: today,
  hour: 8,
};
const nextClock = { ...clock, today: tomorrow };
const topId = '11111111-1111-4111-8111-111111111111';
const bottomId = '22222222-2222-4222-8222-222222222222';
const otherTopId = '33333333-3333-4333-8333-333333333333';
const outfitId = '44444444-4444-4444-8444-444444444444';
const entries = [
  { garmentId: topId, slot: 'top' as const },
  { garmentId: bottomId, slot: 'bottom' as const },
];
let failGeneration = false;
const hotterDay = 30;
let weatherHigh = 20;
let sawSavedOutfit = false;
const forecastLayer = Layer.succeed(
  ForecastService,
  ForecastService.make({
    refresh: () => Effect.succeed(undefined),
    ensure: (_settings, date, issuedOn) =>
      Effect.succeed({
        today: {
          date,
          issuedOn,
          locationLabel: 'Demo',
          high: weatherHigh,
          low: 10,
          precipitationProbability: 10,
          precipitationMm: 0,
          windKmh: 5,
          weatherCode: 0,
        },
        tomorrow: undefined,
        yesterday: undefined,
        upcoming: [],
        stale: false,
      }),
  }),
);
const geminiLayer = Layer.succeed(
  Gemini,
  Gemini.make({
    model: 'deterministic-test-model',
    generateJson: (input) => {
      if (failGeneration) {
        return Effect.fail(
          new GeminiError({
            message: 'Test failure.',
            reason: 'timeout',
            cause: undefined,
          }),
        );
      }
      sawSavedOutfit = input.parts.some(
        (part) => 'text' in part && part.text.includes('Blue and navy'),
      );
      const schema = input.jsonSchema as {
        properties: {
          outfit: {
            properties: Record<string, { enum: ReadonlyArray<string | null> }>;
          };
        };
      };
      const outfit = Object.fromEntries(
        Object.entries(schema.properties.outfit.properties).map(
          ([slot, value]) => [slot, value.enum[0] ?? null],
        ),
      );
      return Schema.decodeUnknown(input.schema)({
        outfit,
        headline: 'A test outfit.',
        reasons: [],
      }).pipe(
        Effect.mapError(
          (cause) =>
            new GeminiError({
              message: 'Bad test answer.',
              reason: 'answer',
              cause,
            }),
        ),
      );
    },
  }),
);
const mediaLayer = Layer.succeed(
  MediaStore,
  MediaStore.make({
    urlFor: (key) => `/demo/${key}`,
    get: () => Effect.succeed(undefined),
    put: () => Effect.succeed({ key: 'demo', bytes: 0 }),
  }),
);

const verifyAutomaticLaundry = Effect.gen(function* () {
  const returnDay = 2 + clock.settings.laundryDays;
  const delayedDay = returnDay + 1;
  const log = yield* WearLogRepository;
  const garments = yield* GarmentRepository;
  const later = (days: number) => ({
    ...clock,
    today: addDays(today, days),
    actualToday: addDays(today, days),
  });
  const viewPiece = (dayClock: typeof clock) =>
    planningView(dayClock).pipe(
      Effect.map((view) =>
        view.wardrobe.find((item) => item.id === otherTopId),
      ),
    );
  yield* garments.setCare(
    [otherTopId],
    'washed',
    today,
    clock.settings.laundryDays,
  );
  yield* log.replaceDay(
    addDays(today, 1),
    [{ garmentId: otherTopId, slot: 'top' }],
    'edited',
  );
  yield* log.replaceDay(
    addDays(today, 2),
    [{ garmentId: otherTopId, slot: 'top' }],
    'edited',
  );
  assert.equal(
    (yield* viewPiece(later(2)))?.inLaundry,
    true,
    'Final wear starts laundry automatically.',
  );
  assert.equal(
    (yield* viewPiece(later(2)))?.readyOn,
    addDays(today, returnDay),
  );
  assert.equal(
    (yield* viewPiece({
      ...later(returnDay - 1),
      today: addDays(today, returnDay),
    }))?.wearsSinceWash,
    0,
    'Tomorrow previews the automatic return.',
  );
  assert.equal(
    (yield* viewPiece(later(returnDay)))?.inLaundry,
    false,
    'Elapsed turnaround makes the piece available.',
  );
  yield* changePlanning(later(returnDay), {
    action: 'care',
    draft: null,
    care: 'postpone',
    ids: [otherTopId],
  });
  assert.equal(
    (yield* viewPiece(later(returnDay)))?.readyOn,
    addDays(today, delayedDay),
    'Still in laundry delays by one day.',
  );
  assert.equal((yield* viewPiece(later(delayedDay)))?.wearsSinceWash, 0);
});

const verify = Effect.gen(function* () {
  const settings = yield* SettingsRepository;
  const shorterLaundry = 3;
  yield* settings.save({ ...defaultSettings, laundryDays: shorterLaundry });
  assert.equal((yield* settings.read()).laundryDays, shorterLaundry);
  yield* settings.save(defaultSettings);
  const sql = yield* SqlClient.SqlClient;
  yield* sql`insert into garment (owner_id, id, status, name, category, slots) values
    (${owner.id}, ${topId}, 'active', 'Blue shirt', 'shirt', array['top']::garment_slot[]),
    (${owner.id}, ${otherTopId}, 'active', 'White shirt', 'shirt', array['top']::garment_slot[]),
    (${owner.id}, ${bottomId}, 'active', 'Navy trousers', 'trousers', array['bottom']::garment_slot[])`;
  const outfits = yield* OutfitRepository;
  const log = yield* WearLogRepository;
  const proposals = yield* ProposalService;
  yield* verifyDailyDrafts(clock, entries);
  yield* changePlanning(clock, {
    action: 'save-outfit',
    id: outfitId,
    name: 'Blue and navy',
    entries,
  });
  yield* changePlanning(nextClock, {
    action: 'note',
    text: 'Meeting tomorrow',
  });
  yield* changePlanning(nextClock, {
    action: 'suggest',
    entries: [entries[0]],
    basedOn: null,
  });
  assert(sawSavedOutfit, 'The model receives saved combinations.');
  const generated = yield* planningView(nextClock);
  assert(
    generated.day.proposal?.items.some(
      (item) => item.garment.id === topId && item.slot === 'top',
    ),
  );
  assert.deepEqual(
    generated.plan.entries,
    generated.day.proposal?.items.map((item) => ({
      garmentId: item.garment.id,
      slot: item.slot,
    })),
    'A new suggestion replaces the older empty draft.',
  );
  assert.equal(generated.plan.basedOn, null);
  failGeneration = true;
  const failed = yield* Effect.either(
    changePlanning(nextClock, {
      action: 'suggest',
      entries: [entries[0]],
      basedOn: null,
    }),
  );
  assert.equal(failed._tag, 'Left');
  assert.equal(
    (yield* planningView(nextClock)).day.proposal?.id,
    generated.day.proposal?.id,
  );
  assert.deepEqual(
    yield* outfits.plan(tomorrow),
    generated.plan,
    'A failed suggestion preserves the saved plan and forecast.',
  );
  failGeneration = false;
  yield* verifySuggestionRollback(nextClock, [entries[0]]);
  yield* changePlanning(nextClock, {
    action: 'plan',
    entries,
    basedOn: 'Blue and navy',
  });
  assert.equal(
    (yield* log.readDay(tomorrow)).length,
    0,
    'Saving tomorrow never logs wear.',
  );
  const premature = yield* Effect.either(
    changePlanning(nextClock, { action: 'wear', entries, basedOn: null }),
  );
  assert.equal(premature._tag, 'Left');
  const swapped = [{ garmentId: otherTopId, slot: 'top' as const }, entries[1]];
  yield* changePlanning(nextClock, {
    action: 'plan',
    entries: swapped,
    basedOn: 'Blue and navy',
  });
  assert.deepEqual(
    (yield* outfits.list())[0]?.entries,
    entries,
    'Changing a plan preserves the saved outfit.',
  );
  weatherHigh = hotterDay;
  const changedForecast = yield* planningView(nextClock);
  assert(
    changedForecast.warnings.some((warning) =>
      warning.includes('forecast has changed'),
    ),
  );
  assert.deepEqual(changedForecast.plan.entries, swapped);
  yield* proposals.ensure(nextClock);
  assert.deepEqual(
    (yield* outfits.plan(tomorrow)).entries,
    swapped,
    'The scheduler preserves a saved plan.',
  );
  yield* verifyCare(clock, entries, otherTopId);
  yield* verifyAutomaticLaundry;
  yield* verifyDirectLaundry(clock, entries);
  yield* changePlanning(clock, { action: 'delete-outfit', id: outfitId });
  assert.equal((yield* outfits.list()).length, 0);
});

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname),
  'This check only creates a disposable database on localhost.',
);
const admin = createPool(databaseUrl.href);
const databaseName = `rota_planning_test_${crypto.randomUUID().replaceAll('-', '')}`;
await admin.query(`create database "${databaseName}"`);
databaseUrl.pathname = `/${databaseName}`;
const pool = createPool(databaseUrl.href);
try {
  await Effect.runPromise(migrateDatabase(pool));
  const repositories = Layer.mergeAll(
    GarmentRepository.Default,
    SettingsRepository.Default,
    OutfitRepository.Default,
    WearLogRepository.Default,
    ProposalRepository.Default,
    DayNoteRepository.Default,
  ).pipe(
    Layer.provideMerge(pgClientLayer(pool)),
    Layer.provide(Layer.succeed(WardrobeOwner, owner)),
  );
  const infrastructure = Layer.mergeAll(
    repositories,
    forecastLayer,
    geminiLayer,
    mediaLayer,
  );
  const services = TodayService.Default.pipe(
    Layer.provideMerge(ProposalService.Default),
    Layer.provideMerge(infrastructure),
  );
  await Effect.runPromise(verify.pipe(Effect.provide(services)));
  await verifyPlanningIsolation(pool);
  await Effect.runPromise(
    Effect.logInfo(
      'Planning integration passed: migrations, suggestions, pinned garments, saved outfits, plans, wear, weather changes and laundry.',
    ),
  );
} finally {
  await pool.end();
  await admin.query(`drop database "${databaseName}" with (force)`);
  await admin.end();
}
