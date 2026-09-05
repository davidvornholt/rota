/** @jsxImportSource react */
// Keep React SSR available in Playwright, which otherwise uses its own JSX runtime.
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import {
  formatDayMonth,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import { forecastHoursLabel } from '#/shared/weather/forecast-window.ts';
import { weatherWords } from '../weather-words.ts';

type WeatherStripProps = {
  readonly today: LocalDate;
  readonly weather: WeatherDay | null;
  readonly locationLabel: string | null;
  readonly stale: boolean;
};

const degrees = (value: number) => `${Math.round(value)}°`;

type Fact = {
  readonly key: string;
  readonly text: string;
  readonly tone: 'ink' | 'muted' | 'faint';
};

const factsFor = (
  weather: WeatherDay | null,
  locationLabel: string | null,
  stale: boolean,
): ReadonlyArray<Fact> => {
  if (weather === null) {
    return [
      locationLabel === null
        ? { key: 'place', text: 'No place chosen yet', tone: 'muted' }
        : { key: 'place', text: locationLabel, tone: 'faint' },
      ...(locationLabel === null
        ? []
        : [
            {
              key: 'forecast',
              text: 'forecast unavailable',
              tone: 'muted',
            } as const,
          ]),
    ];
  }
  return [
    {
      key: 'temperature',
      text: `${degrees(weather.high)} / ${degrees(weather.low)}`,
      tone: 'ink',
    },
    { key: 'hours', text: forecastHoursLabel, tone: 'muted' },
    { key: 'sky', text: weatherWords(weather.weatherCode), tone: 'muted' },
    {
      key: 'rain',
      text: `${Math.round(weather.precipitationProbability)}% rain`,
      tone: 'muted',
    },
    ...(locationLabel === null
      ? []
      : [{ key: 'place', text: locationLabel, tone: 'faint' } as const]),
    ...(stale
      ? [
          {
            key: 'stale',
            text: 'forecast from yesterday',
            tone: 'faint',
          } as const,
        ]
      : []),
  ];
};

const toneClass = {
  ink: 'text-ink',
  muted: 'text-ink-muted',
  faint: 'text-ink-faint',
} as const;

/**
 * The day and its weather, set as the page's dateline: weekday large in the
 * serif, the facts beside it as a row separated by middots, the numbers
 * tabular so tomorrow's line up under today's.
 */
export const WeatherStrip = ({
  today,
  weather,
  locationLabel,
  stale,
}: WeatherStripProps) => (
  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-rule border-b pb-4">
    <h1 className="type-display text-4xl text-ink sm:text-5xl">
      {formatWeekday(today)}
      <span className="text-ink-faint"> {formatDayMonth(today)}</span>
    </h1>
    <ul className="type-data flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm sm:text-base">
      {factsFor(weather, locationLabel, stale).map((fact, index) => (
        <li
          className={['flex items-baseline gap-x-3', toneClass[fact.tone]].join(
            ' ',
          )}
          key={fact.key}
        >
          {index > 0 ? (
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
          ) : null}
          {fact.text}
        </li>
      ))}
    </ul>
  </div>
);
