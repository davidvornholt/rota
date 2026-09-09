import { Effect } from 'effect';
import type {
  OutfitEntry,
  WearSource,
} from '#/shared/data/wear-log-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';
import {
  confirm,
  logOutfit,
  type RerollScope,
  reroll,
  type SettlementDeps,
  saveOccasion,
} from './proposal-settlement.ts';

/** State checks and writes share one gate with the scheduled morning decision. */
export const makeProposalOperations = (deps: SettlementDeps) =>
  Effect.gen(function* () {
    const gate = yield* Effect.makeSemaphore(1);
    const exclusive = <A, E, R>(work: Effect.Effect<A, E, R>) =>
      gate
        .withPermits(1)(work)
        .pipe(
          Effect.timeoutFail({
            duration: '180 seconds',
            onTimeout: () =>
              new ProposalStateError(
                'Choosing an outfit took too long. Please try again.',
              ),
          }),
        );

    const ensure = (clock: WardrobeClock) =>
      Effect.gen(function* () {
        const latest = yield* deps.proposals.latestForDate(clock.today);
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
        );
        return yield* deps.generate(clock, forecast, {
          excluded: new Set(latest?.payload.excludedGarmentIds ?? []),
          releaseAll: false,
        });
      });

    return {
      ensure: (clock: WardrobeClock) => exclusive(ensure(clock)),
      confirm: (id: string) => exclusive(confirm(deps, id)),
      saveOccasion: (clock: WardrobeClock, occasion: string) =>
        exclusive(saveOccasion(deps, clock, occasion)),
      reroll: (clock: WardrobeClock, id: string, scope: RerollScope) =>
        exclusive(reroll(deps, clock, id, scope)),
      logOutfit: (
        date: LocalDate,
        entries: ReadonlyArray<OutfitEntry>,
        source: WearSource,
      ) => exclusive(logOutfit(deps, date, entries, source)),
    };
  });
