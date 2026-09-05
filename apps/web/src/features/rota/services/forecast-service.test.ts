import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';
import { defaultSettings } from '#/shared/data/settings-repository.ts';
import {
  type WeatherDay,
  WeatherRepository,
} from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { WeatherError } from '#/shared/weather/errors/weather-errors.ts';
import type { DailyForecast } from '#/shared/weather/hourly-forecast.ts';
import { WeatherApi } from '#/shared/weather/open-meteo.ts';
import { ForecastService } from './forecast-service.ts';

const today = localDate('2026-09-05');
const day: WeatherDay = {
  date: today,
  issuedOn: today,
  locationLabel: 'Berlin',
  startHour: 5,
  endHour: 20,
  high: 20,
  low: 12,
  precipitationProbability: 10,
  precipitationMm: 0,
  windKmh: 12,
  weatherCode: 1,
};
const settings = {
  ...defaultSettings,
  location: {
    name: 'Berlin',
    region: '',
    country: '',
    latitude: 52.52,
    longitude: 13.41,
    timezone: 'Europe/Berlin',
  },
};
const unavailable = new WeatherError({
  message: 'Forecast unavailable.',
  cause: undefined,
});

const setup = (
  initial: ReadonlyArray<WeatherDay>,
  response: Effect.Effect<
    ReadonlyArray<DailyForecast>,
    WeatherError
  > = Effect.succeed([day]),
) => {
  let stored = initial;
  const forecast = mock(() => response);
  const store = mock(
    (
      days: ReadonlyArray<DailyForecast>,
      issuedOn: WeatherDay['issuedOn'],
      locationLabel: string,
    ) =>
      Effect.sync(() => {
        stored = days.map((value) => ({ ...value, issuedOn, locationLabel }));
      }),
  );
  const layer = ForecastService.Default.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(
          WeatherApi,
          WeatherApi.make({
            forecast,
            searchLocations: () => Effect.succeed([]),
          }),
        ),
        Layer.succeed(
          WeatherRepository,
          WeatherRepository.make({
            readRange: () => Effect.sync(() => stored),
            history: () => Effect.sync(() => stored),
            store,
          }),
        ),
      ),
    ),
  );
  const result = Effect.gen(function* () {
    const service = yield* ForecastService;
    return yield* service.ensure(settings, today);
  }).pipe(Effect.provide(layer));
  return { result, forecast, store };
};

describe('forecast cache hours', () => {
  it('refreshes an all-day forecast even when fetched today', async () => {
    const { result, forecast, store } = setup([
      { ...day, startHour: 0, endHour: 24 },
    ]);
    expect((await Effect.runPromise(result)).today).toMatchObject({
      startHour: 5,
      endHour: 20,
    });
    expect(forecast).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('reuses a fresh forecast with matching hours', async () => {
    const { result, forecast } = setup([day]);
    expect((await Effect.runPromise(result)).stale).toBeFalse();
    expect(forecast).not.toHaveBeenCalled();
  });

  it('falls back to an older forecast with matching hours when fetching fails', async () => {
    const { result } = setup(
      [{ ...day, issuedOn: localDate('2026-09-04') }],
      Effect.fail(unavailable),
    );
    expect((await Effect.runPromise(result)).stale).toBeTrue();
  });

  it('does not use an all-day forecast as fallback for a new outfit', async () => {
    const { result } = setup(
      [{ ...day, startHour: 0, endHour: 24 }],
      Effect.fail(unavailable),
    );
    const outcome = await Effect.runPromise(Effect.either(result));
    expect(outcome).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ForecastUnavailableError' },
    });
  });
});
