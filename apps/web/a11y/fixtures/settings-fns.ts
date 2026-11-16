import { Effect } from 'effect';
import type { SaveRotationSettingsInput } from '#/features/settings/schemas/settings-input.ts';
import { defaultSettings, type Settings } from '#/shared/data/settings.ts';
import type { Location } from '#/shared/weather/location.ts';
export let settings: Settings = {
  ...defaultSettings,
  location: {
    name: 'Berlin',
    region: '',
    country: 'Germany',
    latitude: 52.52,
    longitude: 13.41,
    timezone: 'Europe/Berlin',
  },
};
export const saveRotationSettingsFn = ({
  data,
}: {
  readonly data: SaveRotationSettingsInput;
}) =>
  Effect.runPromise(
    Effect.sync(() => {
      settings = { ...settings, ...data, revision: data.revision + 1 };
      return settings;
    }),
  );
export const saveLocationFn = ({
  data,
}: {
  readonly data: { readonly location: Location };
}) =>
  Effect.runPromise(
    Effect.sync(() => {
      settings = { ...settings, location: data.location };
      return settings;
    }),
  );
export const searchLocationsFn = () => Effect.runPromise(Effect.succeed([]));
