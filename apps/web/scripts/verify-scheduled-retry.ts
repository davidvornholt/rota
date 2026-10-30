// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { suggestPlanning } from '#/features/rota/services/planning-service.ts';
import { scheduledAttemptsPerDay } from '#/features/rota/services/proposal-backoff.ts';
import { ProposalService } from '#/features/rota/services/proposal-service.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import { addDays } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

// Far enough ahead that no earlier check planned or proposed this day.
const unplannedDayOffset = 30;

/**
 * A failed scheduled proposal is stored in PostgreSQL and holds back the next
 * scheduled attempt; the wearer's own request still runs and clears it, and
 * another day starts fresh.
 */
export const verifyScheduledRetry = (
  baseClock: WardrobeClock,
  failModel: (failing: boolean) => void,
) =>
  Effect.gen(function* () {
    const proposals = yield* ProposalRepository;
    const service = yield* ProposalService;
    const day = addDays(baseClock.today, unplannedDayOffset);
    const clock = { ...baseClock, today: day, actualToday: day };
    const nextDay = addDays(day, 1);
    failModel(true);
    const failed = yield* Effect.result(service.ensure(clock));
    assert.equal(failed._tag, 'Failure');
    const stored = yield* proposals.scheduledFailures();
    assert(stored !== undefined, 'A failed scheduled attempt is stored.');
    assert.equal(stored.forDate, clock.today);
    assert.equal(stored.failures, 1);
    assert.equal(
      yield* service.ensure(clock),
      'waiting',
      'The next scheduled attempt waits.',
    );
    const exhausted = { ...stored, failures: scheduledAttemptsPerDay };
    yield* proposals.saveScheduledFailures(exhausted);
    assert.equal(
      (yield* proposals.scheduledFailures())?.failures,
      scheduledAttemptsPerDay,
    );
    failModel(false);
    yield* suggestPlanning(clock, []);
    assert.equal(
      yield* proposals.scheduledFailures(),
      undefined,
      "The wearer's own request runs after the last scheduled attempt and clears the backoff.",
    );
    yield* proposals.saveScheduledFailures(exhausted);
    yield* proposals.clearScheduledFailures(nextDay);
    assert.equal(
      (yield* proposals.scheduledFailures())?.failures,
      scheduledAttemptsPerDay,
      'A proposal for another day leaves this day’s backoff alone.',
    );
    yield* proposals.saveScheduledFailures({
      forDate: nextDay,
      failures: 1,
      lastFailedAt: new Date(),
    });
    assert.equal(
      (yield* proposals.scheduledFailures())?.forDate,
      nextDay,
      'The first failure of a new day replaces the earlier day’s row.',
    );
    yield* proposals.clearScheduledFailures(nextDay);
  });
