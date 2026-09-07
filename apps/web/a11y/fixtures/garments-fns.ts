import { Effect } from 'effect';
import type { GarmentEdit } from '#/features/garments/schemas/garment-input.ts';
import type { TodayView } from '#/features/rota/schemas/today-view.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';

let current: GarmentView;
export const setFixtureGarment = (value: GarmentView) => {
  current = value;
};
export const fixtureGarment = () => current;

export const acceptGarmentFn = ({ data }: { readonly data: unknown }) =>
  Effect.runPromise(
    Effect.sync(() => {
      const accepted = document.querySelector(
        '[aria-label="Accepted garment"]',
      );
      if (accepted !== null) {
        accepted.textContent = JSON.stringify(data);
      }
    }),
  );
export const deleteGarmentFn = () => Effect.runPromise(Effect.void);
export const garmentFn = () => Effect.runPromise(Effect.sync(() => current));
export const retryStudioFn = ({
  data,
}: {
  readonly data: { readonly edit: GarmentEdit; readonly instructions: string };
}) =>
  Effect.runPromise(
    Effect.sync(() => {
      const output = document.querySelector('[aria-label="Render request"]');
      if (output !== null) {
        output.textContent = JSON.stringify(data);
      }
      current = {
        ...current,
        ...data.edit,
        studioError: null,
        studioState: { status: 'queued' },
      };
      return current;
    }),
  );
export const updateGarmentFn = () => garmentFn();
export const setImageChoiceFn = () => garmentFn();
export const retireGarmentFn = () => garmentFn();
export const restoreGarmentFn = () => garmentFn();

export const alternativesFn = () => Effect.runPromise(Effect.succeed([]));

export const undecided: TodayView = {
  today: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  weather: null,
  tomorrowWeather: null,
  forecastStale: false,
  occasion: null,
  proposal: null,
  worn: null,
  unloggedDays: [],
  tomorrowHint: null,
  problem: null,
  activeGarments: 1,
};

export let decisionCalls = 0;
export const decideTodayFn = () =>
  Effect.runPromise(
    Effect.sync(() => {
      decisionCalls += 1;
      return {
        ...undecided,
        problem: {
          kind: 'answer-unusable' as const,
          message: 'Try the valet again.',
        },
      };
    }),
  );
export const backfillFn = decideTodayFn;
export const confirmProposalFn = decideTodayFn;
export const logOutfitFn = decideTodayFn;
export const rerollProposalFn = decideTodayFn;
export const saveOccasionFn = decideTodayFn;
