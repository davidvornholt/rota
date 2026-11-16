import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createPool, pgClientLayer } from '@rota/db/connections';
import { env } from 'bun';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { createDisposableDatabase } from './disposable-database.ts';
import { SettingsRepository } from './settings-repository.ts';

const setupTimeoutMs = 60_000;
const adminDatabaseUrl = env.DATABASE_URL?.trim() ?? '';
const savedHour = 9;
const savedLaundryDays = 6;
const hamburg = {
  name: 'Hamburg',
  region: '',
  country: 'Germany',
  latitude: 53.55,
  longitude: 10,
  timezone: 'Europe/Berlin',
};
const berlin = {
  ...hamburg,
  name: 'Berlin',
  latitude: 52.52,
  longitude: 13.41,
};

const owner = {
  id: `stale-${crypto.randomUUID()}`,
  userId: 'synthetic-user',
  name: 'Synthetic',
  admin: false,
};

// Two tabs open the settings and each rotation form sends every field, so
// the form that was loaded first must not reset what the other tab saved.
describe.skipIf(adminDatabaseUrl === '')(
  'saving the rotation settings from a form that may be out of date',
  () => {
    let database:
      | Awaited<ReturnType<typeof createDisposableDatabase>>
      | undefined;
    let pool: ReturnType<typeof createPool> | undefined;
    let runtime:
      | ManagedRuntime.ManagedRuntime<SettingsRepository, unknown>
      | undefined;

    beforeAll(async () => {
      database = await createDisposableDatabase(
        adminDatabaseUrl,
        'rota_stale_settings',
      );
      pool = createPool(database.url);
      runtime = ManagedRuntime.make(
        SettingsRepository.layer.pipe(
          Layer.provide(
            Layer.merge(
              pgClientLayer(database.url),
              Layer.succeed(WardrobeOwner, owner),
            ),
          ),
        ),
      );
    }, setupTimeoutMs);

    afterAll(async () => {
      await runtime?.dispose();
      await pool?.end();
      await database?.drop();
    }, setupTimeoutMs);

    const run = <A, E>(
      use: (settings: SettingsRepository['Service']) => Effect.Effect<A, E>,
    ) => {
      if (runtime === undefined) {
        throw new Error('The database is not ready.');
      }
      return runtime.runPromise(Effect.flatMap(SettingsRepository, use));
    };

    it('saves the rotation once for settings that only have a place', async () => {
      await run((settings) => settings.saveLocation(hamburg));
      const loaded = await run((settings) => settings.read());
      expect(loaded.revision).toBe(0);

      await run((settings) =>
        settings.saveRotation({ ...loaded, cooldownDays: 5 }, 0),
      );
      const refused = await run((settings) =>
        Effect.flip(settings.saveRotation({ ...loaded, cooldownDays: 7 }, 0)),
      );

      expect(refused._tag).toBe('StaleEditError');
      const stored = await run((settings) => settings.read());
      expect(stored).toMatchObject({
        location: hamburg,
        cooldownDays: 5,
        revision: 1,
      });
    });

    it('keeps the proposal hour another tab saved by refusing the older form', async () => {
      const loaded = await run((settings) => settings.read());
      await run((settings) =>
        settings.saveRotation(
          { ...loaded, proposalHour: savedHour },
          loaded.revision,
        ),
      );

      const refused = await run((settings) =>
        Effect.flip(
          settings.saveRotation(
            { ...loaded, laundryDays: savedLaundryDays },
            loaded.revision,
          ),
        ),
      );

      expect(refused._tag).toBe('StaleEditError');
      const stored = await run((settings) => settings.read());
      expect(stored).toMatchObject({
        proposalHour: savedHour,
        laundryDays: loaded.laundryDays,
      });
    });

    it('saves a form that was reloaded after the other tab saved', async () => {
      const reloaded = await run((settings) => settings.read());

      await run((settings) =>
        settings.saveRotation(
          { ...reloaded, laundryDays: savedLaundryDays },
          reloaded.revision,
        ),
      );

      const stored = await run((settings) => settings.read());
      expect(stored).toMatchObject({
        proposalHour: savedHour,
        laundryDays: savedLaundryDays,
        revision: reloaded.revision + 1,
      });
    });

    it('keeps the rotation fields when only the place is saved', async () => {
      const before = await run((settings) => settings.read());

      await run((settings) => settings.saveLocation(berlin));

      const stored = await run((settings) => settings.read());
      expect(stored).toMatchObject({ ...before, location: berlin });
    });
  },
);
