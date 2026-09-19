// biome-ignore-all lint/suspicious/noMisplacedAssertion: This executable database smoke check uses node:assert outside a test-runner callback.
import assert from 'node:assert/strict';
import { pgClientLayer } from '@rota/db/effect-client';
import type { createPool } from '@rota/db/pool';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import { defaultSettings } from '#/shared/data/settings.ts';
import { SettingsRepository } from '#/shared/data/settings-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';

const isolationRuntime = (pool: ReturnType<typeof createPool>, id: string) =>
  ManagedRuntime.make(
    Layer.mergeAll(
      GarmentRepository.Default,
      OutfitRepository.Default,
      SettingsRepository.Default,
    ).pipe(
      Layer.provide(pgClientLayer(pool)),
      Layer.provide(
        Layer.succeed(WardrobeOwner, {
          id,
          userId: id,
          name: 'Demo',
          admin: false,
        }),
      ),
    ),
  );

/** Exercise the new planning writes under two distinct wardrobe identities. */
export const verifyPlanningIsolation = async (
  pool: ReturnType<typeof createPool>,
) => {
  const runtimes = ['planning-first', 'planning-second'].map((id) =>
    isolationRuntime(pool, id),
  );
  const [first, second] = runtimes;
  assert(first && second);
  const date = localDate('2026-09-20');
  const garmentId = crypto.randomUUID();
  const outfit = {
    id: crypto.randomUUID(),
    name: 'First wardrobe outfit',
    entries: [{ garmentId, slot: 'top' as const }],
  };
  const firstPlan = {
    entries: outfit.entries,
    basedOn: outfit.name,
    forecast: null,
  };
  try {
    await pool.query(
      "insert into garment (id, owner_id, name, status) values ($1, 'planning-first', 'Demo shirt', 'active')",
      [garmentId],
    );
    await first.runPromise(
      Effect.gen(function* () {
        const outfits = yield* OutfitRepository;
        yield* outfits.save(outfit);
        yield* outfits.savePlan(date, firstPlan);
        yield* outfits.setCleanTop(date, true);
      }),
    );
    await second.runPromise(
      Effect.gen(function* () {
        const outfits = yield* OutfitRepository;
        assert.deepEqual(yield* outfits.list(), []);
        assert.equal((yield* outfits.plan(date)).entries, null);
        yield* outfits.save({ ...outfit, name: 'Attempted overwrite' });
        yield* outfits.remove(outfit.id);
        yield* outfits.savePlan(date, {
          entries: [],
          basedOn: 'Second wardrobe plan',
          forecast: null,
        });
        yield* outfits.setCleanTop(date, false);
        const garments = yield* GarmentRepository;
        yield* garments.setCare(
          [garmentId],
          'laundry',
          date,
          defaultSettings.laundryDays,
        );
        const settings = yield* SettingsRepository;
        yield* settings.save({ ...defaultSettings, cleanTopAnchor: date });
      }),
    );
    await first.runPromise(
      Effect.gen(function* () {
        const outfits = yield* OutfitRepository;
        assert.deepEqual(yield* outfits.list(), [outfit]);
        assert.deepEqual(yield* outfits.plan(date), {
          ...firstPlan,
          cleanTop: true,
        });
        const garments = yield* GarmentRepository;
        assert.equal((yield* garments.byId(garmentId)).laundryStartedOn, null);
        const settings = yield* SettingsRepository;
        assert.equal((yield* settings.read()).cleanTopAnchor, null);
        yield* garments.setCare(
          [garmentId],
          'laundry',
          date,
          defaultSettings.laundryDays,
        );
      }),
    );
    await second.runPromise(
      Effect.gen(function* () {
        const garments = yield* GarmentRepository;
        yield* garments.setCare(
          [garmentId],
          'washed',
          date,
          defaultSettings.laundryDays,
        );
        yield* garments.setCare(
          [garmentId],
          'postpone',
          date,
          defaultSettings.laundryDays,
        );
        const outfits = yield* OutfitRepository;
        assert.deepEqual((yield* outfits.plan(date)).entries, []);
        assert.equal((yield* outfits.plan(date)).cleanTop, false);
      }),
    );
    await first.runPromise(
      Effect.gen(function* () {
        const garments = yield* GarmentRepository;
        const garment = yield* garments.byId(garmentId);
        assert.equal(garment.laundryStartedOn, date);
        assert.equal(garment.laundryReadyOn, localDate('2026-09-24'));
        assert.equal(garment.washedOn, null);
      }),
    );
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.dispose()));
  }
};
