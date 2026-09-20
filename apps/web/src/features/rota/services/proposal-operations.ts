import { Effect } from 'effect';
import type { DayPlan } from '#/shared/data/outfit.ts';
import type {
  OutfitEntry,
  WearSource,
} from '#/shared/data/wear-log-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  ProposalGenerationError,
  ProposalStateError,
} from '../errors/rota-errors.ts';
import { logOutfit, type SettlementDeps } from './proposal-settlement.ts';

const wearSelected = (
  deps: SettlementDeps,
  date: LocalDate,
  entries: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const latest = yield* deps.proposals.latestForDate(date);
    const accepted =
      latest?.status === 'pending' &&
      entries.length === latest.payload.items.length &&
      entries.every((entry) =>
        latest.payload.items.some(
          (item) =>
            item.slot === entry.slot && item.garmentId === entry.garmentId,
        ),
      );
    yield* deps.wearLog.replaceDay(
      date,
      entries,
      accepted ? 'proposed' : 'override',
    );
    if (latest?.status === 'pending') {
      yield* deps.proposals.setStatus(
        latest.id,
        accepted ? 'confirmed' : 'superseded',
      );
    }
  });

/** State checks and writes share one gate with the scheduled morning decision. */
export const makeProposalOperations = (deps: SettlementDeps) =>
  Effect.gen(function* () {
    const gate = yield* Effect.makeSemaphore(1);
    const exclusive = <A, E, R>(work: Effect.Effect<A, E, R>) =>
      gate
        .withPermits(1)(work)
        .pipe(
          Effect.timeoutFail({
            duration: '360 seconds',
            onTimeout: () => new ProposalGenerationError(true, undefined),
          }),
        );

    const ensure = (clock: WardrobeClock) =>
      Effect.gen(function* () {
        const latest = yield* deps.proposals.latestForDate(clock.today);
        if ((yield* deps.outfits.plan(clock.today)).entries !== null) {
          return latest;
        }
        if (latest?.status === 'pending' || latest?.status === 'confirmed') {
          return latest;
        }
        if ((yield* deps.wearLog.readDay(clock.today)).length > 0) {
          return yield* new ProposalStateError(
            "Today's outfit is already logged. Refresh to see it.",
          );
        }
        const forecast = yield* deps.forecasts.ensure(
          clock.settings,
          clock.today,
          clock.actualToday,
        );
        return yield* deps.generate(clock, forecast, {
          pinned: [],
          excluded: new Set(latest?.payload.excludedGarmentIds ?? []),
          releaseAll: false,
          rejectedProposalId: null,
        });
      });

    return {
      savePlan: (
        clock: WardrobeClock,
        plan: Pick<DayPlan, 'entries' | 'basedOn' | 'forecast'>,
      ) =>
        exclusive(
          Effect.gen(function* () {
            if ((yield* deps.wearLog.readDay(clock.today)).length > 0) {
              return yield* new ProposalStateError(
                'This day is already logged. Edit it in history.',
              );
            }
            yield* deps.outfits.savePlan(clock.today, plan);
          }),
        ),
      complete: (clock: WardrobeClock, pinned: ReadonlyArray<OutfitEntry>) =>
        exclusive(
          Effect.gen(function* () {
            if ((yield* deps.wearLog.readDay(clock.today)).length > 0) {
              return yield* new ProposalStateError(
                'This day is already logged. Edit it in history.',
              );
            }
            const forecast = yield* deps.forecasts.ensure(
              clock.settings,
              clock.today,
              clock.actualToday,
            );
            const latest = yield* deps.proposals.latestForDate(clock.today);
            const pinnedIds = new Set(pinned.map((entry) => entry.garmentId));
            const excluded = new Set(
              [
                ...(latest?.payload.excludedGarmentIds ?? []),
                ...(latest?.payload.items.map((entry) => entry.garmentId) ??
                  []),
              ].filter((id) => !pinnedIds.has(id)),
            );
            return yield* deps.generate(clock, forecast, {
              pinned,
              excluded,
              releaseAll: true,
              rejectedProposalId:
                latest?.status === 'pending' ? latest.id : null,
            });
          }),
        ),
      ensure: (clock: WardrobeClock) => exclusive(ensure(clock)),
      wear: (clock: WardrobeClock, entries: ReadonlyArray<OutfitEntry>) =>
        exclusive(
          Effect.gen(function* () {
            if (
              clock.today !== clock.actualToday ||
              (yield* deps.wearLog.readDay(clock.today)).length > 0
            ) {
              return yield* new ProposalStateError(
                'Only an unlogged outfit for today can be worn. Edit logged days in history.',
              );
            }
            yield* wearSelected(deps, clock.today, entries);
          }),
        ),
      logOutfit: (
        date: LocalDate,
        entries: ReadonlyArray<OutfitEntry>,
        source: WearSource,
      ) => exclusive(logOutfit(deps, date, entries, source)),
    };
  });
