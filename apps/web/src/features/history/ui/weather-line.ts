import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { forecastHoursLabel } from '#/shared/weather/forecast-window.ts';

const degrees = (value: number) => `${Math.round(value)}°`;

/** The stored forecast for a past day in one line, or the fact that there is none. */
export const weatherLine = (weather: WeatherDay | null) =>
  weather === null
    ? 'No forecast stored'
    : `${forecastHoursLabel} · ${degrees(weather.high)} / ${degrees(weather.low)} · ${Math.round(weather.precipitationProbability)}% rain`;
