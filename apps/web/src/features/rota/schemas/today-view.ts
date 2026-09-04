import type { Slot } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { ProposalStatus } from '#/shared/data/proposal-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';

export type ProposalItemView = {
  readonly slot: Slot;
  readonly garment: GarmentView;
  readonly continued: boolean;
  readonly dayOfBudget: number;
  readonly budget: number;
  readonly reason: string;
};

export type ProposalView = {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly headline: string;
  readonly items: ReadonlyArray<ProposalItemView>;
  readonly forecastStale: boolean;
  readonly occasion: string | null;
};

export type WornItemView = {
  readonly slot: Slot;
  readonly garment: GarmentView;
  /** Which day of the garment's budget this wear is, counting itself. */
  readonly dayOfBudget: number;
  readonly budget: number;
};

/** A day with no log between the last logged day and today, with the outfit before it. */
export type UnloggedDay = {
  readonly date: LocalDate;
  readonly previousDate: LocalDate;
  readonly previousNames: ReadonlyArray<string>;
};

export type TodayProblem = {
  readonly kind:
    | 'location-missing'
    | 'forecast-unavailable'
    | 'slot-empty'
    | 'answer-unusable'
    | 'wardrobe-empty';
  readonly message: string;
};

export type TodayView = {
  readonly today: LocalDate;
  readonly locationLabel: string | null;
  readonly weather: WeatherDay | null;
  readonly tomorrowWeather: WeatherDay | null;
  readonly forecastStale: boolean;
  readonly occasion: string | null;
  readonly proposal: ProposalView | null;
  readonly worn: ReadonlyArray<WornItemView> | null;
  readonly unloggedDays: ReadonlyArray<UnloggedDay>;
  readonly tomorrowHint: string | null;
  readonly problem: TodayProblem | null;
  readonly activeGarments: number;
};
