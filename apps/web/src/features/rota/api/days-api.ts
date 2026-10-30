import { RotaApi } from '@rota/api/api';
import type { DayRef, DayView } from '@rota/api/wardrobe';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { asMember } from '#/shared/api/member-runtime.ts';
import { outfitItems, toApiWeather } from '#/shared/api/wire.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { addDays, localDate } from '#/shared/time/local-date.ts';
import {
  readWardrobeClock,
  type WardrobeClock,
} from '#/shared/time/wardrobe-clock.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import { ForecastService } from '../services/forecast-service.ts';
import { dateClock } from '../services/planning-rules.ts';
import { changePlanning, planningView } from '../services/planning-service.ts';
import { rotaRuntime } from '../services/rota-runtime.ts';

export const toApiDay = (
  view: PlanningView,
  names: ReadonlyMap<string, string>,
): DayView => {
  const { day } = view;
  return {
    date: day.today,
    today: view.actualToday,
    weather: day.weather === null ? null : toApiWeather(day.weather),
    forecastStale: day.forecastStale,
    occasion: day.occasion,
    proposal:
      day.proposal === null
        ? null
        : {
            status: day.proposal.status,
            headline: day.proposal.headline,
            items: day.proposal.items.map((item) => ({
              slot: item.slot,
              garmentId: item.garment.id,
              name: item.garment.name,
              reason: item.reason,
            })),
            forecastStale: day.proposal.forecastStale,
          },
    worn:
      day.worn === null
        ? null
        : day.worn.map((item) => ({
            slot: item.slot,
            garmentId: item.garment.id,
            name: item.garment.name,
          })),
    plan:
      view.plan.entries === null
        ? null
        : {
            items: outfitItems(view.plan.entries, names),
            basedOn: view.plan.basedOn,
          },
    // The wardrobe is projected onto the planned day, so tomorrow's laundry
    // already counts what today's plan will put in the basket.
    laundry: view.wardrobe
      .filter((garment) => garment.inLaundry)
      .map((garment) => ({
        garmentId: garment.id,
        name: garment.name,
        readyOn: garment.readyOn,
      })),
    problem: day.problem?.message ?? null,
    warnings: view.warnings,
  };
};

/** Every garment's name, retired ones included, so an old plan still reads. */
const garmentNames = Effect.gen(function* () {
  const garments = yield* GarmentRepository;
  const all = yield* garments.list();
  return new Map(all.map((garment) => [garment.id, garment.name]));
});

const resolveDay = (clock: WardrobeClock, day: DayRef) => {
  switch (day) {
    case 'today':
      return clock.actualToday;
    case 'tomorrow':
      return addDays(clock.actualToday, 1);
    default:
      return localDate(day);
  }
};

const dayView = (
  day: DayRef,
  change: Exclude<PlanningChange, { action: 'suggest' }> | null,
) =>
  asMember(() =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const wardrobe = yield* readWardrobeClock();
        const clock = yield* dateClock(wardrobe, resolveDay(wardrobe, day));
        const view = yield* change === null
          ? planningView(clock)
          : changePlanning(clock, change);
        return toApiDay(view, yield* garmentNames);
      }),
    ),
  );

/** Today and the next days the stored forecast covers. */
const forecast = () =>
  asMember(() =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const clock = yield* readWardrobeClock();
        const forecasts = yield* ForecastService;
        const window = yield* forecasts.ensure(
          clock.settings,
          clock.actualToday,
          clock.actualToday,
        );
        return {
          today: clock.actualToday,
          stale: window.stale,
          days: [window.today, ...window.upcoming].map(toApiWeather),
        };
      }),
    ),
  );

export const daysApi = HttpApiBuilder.group(RotaApi, 'days', (handlers) =>
  Effect.succeed(
    handlers
      .handle('get', ({ params }) => dayView(params.date, null))
      .handle('plan', ({ params, payload }) =>
        dayView(params.date, {
          action: 'plan',
          entries: payload.items,
          basedOn: payload.basedOn,
        }),
      )
      .handle('occasion', ({ params, payload }) =>
        dayView(params.date, { action: 'note', text: payload.text }),
      )
      .handle('wear', ({ params, payload }) =>
        dayView(params.date, {
          action: 'wear',
          entries: payload.items,
          basedOn: null,
        }),
      )
      .handle('forecast', forecast),
  ),
);
