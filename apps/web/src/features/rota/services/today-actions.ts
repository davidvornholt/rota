/**
 * The Today service's two side rooms: the alternatives strip for one slot, and
 * the scheduler's tick. Both take the service's own helpers as dependencies.
 */

import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import type { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type {
  WearEntry,
  WearLogRepository,
} from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { candidatesFor, type RotationInput } from '../rotation.ts';
import type { TodayProblem } from '../schemas/today-view.ts';
import type { ForecastWindow } from './forecast-service.ts';
import type { ProposalService } from './proposal-service.ts';

export type AlternativesView = {
  readonly slot: Slot;
  readonly ranked: ReadonlyArray<GarmentView>;
  readonly others: ReadonlyArray<GarmentView>;
};

export type AlternativesDeps = {
  readonly garments: GarmentRepository;
  readonly wearLog: WearLogRepository;
  readonly viewsFor: (
    clock: WardrobeClock,
    all: ReadonlyArray<Garment>,
    log: ReadonlyArray<WearEntry>,
  ) => ReadonlyMap<string, GarmentView>;
  readonly forecastWindow: (
    clock: WardrobeClock,
  ) => Effect.Effect<
    | { readonly value: ForecastWindow; readonly problem: null }
    | { readonly value: undefined; readonly problem: TodayProblem },
    unknown
  >;
};

export type TickDeps = {
  readonly wearLog: WearLogRepository;
  readonly proposalService: ProposalService;
};

/** For one slot: the engine's ranked candidates, then everything else eligible. */
export const alternatives = (
  { garments, wearLog, viewsFor, forecastWindow }: AlternativesDeps,
  clock: WardrobeClock,
  slot: Slot,
  currentIds: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const [all, log, forecast] = yield* Effect.all([
      garments.list(),
      wearLog.history(),
      forecastWindow(clock),
    ]);
    const views = viewsFor(clock, all, log);
    const eligible = all.filter(
      (garment) =>
        garment.status === 'active' &&
        garment.slots.includes(slot) &&
        !currentIds.includes(garment.id),
    );
    const ranked =
      forecast.value === undefined
        ? []
        : candidatesFor(
            {
              today: clock.today,
              log,
              garments: all,
              settings: clock.settings,
              weather: forecast.value.today,
              excluded: new Set(),
            } satisfies RotationInput,
            slot,
            new Set(currentIds),
          ).map((candidate) => candidate.garment.id);
    const viewOf = (id: string) => {
      const found = views.get(id);
      return found === undefined ? [] : [found];
    };
    const result: AlternativesView = {
      slot,
      ranked: ranked.flatMap(viewOf),
      others: eligible
        .filter((garment) => !ranked.includes(garment.id))
        .flatMap((garment) => viewOf(garment.id)),
    };
    return result;
  });

/**
 * The clock's question. Once the proposal hour has passed and the day has
 * no proposal, one is made; a day already decided or already proposed is
 * left alone. Failures are logged, never thrown: the next tick tries again.
 */
export const tick = (
  { wearLog, proposalService }: TickDeps,
  clock: WardrobeClock,
) =>
  Effect.gen(function* () {
    if (
      clock.settings.location === null ||
      clock.hour < clock.settings.proposalHour
    ) {
      return 'skipped' as const;
    }
    const logged = yield* wearLog.readDay(clock.today);
    if (logged.length > 0) {
      return 'decided' as const;
    }
    yield* proposalService.ensure(clock);
    return 'proposed' as const;
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logWarning(
        'The scheduled proposal did not go through.',
        error,
      ).pipe(Effect.as('failed' as const)),
    ),
  );
