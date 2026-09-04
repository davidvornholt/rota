import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import {
  formatDayMonth,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import { weatherWords } from '../weather-words.ts';

type WeatherStripProps = {
  readonly today: LocalDate;
  readonly weather: WeatherDay | null;
  readonly locationLabel: string | null;
  readonly stale: boolean;
};

const degrees = (value: number) => `${Math.round(value)}°`;

const Absent = ({
  locationLabel,
}: {
  readonly locationLabel: string | null;
}) =>
  locationLabel === null ? (
    <>No place chosen yet</>
  ) : (
    <>{locationLabel} · forecast unavailable</>
  );

/**
 * The day and its weather, set as the page's dateline: weekday large in the
 * serif, the numbers tabular so tomorrow's line up under today's.
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
    <p className="type-data text-ink-muted text-sm sm:text-base">
      {weather === null ? (
        <Absent locationLabel={locationLabel} />
      ) : (
        <>
          <span className="text-ink">{degrees(weather.high)}</span>
          <span className="text-ink-faint"> / {degrees(weather.low)}</span>·
          {weatherWords(weather.weatherCode)}·
          {Math.round(weather.precipitationProbability)}% rain
          {locationLabel === null ? null : (
            <span className="text-ink-faint"> · {locationLabel}</span>
          )}
          {stale ? (
            <span className="text-ink-faint"> · forecast from yesterday</span>
          ) : null}
        </>
      )}
    </p>
  </div>
);
