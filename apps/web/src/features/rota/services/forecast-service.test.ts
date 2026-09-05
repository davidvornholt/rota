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

describe('forecast cache', () => {
  it('fetches and stores a forecast when the cache is empty', async () => {
    const { result, forecast, store } = setup([]);
    expect((await Effect.runPromise(result)).today).toEqual(day);
    expect(forecast).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('reuses a fresh forecast', async () => {
    const { result, forecast } = setup([day]);
    expect((await Effect.runPromise(result)).stale).toBeFalse();
    expect(forecast).not.toHaveBeenCalled();
  });

  it('falls back to an older forecast when fetching fails', async () => {
    const { result } = setup(
      [{ ...day, issuedOn: localDate('2026-09-04') }],
      Effect.fail(unavailable),
    );
    expect((await Effect.runPromise(result)).stale).toBeTrue();
  });

  it('reports an unavailable forecast when fetching fails with an empty cache', async () => {
    const { result } = setup([], Effect.fail(unavailable));
    const outcome = await Effect.runPromise(Effect.either(result));
    expect(outcome).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ForecastUnavailableError' },
    });
  });
});
