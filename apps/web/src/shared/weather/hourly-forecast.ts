import { Effect, Schema } from 'effect';
import { type LocalDate, localDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { WeatherError } from './errors/weather-errors.ts';
import { forecastEndHour, forecastStartHour } from './forecast-window.ts';

export const DailyForecastSchema = Schema.Struct({
  date: LocalDateSchema,
  startHour: Schema.Number,
  endHour: Schema.Number,
  high: Schema.Number,
  low: Schema.Number,
  precipitationProbability: Schema.Number,
  precipitationMm: Schema.Number,
  windKmh: Schema.Number,
  weatherCode: Schema.Number,
});

export type DailyForecast = Schema.Schema.Type<typeof DailyForecastSchema>;

const hourlyField = (wireKey: string) =>
  Schema.propertySignature(Schema.Array(Schema.NullOr(Schema.Finite))).pipe(
    Schema.fromKey(wireKey),
  );

const localHour = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/u),
);

const ForecastResponse = Schema.Struct({
  hourly: Schema.Struct({
    time: Schema.Array(localHour),
    temperatures: hourlyField('temperature_2m'),
    rainChances: hourlyField('precipitation_probability'),
    rainAmounts: hourlyField('precipitation'),
    winds: hourlyField('wind_speed_10m'),
    weatherCodes: hourlyField('weather_code'),
  }),
});

type Hourly = Schema.Schema.Type<typeof ForecastResponse>['hourly'];
const dateLength = 10;
const hourStart = 11;
const hourEnd = 13;

const summarizeDay = (
  date: LocalDate,
  indices: ReadonlyMap<number, number>,
  hourly: Hourly,
): DailyForecast | undefined => {
  const temperatures: Array<number> = [];
  const winds: Array<number> = [];
  const codes: Array<number> = [];
  const chances: Array<number> = [];
  const amounts: Array<number> = [];
  for (let hour = forecastStartHour; hour <= forecastEndHour; hour += 1) {
    const index = indices.get(hour);
    if (index === undefined) {
      return undefined;
    }
    const temperature = hourly.temperatures[index];
    const wind = hourly.winds[index];
    const code = hourly.weatherCodes[index];
    if (
      temperature === null ||
      temperature === undefined ||
      wind === null ||
      wind === undefined ||
      code === null ||
      code === undefined
    ) {
      return undefined;
    }
    temperatures.push(temperature);
    winds.push(wind);
    codes.push(code);
    // Precipitation at 06:00 covers 05:00–06:00; the 05:00 value is overnight.
    if (hour > forecastStartHour) {
      const chance = hourly.rainChances[index];
      const amount = hourly.rainAmounts[index];
      if (
        chance === null ||
        chance === undefined ||
        amount === null ||
        amount === undefined
      ) {
        return undefined;
      }
      chances.push(chance);
      amounts.push(amount);
    }
  }
  return {
    date,
    startHour: forecastStartHour,
    endHour: forecastEndHour,
    high: Math.max(...temperatures),
    low: Math.min(...temperatures),
    precipitationProbability: Math.max(...chances),
    precipitationMm: amounts.reduce((sum, amount) => sum + amount, 0),
    windKmh: Math.max(...winds),
    weatherCode: Math.max(...codes),
  };
};

export const decodeForecast = (
  input: unknown,
): Effect.Effect<ReadonlyArray<DailyForecast>, WeatherError> =>
  Schema.decodeUnknown(ForecastResponse)(input).pipe(
    Effect.mapError(
      (cause) =>
        new WeatherError({
          message: 'Open-Meteo answered in an unexpected shape.',
          cause,
        }),
    ),
    Effect.flatMap(({ hourly }) => {
      const days = new Map<LocalDate, Map<number, number>>();
      for (const [index, time] of hourly.time.entries()) {
        const date = localDate(time.slice(0, dateLength));
        const hour = Number(time.slice(hourStart, hourEnd));
        const indices = days.get(date) ?? new Map<number, number>();
        indices.set(hour, index);
        days.set(date, indices);
      }
      return Effect.forEach([...days], ([date, indices]) => {
        const day = summarizeDay(date, indices, hourly);
        return day === undefined
          ? Effect.fail(
              new WeatherError({
                message: `Open-Meteo did not include a complete 05:00–20:00 forecast for ${date}.`,
                cause: undefined,
              }),
            )
          : Effect.succeed(day);
      });
    }),
  );
