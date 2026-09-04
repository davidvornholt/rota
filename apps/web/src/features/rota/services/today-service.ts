/**
 * What the Today page needs, assembled from the log, the proposal, and the
 * forecast — and the scheduler's tick, which is the same question asked by the
 * clock instead of by you.
 */

import { Effect } from 'effect';

import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import type { Garment } from '#/shared/data/garment.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import {
  toGarmentView,
  wearFactsByGarment,
} from '#/shared/data/garment-view.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import {
  type WearEntry,
  WearLogRepository,
} from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { locationLabel } from '#/shared/weather/location.ts';
import type { TodayProblem, TodayView } from '../schemas/today-view.ts';
import { ForecastService, type ForecastWindow } from './forecast-service.ts';
import { ProposalService } from './proposal-service.ts';
import { alternatives, tick } from './today-actions.ts';
import {
  problemOf,
  proposalView,
  tomorrowHint,
  unloggedDaysBefore,
  wardrobeEmptyProblem,
  wornOn,
} from './today-view-assembly.ts';

/**
 * Turns the failures the wearer can act on into a page problem and lets every
 * other failure through: a model that answered badly is the page's business,
 * a database that is down is not.
 */
const orProblem = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<
  | { readonly value: A; readonly problem: null }
  | { readonly value: undefined; readonly problem: TodayProblem },
  E,
  R
> =>
  effect.pipe(
    Effect.map((value) => ({ value, problem: null }) as const),
    Effect.catchAll((error) => {
      const problem = problemOf(error);
      return problem === undefined
        ? Effect.fail(error)
        : Effect.succeed({ value: undefined, problem } as const);
    }),
  );

type ViewParts = {
  readonly clock: WardrobeClock;
  readonly forecast: {
    readonly value: ForecastWindow | undefined;
    readonly problem: TodayProblem | null;
  };
  readonly occasion: string | null;
  readonly worn: TodayView['worn'];
  readonly proposal: TodayView['proposal'];
  readonly unloggedDays: TodayView['unloggedDays'];
  readonly activeGarments: number;
  readonly problem: TodayProblem | null;
};

/** The forecast problem outranks the wardrobe one only when there is no decision problem. */
const assembleView = (parts: ViewParts): TodayView => {
  const { clock, forecast } = parts;
  return {
    today: clock.today,
    locationLabel:
      clock.settings.location === null
        ? null
        : locationLabel(clock.settings.location),
    weather: forecast.value?.today ?? null,
    tomorrowWeather: forecast.value?.tomorrow ?? null,
    forecastStale: forecast.value?.stale ?? false,
    occasion: parts.occasion,
    proposal: parts.proposal,
    worn: parts.worn,
    unloggedDays: parts.unloggedDays,
    tomorrowHint: tomorrowHint(parts.worn),
    problem: parts.problem ?? forecast.problem,
    activeGarments: parts.activeGarments,
  };
};

export class TodayService extends Effect.Service<TodayService>()(
  'rota/TodayService',
  {
    effect: Effect.gen(function* () {
      const garments = yield* GarmentRepository;
      const wearLog = yield* WearLogRepository;
      const proposals = yield* ProposalRepository;
      const notes = yield* DayNoteRepository;
      const media = yield* MediaStore;
      const forecasts = yield* ForecastService;
      const proposalService = yield* ProposalService;

      const viewsFor = (
        clock: WardrobeClock,
        all: ReadonlyArray<Garment>,
        log: ReadonlyArray<WearEntry>,
      ) => {
        const facts = wearFactsByGarment(log, clock.today);
        return new Map(
          all.map((garment) => [
            garment.id,
            toGarmentView({
              garment,
              facts: facts.get(garment.id),
              categoryBudgets: clock.settings.categoryBudgets,
              today: clock.today,
              urlFor: media.urlFor,
            }),
          ]),
        );
      };

      const forecastWindow = (clock: WardrobeClock) =>
        orProblem(forecasts.ensure(clock.settings, clock.today));

      /** The page, without waiting for a decision: proposals are made by `decide`. */
      const view = (
        clock: WardrobeClock,
        decisionProblem: TodayProblem | null = null,
      ) =>
        Effect.gen(function* () {
          const [all, log, occasion, latest, forecast] = yield* Effect.all([
            garments.list(),
            wearLog.history(),
            notes.read(clock.today),
            proposals.latestForDate(clock.today),
            forecastWindow(clock),
          ]);
          const views = viewsFor(clock, all, log);
          const worn = wornOn(clock.today, {
            settings: clock.settings,
            log,
            all,
            views,
          });
          const active = all.filter(
            (garment) => garment.status === 'active',
          ).length;
          return assembleView({
            clock,
            forecast,
            occasion,
            worn,
            proposal: worn === null ? proposalView(latest, views) : null,
            unloggedDays:
              worn === null
                ? unloggedDaysBefore(
                    clock.today,
                    log,
                    new Map(all.map((garment) => [garment.id, garment.name])),
                  )
                : [],
            activeGarments: active,
            problem:
              decisionProblem ?? (active === 0 ? wardrobeEmptyProblem : null),
          });
        });

      /** Makes sure today has a proposal, then answers with the page. */
      const decide = (clock: WardrobeClock) =>
        orProblem(proposalService.ensure(clock)).pipe(
          Effect.flatMap((outcome) => view(clock, outcome.problem)),
        );

      return {
        view,
        decide,
        alternatives: (
          clock: WardrobeClock,
          slot: Slot,
          currentIds: ReadonlyArray<string>,
        ) =>
          alternatives(
            { garments, wearLog, viewsFor, forecastWindow },
            clock,
            slot,
            currentIds,
          ),
        tick: (clock: WardrobeClock) =>
          tick({ wearLog, proposalService }, clock),
      };
    }),
  },
) {}
