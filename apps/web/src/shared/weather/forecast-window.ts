export const forecastStartHour = 5;
export const forecastEndHour = 20;

const clockHour = (hour: number): string =>
  `${String(hour).padStart(2, '0')}:00`;

export const forecastHoursLabel = `${clockHour(forecastStartHour)}–${clockHour(forecastEndHour)} local time`;
