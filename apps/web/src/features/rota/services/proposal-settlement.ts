/**
 * Settling a proposal: confirming it into the log, asking again, or writing the
 * wearer's own outfit over it. Kept apart from generation so each half stays
 * readable; the service hands both the same repositories.
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
  readonly outfits: OutfitRepository;
  readonly proposals: ProposalRepository;
  readonly wearLog: WearLogRepository;
  readonly forecasts: ForecastService;
  readonly generate: (
    clock: WardrobeClock,
    forecast: ForecastWindow,
    options: GenerateOptions,
  ) => Effect.Effect<Proposal, GenerateError>;
};

/**
 * The wearer's own word for a day: an override before confirming, a
 * backfill, or a correction. A pending proposal for that day is retired,
 * because the day is decided.
 */
export const logOutfit = (
  { proposals, wearLog }: SettlementDeps,
  date: LocalDate,
  entries: ReadonlyArray<OutfitEntry>,
  source: WearSource,
) =>
  Effect.gen(function* () {
    yield* wearLog.replaceDay(date, entries, source);
    const latest = yield* proposals.latestForDate(date);
    if (latest?.status === 'pending') {
      yield* proposals.setStatus(latest.id, 'superseded');
    }
  });
