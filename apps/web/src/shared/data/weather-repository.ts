import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import type { DailyForecast } from '#/shared/weather/hourly-forecast.ts';
import { readError, writeError } from './errors/data-errors.ts';

export const WeatherDayFromRow = Schema.Struct({
  date: LocalDateSchema,
  issuedOn: LocalDateSchema,
  locationLabel: Schema.String,
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
  precipitationMm: Schema.Number,
  windKmh: Schema.Number,
  weatherCode: Schema.Number,
}).pipe(
  Schema.encodeKeys({
    date: 'for_date',
    issuedOn: 'issued_on',
    locationLabel: 'location_label',
    precipitationProbability: 'precipitation_probability',
    precipitationMm: 'precipitation_mm',
    windKmh: 'wind_kmh',
    weatherCode: 'weather_code',
  }),
);
export type WeatherDay = Schema.Schema.Type<typeof WeatherDayFromRow>;

const decodeDays = Schema.decodeUnknownEffect(Schema.Array(WeatherDayFromRow));
const readWeather = readError('The forecast');
const writeWeather = writeError('The forecast');

export class WeatherRepository extends Context.Service<WeatherRepository>()(
  'shared/WeatherRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      const readRange = (from: LocalDate, to: LocalDate) =>
        sql`
          select for_date, issued_on, location_label, high, low,
                 precipitation_probability, precipitation_mm, wind_kmh, weather_code
          from weather_day
          where owner_id = ${owner.id} and for_date between ${from} and ${to}
          order by for_date
        `.pipe(Effect.flatMap(decodeDays), Effect.mapError(readWeather));

      /** Every stored day, oldest first, for the statistics that pair wear with weather. */
      const history = () =>
        sql`
          select for_date, issued_on, location_label, high, low,
                 precipitation_probability, precipitation_mm, wind_kmh, weather_code
          from weather_day
          where owner_id = ${owner.id}
          order by for_date
        `.pipe(Effect.flatMap(decodeDays), Effect.mapError(readWeather));

      /** A fresh forecast replaces what was stored for each of its days. */
      const store = (
        days: ReadonlyArray<DailyForecast>,
        issuedOn: LocalDate,
        locationLabel: string,
      ) =>
        sql
          .withTransaction(
            Effect.forEach(
              days,
              (day) => sql`
                insert into weather_day (owner_id, for_date, issued_on, location_label, high, low,
                  precipitation_probability, precipitation_mm, wind_kmh, weather_code)
                values (${owner.id}, ${day.date}, ${issuedOn}, ${locationLabel}, ${day.high}, ${day.low},
                  ${day.precipitationProbability}, ${day.precipitationMm}, ${day.windKmh}, ${day.weatherCode})
                on conflict (owner_id, for_date) do update
                  set issued_on = excluded.issued_on, fetched_at = now(),
                      location_label = excluded.location_label,
                      high = excluded.high, low = excluded.low,
                      precipitation_probability = excluded.precipitation_probability,
                      precipitation_mm = excluded.precipitation_mm,
                      wind_kmh = excluded.wind_kmh, weather_code = excluded.weather_code
              `,
              { discard: true },
            ),
          )
          .pipe(Effect.asVoid, Effect.mapError(writeWeather));

      return { readRange, history, store };
    }),
  },
) {
  static readonly layer = Layer.effect(
    WeatherRepository,
    WeatherRepository.make,
  );
}
