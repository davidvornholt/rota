import { Clock, Effect, Semaphore } from 'effect';
import type { DayPlan } from '#/shared/data/outfit.ts';
import type { ScheduledFailures } from '#/shared/data/proposal-repository.ts';
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
import type { ForecastWindow } from './forecast-service.ts';
import {
  afterFailure,
  scheduledAttempt,
  scheduledAttemptsPerDay,
} from './proposal-backoff.ts';
import type { GenerateOptions } from './proposal-service.ts';
import { logOutfit, type SettlementDeps } from './proposal-settlement.ts';

const now = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

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

/** Any proposal made for a day ends the scheduler's backoff for that day. */
const generate = (
  deps: SettlementDeps,
  clock: WardrobeClock,
  forecast: ForecastWindow,
  options: GenerateOptions,
) =>
  deps
    .generate(clock, forecast, options)
    .pipe(
      Effect.tap(() =>
        deps.proposals
          .clearScheduledFailures(clock.today)
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning(
                'The scheduled proposal backoff could not be cleared.',
                error,
              ),
            ),
          ),
      ),
    );

const countFailure = (
  deps: SettlementDeps,
  state: ScheduledFailures | undefined,
  today: LocalDate,
) =>
  Effect.gen(function* () {
    const next = afterFailure(state, today, yield* now);
    yield* deps.proposals.saveScheduledFailures(next);
    if (next.failures >= scheduledAttemptsPerDay) {
      yield* Effect.logWarning(
        'The scheduled proposal failed too often today; it waits for the wearer to ask.',
      );
    }
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning(
        'The failed scheduled proposal could not be counted.',
        error,
      ),
    ),
  );

/**
 * One scheduled attempt at the day's proposal, unless today's earlier
 * failures hold it back (see `proposal-backoff.ts`). A failure is counted
 * inside the gate, so an attempt queued behind this one sees it, and is
 * counted too when the gate's timeout cuts the attempt off.
 */
const scheduledGeneration = (
  deps: SettlementDeps,
  clock: WardrobeClock,
  excluded: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const failures = yield* deps.proposals.scheduledFailures();
    if (scheduledAttempt(failures, clock.today, yield* now) !== 'due') {
      return 'waiting' as const;
    }
    yield* deps.forecasts
      .ensure(clock.settings, clock.today, clock.actualToday)
      .pipe(
        Effect.flatMap((forecast) =>
          generate(deps, clock, forecast, {
            pinned: [],
            excluded: new Set(excluded),
            releaseAll: false,
            rejectedProposalId: null,
          }),
        ),
        Effect.onError(() => countFailure(deps, failures, clock.today)),
      );
    return 'proposed' as const;
  });

/** State checks and writes share one gate with the scheduled morning decision. */
export const makeProposalOperations = (deps: SettlementDeps) =>
  Effect.gen(function* () {
    const gate = yield* Semaphore.make(1);
    const exclusive = <A, E, R>(work: Effect.Effect<A, E, R>) =>
      gate
        .withPermits(1)(work)
        .pipe(
          Effect.timeoutOrElse({
            duration: '360 seconds',
            orElse: () =>
              Effect.fail(new ProposalGenerationError(true, undefined)),
          }),
        );

    /** The scheduler's morning decision. */
    const ensure = (clock: WardrobeClock) =>
      Effect.gen(function* () {
        const latest = yield* deps.proposals.latestForDate(clock.today);
        if ((yield* deps.outfits.plan(clock.today)).entries !== null) {
          return 'proposed' as const;
        }
        if (latest?.status === 'pending' || latest?.status === 'confirmed') {
          return 'proposed' as const;
        }
        if ((yield* deps.wearLog.readDay(clock.today)).length > 0) {
          return yield* new ProposalStateError(
            "Today's outfit is already logged. Refresh to see it.",
          );
        }
        return yield* scheduledGeneration(
          deps,
          clock,
          latest?.payload.excludedGarmentIds ?? [],
        );
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
            return yield* generate(deps, clock, forecast, {
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
