import { describe, expect, it } from 'bun:test';
import { Effect, Either } from 'effect';
import { localDate } from '#/shared/time/local-date.ts';
import { decodeForecast } from './hourly-forecast.ts';

const hoursPerDay = 24;
const date = localDate('2026-09-05');
const mild = { temperature: 18, chance: 10, wind: 12 };
const rain = { chance: 80, amount: 3 };
const hourlyInput = (dates: ReadonlyArray<string> = [date]) => {
  const hours = dates.flatMap((day) =>
    Array.from({ length: hoursPerDay }, (_, hour) => ({
      time: `${day}T${String(hour).padStart(2, '0')}:00`,
      hour,
    })),
  );
  const values = (value: number) => hours.map((): number | null => value);
  return {
    time: hours.map((row) => row.time),
    temperature: values(mild.temperature),
    chance: values(mild.chance),
    amount: values(0),
    wind: values(mild.wind),
    code: values(1),
  };
};

type Input = ReturnType<typeof hourlyInput>;
const decode = (input: Input) =>
  decodeForecast({
    hourly: Object.fromEntries([
      ['time', input.time],
      ['temperature_2m', input.temperature],
      ['precipitation_probability', input.chance],
      ['precipitation', input.amount],
      ['wind_speed_10m', input.wind],
      ['weather_code', input.code],
    ]),
  });

describe('hourly forecast summary', () => {
  it('ignores overnight extremes and includes instantaneous values at both endpoints', () => {
    const input = hourlyInput();
    Object.assign(input.temperature, { 4: -5, 5: 11, 20: 23, 21: 30 });
    Object.assign(input.wind, { 4: 90, 20: 25, 21: 100 });
    Object.assign(input.code, { 4: 95, 20: 3, 21: 99 });
    expect(Effect.runSync(decode(input))).toEqual([
      {
        date,
        high: 23,
        low: 11,
        precipitationProbability: 10,
        precipitationMm: 0,
        windKmh: 25,
        weatherCode: 3,
      },
    ]);
  });

  it.each([
    { hour: 5, probability: 10, amount: 0 },
    { hour: 6, probability: 80, amount: 3 },
    { hour: 20, probability: 80, amount: 3 },
    { hour: 21, probability: 10, amount: 0 },
  ])(
    'uses the preceding precipitation interval at $hour:00',
    ({ hour, probability, amount }) => {
      const input = hourlyInput();
      input.chance[hour] = rain.chance;
      input.amount[hour] = rain.amount;
      expect(Effect.runSync(decode(input))[0]).toMatchObject({
        precipitationProbability: probability,
        precipitationMm: amount,
      });
    },
  );

  it('takes the peak hourly probability and sums amounts within each local date', () => {
    const input = hourlyInput(['2026-03-29', '2026-03-30']);
    Object.assign(input.chance, { 6: 60, 7: 80 });
    Object.assign(input.amount, { 6: 1, 7: 2 });
    const [first, second] = Effect.runSync(decode(input));
    expect(first).toMatchObject({
      date: '2026-03-29',
      precipitationProbability: 80,
      precipitationMm: 3,
    });
    expect(second).toMatchObject({
      date: '2026-03-30',
      precipitationProbability: 10,
      precipitationMm: 0,
    });
  });

  it.each(['temperature', 'chance', 'amount', 'wind', 'code'] as const)(
    'rejects missing daytime %s instead of treating it as dry or calm',
    (field) => {
      const input = hourlyInput();
      input[field][6] = null;
      const result = Effect.runSync(Effect.either(decode(input)));
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { _tag: 'WeatherError' },
      });
    },
  );

  it('rejects a truncated time window', () => {
    const input = hourlyInput();
    const missingEndpoint = 20;
    input.time = input.time.slice(0, missingEndpoint);
    expect(
      Either.isLeft(Effect.runSync(Effect.either(decode(input)))),
    ).toBeTrue();
  });

  it('allows unavailable overnight values', () => {
    const input = hourlyInput();
    input.temperature[4] = null;
    input.chance[5] = null;
    input.amount[5] = null;
    expect(Effect.runSync(decode(input))[0]?.precipitationMm).toBe(0);
  });
});
