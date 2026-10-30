/**
 * The Today service's two side rooms: the alternatives strip for one slot, and
 * the scheduler's tick. Both take the service's own helpers as dependencies.
 */

import { Effect } from 'effect';
import type { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import type { ProposalService } from './proposal-service.ts';

export type TickDeps = {
  readonly garments: Pick<GarmentRepository['Service'], 'list'>;
  readonly wearLog: Pick<WearLogRepository['Service'], 'readDay'>;
  readonly proposalService: Pick<ProposalService['Service'], 'ensure'>;
};

/**
 * The clock's question. Once the proposal hour has passed and the day has
 * no proposal, one is made; a day already decided or already proposed is
 * left alone, and so is a wardrobe with nothing active to propose. Failures
 * are logged, never thrown. After a failure the proposal service holds back
 * further scheduled attempts, waiting longer each time and stopping for the
 * day after a few; the tick then reports `waiting` rather than paying a
 * failing model every minute.
 */
export const tick = (
  { garments, wearLog, proposalService }: TickDeps,
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
    const all = yield* garments.list();
    if (!all.some((garment) => garment.status === 'active')) {
      return 'skipped' as const;
    }
    return yield* proposalService.ensure(clock);
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning(
        'The scheduled proposal did not go through.',
        error,
      ).pipe(Effect.as('failed' as const)),
    ),
  );
