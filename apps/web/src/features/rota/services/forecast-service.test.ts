import { describe, expect, it, mock } from 'bun:test';
import { Effect, Layer } from 'effect';
import { defaultSettings } from '#/shared/data/settings.ts';
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
  locationLabel: 'Berlin (52.52° N, 13.41° E)',
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
  target = today,
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
  const layer = ForecastService.layer.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(
          WeatherApi,
          WeatherApi.of({
            forecast,
            searchLocations: () => Effect.succeed([]),
          }),
        ),
        Layer.succeed(
          WeatherRepository,
          WeatherRepository.of({
            readRange: () => Effect.sync(() => stored),
            history: () => Effect.sync(() => stored),
            store,
          }),
        ),
      ),
    ),
  );
  const ensureFor = (place: typeof settings) =>
    Effect.gen(function* () {
      const service = yield* ForecastService;
      return yield* service.ensure(place, target, today);
    }).pipe(Effect.provide(layer));
  return { result: ensureFor(settings), ensureFor, forecast, store };
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
    const outcome = await Effect.runPromise(Effect.result(result));
    expect(outcome).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ForecastUnavailableError' },
    });
  });
});

describe('a changed location', () => {
  const madrid = { ...day, locationLabel: 'Madrid' };

  it('fetches a forecast for the new place instead of reusing the old one', async () => {
    const { result, forecast, store } = setup([madrid]);
    const window = await Effect.runPromise(result);
    expect(forecast).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledTimes(1);
    expect(window.today.locationLabel).toBe(day.locationLabel);
    expect(window.stale).toBeFalse();
  });

  it('reports an unavailable forecast rather than the old place’s when fetching fails', async () => {
    const { result } = setup([madrid], Effect.fail(unavailable));
    const outcome = await Effect.runPromise(Effect.result(result));
    expect(outcome).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ForecastUnavailableError' },
    });
  });
});

it('fetches anew for another city with the same name', async () => {
  const paris = {
    name: 'Paris',
    latitude: 48.86,
    longitude: 2.35,
    timezone: 'Europe/Paris',
  };
  const inFrance = {
    ...settings,
    location: { ...paris, region: 'Île-de-France', country: 'France' },
  };
  const inTexas = {
    ...settings,
    location: {
      ...paris,
      region: 'Texas',
      country: 'United States',
      latitude: 33.66,
      longitude: -95.56,
      timezone: 'America/Chicago',
    },
  };
  const neuenkirchen = {
    name: 'Neuenkirchen',
    region: 'Lower Saxony',
    country: 'Germany',
    timezone: 'Europe/Berlin',
  };
  const nearBremen = {
    ...settings,
    location: { ...neuenkirchen, latitude: 53.032_59, longitude: 9.706_42 },
  };
  const nearOsnabrueck = {
    ...settings,
    location: { ...neuenkirchen, latitude: 52.137_78, longitude: 8.388_35 },
  };
  const { ensureFor, forecast } = setup([]);
  await Effect.runPromise(ensureFor(inFrance));
  await Effect.runPromise(ensureFor(inTexas));
  await Effect.runPromise(ensureFor(nearBremen));
  await Effect.runPromise(ensureFor(nearOsnabrueck));
  expect(forecast).toHaveBeenCalledTimes(4);
});

it('treats tomorrow’s forecast as fresh when issued today', async () => {
  const tomorrow = localDate('2026-09-06');
  const { result, forecast } = setup(
    [{ ...day, date: tomorrow }],
    Effect.succeed([]),
    tomorrow,
  );
  const window = await Effect.runPromise(result);
  expect(window.stale).toBeFalse();
  expect(window.today.date).toBe(tomorrow);
  expect(window.today.issuedOn).toBe(today);
  expect(forecast).not.toHaveBeenCalled();
});
