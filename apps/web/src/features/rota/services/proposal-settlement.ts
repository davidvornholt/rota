/**
 * Writing the wearer's own outfit for a day, which settles any pending proposal
 * for it. Kept apart from generation so each half stays readable; the service
 * hands both the same repositories.
 */

import { Effect } from 'effect';
import type {
  DataReadError,
  DataWriteError,
  NotFoundError,
} from '#/shared/data/errors/data-errors.ts';
import type { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import type {
  Proposal,
  ProposalRepository,
} from '#/shared/data/proposal-repository.ts';
import type {
  OutfitEntry,
  WearLogRepository,
  WearSource,
} from '#/shared/data/wear-log-repository.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import type {
  ProposalAnswerError,
  ProposalGenerationError,
  ProposalStateError,
  SlotEmptyError,
} from '../errors/rota-errors.ts';
import type { ForecastService, ForecastWindow } from './forecast-service.ts';
import {
  dayLoggedMeanwhile,
  hasDistinctEntries,
  pieceChosenTwice,
} from './planning-rules.ts';
import type { GenerateOptions } from './proposal-service.ts';

/** Everything that can stop a proposal being made once the forecast is in hand. */
export type GenerateError =
  | ProposalStateError
  | SlotEmptyError
  | ProposalAnswerError
  | ProposalGenerationError
  | DataReadError
  | DataWriteError
  | NotFoundError;

export type SettlementDeps = {
  readonly outfits: OutfitRepository['Service'];
  readonly proposals: ProposalRepository['Service'];
  readonly wearLog: WearLogRepository['Service'];
  readonly forecasts: ForecastService['Service'];
  readonly generate: (
    clock: WardrobeClock,
    forecast: ForecastWindow,
    options: GenerateOptions,
  ) => Effect.Effect<Proposal, GenerateError>;
};

/**
 * The wearer's own word for a day: an override before confirming, a
 * backfill of a blank day, or a correction. A pending proposal for that day
 * is retired, because the day is decided.
 */
export const logOutfit = (
  { proposals, wearLog }: SettlementDeps,
  date: LocalDate,
  entries: ReadonlyArray<OutfitEntry>,
  source: WearSource,
) =>
  Effect.gen(function* () {
    if (!hasDistinctEntries(entries)) {
      return yield* pieceChosenTwice();
    }
    // A catch-up only fills a blank day. Checked under the operations gate,
    // so a day logged on another device since the prompt appeared is kept.
    if (source === 'backfill' && (yield* wearLog.readDay(date)).length > 0) {
      return yield* dayLoggedMeanwhile();
    }
    yield* wearLog.replaceDay(date, entries, source);
    const latest = yield* proposals.latestForDate(date);
    if (latest?.status === 'pending') {
      yield* proposals.setStatus(latest.id, 'superseded');
    }
  });
