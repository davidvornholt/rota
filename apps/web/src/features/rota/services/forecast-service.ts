/**
 * The forecast the day is decided on. Fetched once per day and stored; when
 * Open-Meteo cannot be reached the stored forecast from an earlier day is used
 * and marked stale, so a network blip never blanks the morning.
 */

import { Effect } from 'effect';

import type { Settings } from '#/shared/data/settings-repository.ts';
import {
  type WeatherDay,
  WeatherRepository,
} from '#/shared/data/weather-repository.ts';
import { addDays, type LocalDate } from '#/shared/time/local-date.ts';
import { locationLabel } from '#/shared/weather/location.ts';
import { WeatherApi } from '#/shared/weather/open-meteo.ts';
import {
  ForecastUnavailableError,
  LocationMissingError,
} from '../errors/rota-errors.ts';

export type ForecastWindow = {
  readonly today: WeatherDay;
  readonly yesterday: WeatherDay | undefined;
  readonly tomorrow: WeatherDay | undefined;
  readonly upcoming: ReadonlyArray<WeatherDay>;
  readonly stale: boolean;
};

const upcomingDays = 3;

export class ForecastService extends Effect.Service<ForecastService>()(
  'rota/ForecastService',
  {
    effect: Effect.gen(function* () {
      const weatherApi = yield* WeatherApi;
      const weather = yield* WeatherRepository;

      const stored = (today: LocalDate) =>
        weather.readRange(addDays(today, -1), addDays(today, upcomingDays));

      const refresh = (settings: Settings, today: LocalDate) =>
        Effect.gen(function* () {
          const { location } = settings;
          if (location === null) {
            return yield* new LocationMissingError();
          }
          const days = yield* weatherApi.forecast(location);
          yield* weather.store(days, today, locationLabel(location));
        });

      const windowOf = (
        days: ReadonlyArray<WeatherDay>,
        today: LocalDate,
      ): ForecastWindow | undefined => {
        const forToday = days.find((day) => day.date === today);
        if (forToday === undefined) {
          return undefined;
        }
        return {
          today: forToday,
          yesterday: days.find((day) => day.date === addDays(today, -1)),
          tomorrow: days.find((day) => day.date === addDays(today, 1)),
          upcoming: days.filter((day) => day.date > today),
          stale: forToday.issuedOn < today,
        };
      };

      /**
       * Today's forecast, fresh if it can be. A fetch is attempted when nothing
       * fresh is stored; a failed fetch falls back to whatever is stored and
       * fails only when there is nothing at all.
       */
      const ensure = (settings: Settings, today: LocalDate) =>
        Effect.gen(function* () {
          const existing = windowOf(yield* stored(today), today);
          if (existing !== undefined && !existing.stale) {
            return existing;
          }
          const refreshed = yield* refresh(settings, today).pipe(
            Effect.map(() => true as const),
            Effect.catchTag('WeatherError', (error) =>
              existing === undefined
                ? Effect.fail(new ForecastUnavailableError(error))
                : Effect.succeed(false as const),
            ),
          );
          if (!refreshed) {
            return existing as ForecastWindow;
          }
          const fresh = windowOf(yield* stored(today), today);
          if (fresh === undefined) {
            return yield* new ForecastUnavailableError(
              'The forecast did not include today.',
            );
          }
          return fresh;
        });

      return { ensure, refresh };
    }),
  },
) {}
