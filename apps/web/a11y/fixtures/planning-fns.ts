import { Effect } from 'effect';
import type { PlanningChange } from '#/features/rota/schemas/planning-input.ts';
import type { PlanningView } from '#/features/rota/schemas/planning-view.ts';
import { emptyPlan } from '#/shared/data/outfit-repository.ts';
import type { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import { addDays, localDate } from '#/shared/time/local-date.ts';
import { demoProposal, shirt } from './today-proposal.ts';

const laundryDays = 4;
const bottom = {
  ...shirt,
  id: 'demo-chinos',
  name: 'Navy chinos',
  category: 'trousers',
  slots: ['bottom'] as const,
  effectiveBudget: 4,
  colors: [{ hex: '#24364b' }],
};
export const wardrobe = [
  bottom,
  { ...shirt, daysSinceWorn: 2 },
  {
    ...shirt,
    id: 'demo-white',
    name: 'White cotton shirt',
    colors: [{ hex: '#eeeeee' }],
    daysSinceWorn: null,
  },
  {
    ...shirt,
    id: 'demo-shoes',
    name: 'White trainers',
    category: 'shoes',
    slots: ['shoes'] as const,
  },
  {
    ...shirt,
    id: 'demo-bag',
    name: 'Tan leather bag',
    category: 'handbag',
    slots: ['bag'] as const,
  },
];
const outfitEntries = [
  { slot: 'bottom' as const, garmentId: bottom.id },
  { slot: 'top' as const, garmentId: shirt.id },
];
const views = new Map<string, PlanningView>();
export const planningFixture = (date: string): PlanningView => {
  const stored = sessionStorage.getItem(`planning-view-${date}`);
  const existing =
    views.get(date) ??
    (stored === null ? undefined : (JSON.parse(stored) as PlanningView));
  if (existing !== undefined) {
    return existing;
  }
  const view: PlanningView = {
    day: { ...demoProposal, today: localDate(date) },
    actualToday: demoProposal.today,
    wardrobe: new URLSearchParams(globalThis.location.search).has('projected')
      ? wardrobe.map((garment) =>
          garment.id === shirt.id
            ? {
                ...garment,
                inLaundry: true,
                wearsSinceWash: 2,
                readyOn: addDays(demoProposal.today, laundryDays),
              }
            : garment,
        )
      : wardrobe,
    laundry: new URLSearchParams(globalThis.location.search).has('returned')
      ? wardrobe.map((garment) =>
          garment.id === shirt.id
            ? { ...garment, assumedCleanOn: demoProposal.today }
            : garment,
        )
      : wardrobe,
    laundryDays,
    cleanTop: false,
    plan: emptyPlan,
    outfits: [
      { id: 'demo-saved', name: 'Blue and navy', entries: outfitEntries },
    ],
    warnings: [],
  };
  views.set(date, view);
  return view;
};
const updateCare = (
  view: PlanningView,
  change: Extract<PlanningChange, { action: 'care' }>,
): PlanningView => {
  const clean = change.care === 'washed';
  const readyOn = clean
    ? null
    : addDays(
        view.actualToday,
        change.care === 'postpone' ? 1 : view.laundryDays,
      );
  const updatePiece = (garment: PlanningView['wardrobe'][number]) =>
    change.ids.includes(garment.id)
      ? {
          ...garment,
          inLaundry: !clean,
          readyOn,
          assumedCleanOn: null,
          wearsSinceWash: clean ? 0 : garment.wearsSinceWash,
        }
      : garment;
  return {
    ...view,
    wardrobe: view.wardrobe.map(updatePiece),
    laundry: view.laundry.map(updatePiece),
  };
};
export const changePlanningFn = ({
  data,
  fetch: request,
}: {
  readonly data: { readonly date: string; readonly change: PlanningChange };
  readonly fetch: typeof serverFunctionFetch;
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (
        new URLSearchParams(globalThis.location.search).has('failure') &&
        data.change.action === 'suggest'
      ) {
        yield* Effect.promise(() =>
          request('/fixture-planning-action', { method: 'POST' }),
        );
      }
      const view = planningFixture(data.date);
      const { change } = data;
      let next = view;
      switch (change.action) {
        case 'suggest': {
          const entries = [
            ...change.entries,
            ...outfitEntries.filter(
              (entry) => !change.entries.some((pin) => pin.slot === entry.slot),
            ),
          ];
          next = {
            ...view,
            day: {
              ...view.day,
              proposal: {
                id: 'demo-outfit',
                status: 'pending',
                headline: 'Your chosen pieces, completed.',
                forecastStale: false,
                occasion: view.day.occasion,
                items: entries.map((entry) => ({
                  slot: entry.slot,
                  garment:
                    wardrobe.find(
                      (garment) => garment.id === entry.garmentId,
                    ) ?? shirt,
                  continued: false,
                  dayOfBudget: 1,
                  budget: 2,
                  reason: '',
                })),
              },
            },
          };
          break;
        }
        case 'plan':
          next = {
            ...view,
            plan: {
              ...view.plan,
              entries: change.entries,
              basedOn: change.basedOn,
            },
          };
          break;
        case 'wear':
          next = {
            ...view,
            day: {
              ...view.day,
              worn: change.entries.map((entry) => ({
                slot: entry.slot,
                garment:
                  wardrobe.find((garment) => garment.id === entry.garmentId) ??
                  shirt,
                dayOfBudget: 1,
                budget: 2,
              })),
            },
          };
          break;
        case 'note':
          next = { ...view, day: { ...view.day, occasion: change.text } };
          break;
        case 'clean-top':
          next = { ...view, cleanTop: change.value };
          break;
        case 'care':
          next = updateCare(view, change);
          break;
        case 'save-outfit':
          next = {
            ...view,
            outfits: [
              ...view.outfits.filter((outfit) => outfit.id !== change.id),
              { id: change.id, name: change.name, entries: change.entries },
            ],
          };
          break;
        case 'delete-outfit':
          next = {
            ...view,
            outfits: view.outfits.filter((outfit) => outfit.id !== change.id),
          };
          break;
        default:
          break;
      }
      views.set(data.date, next);
      sessionStorage.setItem(
        `planning-view-${data.date}`,
        JSON.stringify(next),
      );
      return structuredClone(next);
    }),
  );
export const tomorrow = addDays(demoProposal.today, 1);
