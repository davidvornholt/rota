import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import type { DailyForecast } from '#/shared/weather/hourly-forecast.ts';
import { readError, writeError } from './errors/data-errors.ts';

export const WeatherDayFromRow = Schema.Struct({
  date: Schema.propertySignature(LocalDateSchema).pipe(
    Schema.fromKey('for_date'),
  ),
  issuedOn: Schema.propertySignature(LocalDateSchema).pipe(
    Schema.fromKey('issued_on'),
  ),
  locationLabel: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('location_label'),
  ),
  startHour: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('start_hour'),
  ),
  endHour: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('end_hour'),
  ),
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('precipitation_probability'),
  ),
  precipitationMm: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('precipitation_mm'),
  ),
  windKmh: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('wind_kmh'),
  ),
  weatherCode: Schema.propertySignature(Schema.Number).pipe(
    Schema.fromKey('weather_code'),
  ),
});
export type WeatherDay = Schema.Schema.Type<typeof WeatherDayFromRow>;

const decodeDays = Schema.decodeUnknown(Schema.Array(WeatherDayFromRow));
const readWeather = readError('The forecast');
const writeWeather = writeError('The forecast');

export class WeatherRepository extends Effect.Service<WeatherRepository>()(
  'shared/WeatherRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const readRange = (from: LocalDate, to: LocalDate) =>
        sql`
          select for_date, issued_on, location_label, start_hour, end_hour, high, low,
                 precipitation_probability, precipitation_mm, wind_kmh, weather_code
          from weather_day
          where for_date between ${from} and ${to}
          order by for_date
        `.pipe(Effect.flatMap(decodeDays), Effect.mapError(readWeather));

      /** Every stored day, oldest first, for the statistics that pair wear with weather. */
      const history = () =>
        sql`
          select for_date, issued_on, location_label, start_hour, end_hour, high, low,
                 precipitation_probability, precipitation_mm, wind_kmh, weather_code
          from weather_day
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
                insert into weather_day (for_date, issued_on, location_label, start_hour, end_hour, high, low,
                  precipitation_probability, precipitation_mm, wind_kmh, weather_code)
                values (${day.date}, ${issuedOn}, ${locationLabel}, ${day.startHour}, ${day.endHour}, ${day.high}, ${day.low},
                  ${day.precipitationProbability}, ${day.precipitationMm}, ${day.windKmh}, ${day.weatherCode})
                on conflict (for_date) do update
                  set issued_on = excluded.issued_on, fetched_at = now(),
                      location_label = excluded.location_label,
                      start_hour = excluded.start_hour, end_hour = excluded.end_hour,
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
) {}
