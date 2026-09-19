/**
 * The Today service's two side rooms: the alternatives strip for one slot, and
 * the scheduler's tick. Both take the service's own helpers as dependencies.
 */

import { Effect } from 'effect';
import type { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import type { ProposalService } from './proposal-service.ts';

export type TickDeps = {
  readonly wearLog: WearLogRepository;
  readonly proposalService: ProposalService;
};

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
