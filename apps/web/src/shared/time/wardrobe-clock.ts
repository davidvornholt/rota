import { Effect } from 'effect';

import {
  type Settings,
  SettingsRepository,
} from '#/shared/data/settings-repository.ts';
import { hourIn, type LocalDate, todayIn } from './local-date.ts';

/** Until a location is chosen the wardrobe keeps Berlin time; the location's zone takes over from then on. */
export const fallbackTimeZone = 'Europe/Berlin';

export const wardrobeTimeZone = (settings: Settings): string =>
  settings.location?.timezone ?? fallbackTimeZone;

export type WardrobeClock = {
  readonly settings: Settings;
  readonly timeZone: string;
  readonly today: LocalDate;
  readonly hour: number;
};

/** The settings together with what day and hour it is where the wardrobe stands. */
export const readWardrobeClock = (
  now: Date = new Date(),
): Effect.Effect<
  WardrobeClock,
  Effect.Effect.Error<ReturnType<SettingsRepository['read']>>,
  SettingsRepository
> =>
  Effect.map(
    Effect.flatMap(SettingsRepository, (repository) => repository.read()),
    (settings) => {
      const timeZone = wardrobeTimeZone(settings);
      return {
        settings,
        timeZone,
        today: todayIn(timeZone, now),
        hour: hourIn(timeZone, now),
      };
    },
  );
