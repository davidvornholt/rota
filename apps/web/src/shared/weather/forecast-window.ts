export const forecastStartHour = 5;
export const forecastEndHour = 20;

export type ForecastHours = {
  readonly startHour: number;
  readonly endHour: number;
};

export const hasForecastHours = (hours: ForecastHours): boolean =>
  hours.startHour === forecastStartHour && hours.endHour === forecastEndHour;

const clockHour = (hour: number): string =>
  `${String(hour).padStart(2, '0')}:00`;

export const forecastHoursLabel = (hours: ForecastHours): string =>
  `${clockHour(hours.startHour)}–${clockHour(hours.endHour)} local time`;
