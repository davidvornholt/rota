import type { WeatherDay } from '#/shared/data/weather-repository.ts';

/** WMO weather interpretation codes, as Open-Meteo reports them: the last code of each group. */
const weatherGroups: ReadonlyArray<{
  readonly upTo: number;
  readonly words: string;
}> = [
  { upTo: 0, words: 'clear' },
  { upTo: 2, words: 'mostly clear' },
  { upTo: 3, words: 'overcast' },
  { upTo: 48, words: 'fog' },
  { upTo: 57, words: 'drizzle' },
  { upTo: 67, words: 'rain' },
  { upTo: 77, words: 'snow' },
  { upTo: 82, words: 'showers' },
  { upTo: 86, words: 'snow showers' },
];

export const weatherWords = (code: number): string =>
  weatherGroups.find((group) => code <= group.upTo)?.words ?? 'thunderstorm';

const degrees = (value: number): string => `${Math.round(value)}°`;

/** "21° / 12° · mostly clear · 10% rain" — the strip under the date. */
export const weatherLine = (day: WeatherDay): string =>
  [
    `${degrees(day.high)} / ${degrees(day.low)}`,
    weatherWords(day.weatherCode),
    `${Math.round(day.precipitationProbability)}% rain`,
  ].join(' · ');

/** The fuller sentence the model reads. */
export const weatherSentence = (day: WeatherDay): string =>
  `high ${degrees(day.high)}C, low ${degrees(day.low)}C, ${weatherWords(day.weatherCode)}, ${Math.round(day.precipitationProbability)}% chance of rain (${day.precipitationMm.toFixed(1)} mm), wind up to ${Math.round(day.windKmh)} km/h`;
