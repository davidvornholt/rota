import { Effect } from 'effect';
import type { GarmentEdit } from '#/features/garments/schemas/garment-input.ts';
import type { TodayView } from '#/features/rota/schemas/today-view.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  fixtureProposal,
  setFixtureProposal,
  shirt,
} from './today-proposal.ts';

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

/** Two layers to swap in: one the engine would rank, one it would not. */
export const alternativesFn = ({
  data,
}: {
  readonly data: { readonly slot: Slot };
}) =>
  Effect.runPromise(
    Effect.succeed({
      slot: data.slot,
      ranked: [
        {
          ...shirt,
          id: 'demo-jacket',
          name: 'Wax jacket',
          slots: [data.slot],
          colors: [{ hex: '#4a3b2a' }],
          daysSinceWorn: 9,
        },
      ],
      others: [
        {
          ...shirt,
          id: 'demo-cardigan',
          name: 'Grey cardigan',
          slots: [data.slot],
          colors: [{ hex: '#8a8a8a' }],
          daysSinceWorn: null,
        },
      ],
    }),
  );

export const undecided: TodayView = {
  today: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  weather: null,
  tomorrowWeather: null,
  forecastStale: false,
  occasion: null,
  proposal: null,
  worn: null,
  unlogged: null,
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
export const rerollProposalFn = () => {
  const view = fixtureProposal;
  const proposal = view?.proposal;
  if (view === undefined || proposal === undefined || proposal === null) {
    return decideTodayFn();
  }
  return Effect.runPromise(
    Effect.sync(() => {
      const next = {
        ...view,
        proposal: {
          ...proposal,
          headline: 'A fresh choice for your meeting.',
          occasion: view.occasion,
        },
      };
      setFixtureProposal(next);
      return next;
    }),
  );
};

export const saveOccasionFn = ({
  data,
  fetch: requestFetch,
}: {
  readonly data: { readonly occasion: string };
  readonly fetch: typeof serverFunctionFetch;
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const view = fixtureProposal ?? undecided;
      setFixtureProposal({ ...view, occasion: data.occasion });
      yield* Effect.sleep('300 millis');
      const response = yield* Effect.promise(() =>
        requestFetch('/fixture-note-save'),
      );
      if (!response.ok) {
        return yield* Effect.fail(
          new Error(yield* Effect.promise(() => response.text())),
        );
      }
      return { ...view, occasion: data.occasion };
    }),
  );
