import { RotaApi, type SettingsChanges } from '@rota/api/api';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { asMember } from '#/shared/api/member-runtime.ts';
import { SettingsRepository } from '#/shared/data/settings-repository.ts';
import { apiSettings, changedRotation } from '../services/settings-changes.ts';
import { settingsRuntime } from '../services/settings-runtime.ts';

const readSettings = () =>
  Effect.flatMap(SettingsRepository, (settings) =>
    Effect.map(settings.read(), apiSettings),
  );

/**
 * Saves the changes over the settings as they were read. A save from the web
 * app in between makes the write stale, and the client is told to try again.
 */
const updateSettings = (changes: SettingsChanges) =>
  Effect.gen(function* () {
    const settings = yield* SettingsRepository;
    const current = yield* settings.read();
    const rotation = yield* changedRotation(current, changes);
    yield* settings.saveRotation(rotation, current.revision);
    return apiSettings(yield* settings.read());
  });

export const settingsApi = HttpApiBuilder.group(
  RotaApi,
  'settings',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle('get', () =>
          asMember(() => settingsRuntime.run(readSettings())),
        )
        .handle('update', ({ payload }) =>
          asMember(() => settingsRuntime.run(updateSettings(payload))),
        ),
    ),
);
