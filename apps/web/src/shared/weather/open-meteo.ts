/**
 * Open-Meteo: free, keyless, and good enough to decide between a shirt and a
 * jumper. Geocoding turns a typed place name into candidates with a time zone;
 * the forecast is the daily high, low, rain, and wind for the coming week.
 */

import { Duration, Effect, Schedule, Schema } from 'effect';

import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { WeatherError } from './errors/weather-errors.ts';
import type { Location } from './location.ts';

export const LocationSchema: Schema.Schema<Location> = Schema.Struct({
  name: Schema.String,
  region: Schema.String,
  country: Schema.String,
  latitude: Schema.Number,
  longitude: Schema.Number,
  timezone: Schema.String,
});

const GeocodingResponse = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        admin1: Schema.optional(Schema.String),
        country: Schema.optional(Schema.String),
        latitude: Schema.Number,
        longitude: Schema.Number,
        timezone: Schema.String,
      }),
    ),
  ),
});

export const DailyForecastSchema = Schema.Struct({
  date: LocalDateSchema,
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
  precipitationMm: Schema.Number,
  windKmh: Schema.Number,
  weatherCode: Schema.Number,
});

export type DailyForecast = Schema.Schema.Type<typeof DailyForecastSchema>;

const nullableNumber = Schema.NullOr(Schema.Number);

const dailyField = (wireKey: string) =>
  Schema.propertySignature(Schema.Array(nullableNumber)).pipe(
    Schema.fromKey(wireKey),
  );

/** Open-Meteo's daily arrays, one value per day, renamed off the wire. */
const ForecastResponse = Schema.Struct({
  daily: Schema.Struct({
    time: Schema.Array(LocalDateSchema),
    highs: dailyField('temperature_2m_max'),
    lows: dailyField('temperature_2m_min'),
    rainChances: dailyField('precipitation_probability_max'),
    rainSums: dailyField('precipitation_sum'),
    windPeaks: dailyField('wind_speed_10m_max'),
    weatherCodes: dailyField('weather_code'),
  }),
});

const requestTimeoutSeconds = 20;
const retryAttempts = 3;
const requestTimeout = Duration.seconds(requestTimeoutSeconds);
const retrySchedule = Schedule.intersect(
  Schedule.exponential(Duration.seconds(1)),
  Schedule.recurs(retryAttempts),
);

const fetchJson = (url: URL): Effect.Effect<unknown, WeatherError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo answered ${response.status}.`);
      }
      return (await response.json()) as unknown;
    },
    catch: (cause) =>
      new WeatherError({ message: 'Open-Meteo could not be reached.', cause }),
  }).pipe(
    Effect.timeoutFail({
      duration: requestTimeout,
      onTimeout: () =>
        new WeatherError({
          message: 'Open-Meteo did not answer in time.',
          cause: undefined,
        }),
    }),
    Effect.retry(retrySchedule),
  );

const decodeWith =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (json: unknown): Effect.Effect<A, WeatherError> =>
    Schema.decodeUnknown(schema)(json).pipe(
      Effect.mapError(
        (cause) =>
          new WeatherError({
            message: 'Open-Meteo answered in an unexpected shape.',
            cause,
          }),
      ),
    );

const geocodingEndpoint = 'https://geocoding-api.open-meteo.com/v1/search';
const forecastEndpoint = 'https://api.open-meteo.com/v1/forecast';
const geocodingLimit = 8;
const forecastDays = 7;

export class WeatherApi extends Effect.Service<WeatherApi>()(
  'shared/WeatherApi',
  {
    sync: () => {
      const searchLocations = (
        query: string,
      ): Effect.Effect<ReadonlyArray<Location>, WeatherError> => {
        const url = new URL(geocodingEndpoint);
        url.searchParams.set('name', query);
        url.searchParams.set('count', String(geocodingLimit));
        url.searchParams.set('language', 'en');
        url.searchParams.set('format', 'json');
        return fetchJson(url).pipe(
          Effect.flatMap(decodeWith(GeocodingResponse)),
          Effect.map((response) =>
            (response.results ?? []).map((result) => ({
              name: result.name,
              region: result.admin1 ?? '',
              country: result.country ?? '',
              latitude: result.latitude,
              longitude: result.longitude,
              timezone: result.timezone,
            })),
          ),
        );
      };

      const forecast = (
        location: Location,
      ): Effect.Effect<ReadonlyArray<DailyForecast>, WeatherError> => {
        const url = new URL(forecastEndpoint);
        url.searchParams.set('latitude', String(location.latitude));
        url.searchParams.set('longitude', String(location.longitude));
        url.searchParams.set('timezone', location.timezone);
        url.searchParams.set('forecast_days', String(forecastDays));
        url.searchParams.set(
          'daily',
          [
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_probability_max',
            'precipitation_sum',
            'wind_speed_10m_max',
            'weather_code',
          ].join(','),
        );
        return fetchJson(url).pipe(
          Effect.flatMap(decodeWith(ForecastResponse)),
          Effect.map(({ daily }) =>
            daily.time.flatMap((date, index) => {
              const high = daily.highs[index];
              const low = daily.lows[index];
              if (
                high === null ||
                high === undefined ||
                low === null ||
                low === undefined
              ) {
                return [];
              }
              return [
                {
                  date,
                  high,
                  low,
                  precipitationProbability: daily.rainChances[index] ?? 0,
                  precipitationMm: daily.rainSums[index] ?? 0,
                  windKmh: daily.windPeaks[index] ?? 0,
                  weatherCode: daily.weatherCodes[index] ?? 0,
                },
              ];
            }),
          ),
        );
      };

      return { searchLocations, forecast };
    },
  },
) {}
