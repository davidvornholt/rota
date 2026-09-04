import { createServerFn } from '@tanstack/react-start';
import { Effect, Layer } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import {
  type Settings,
  SettingsRepository,
} from '#/shared/data/settings-repository.ts';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import type { Location } from '#/shared/weather/location.ts';
import { WeatherApi } from '#/shared/weather/open-meteo.ts';
import {
  decodeLocationQuery,
  decodeRotationSettingsInput,
  decodeSaveLocationInput,
} from '../schemas/settings-input.ts';

const runtime = featureRuntime('settings', () => Layer.empty);

export const readSettingsFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler(
    (): Promise<Settings> =>
      runtime.run(
        Effect.flatMap(SettingsRepository, (settings) => settings.read()),
      ),
  );

export const searchLocationsFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeLocationQuery(input))
  .handler(
    ({ data }): Promise<ReadonlyArray<Location>> =>
      runtime.run(
        Effect.flatMap(WeatherApi, (weather) =>
          weather.searchLocations(data.query),
        ),
      ),
  );

export const saveLocationFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeSaveLocationInput(input))
  .handler(
    ({ data }): Promise<Settings> =>
      runtime.run(
        Effect.gen(function* () {
          const settings = yield* SettingsRepository;
          const current = yield* settings.read();
          const next = { ...current, location: data.location };
          yield* settings.save(next);
          return next;
        }),
      ),
  );

export const saveRotationSettingsFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeRotationSettingsInput(input))
  .handler(
    ({ data }): Promise<Settings> =>
      runtime.run(
        Effect.gen(function* () {
          const settings = yield* SettingsRepository;
          const current = yield* settings.read();
          const next = { ...current, ...data };
          yield* settings.save(next);
          return next;
        }),
      ),
  );
