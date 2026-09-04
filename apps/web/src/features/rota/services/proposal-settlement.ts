/**
 * Settling a proposal: confirming it into the log, asking again, or writing the
 * wearer's own outfit over it. Kept apart from generation so each half stays
 * readable; the service hands both the same repositories.
 */

import { Effect } from 'effect';
import type { GeminiError } from '#/shared/ai/errors/ai-errors.ts';
import type {
  DataReadError,
  DataWriteError,
  NotFoundError,
} from '#/shared/data/errors/data-errors.ts';
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
import {
  type ProposalAnswerError,
  ProposalStateError,
  type SlotEmptyError,
} from '../errors/rota-errors.ts';
import type { ForecastService, ForecastWindow } from './forecast-service.ts';
import type { GenerateOptions } from './proposal-service.ts';

/** Everything that can stop a proposal being made once the forecast is in hand. */
export type GenerateError =
  | SlotEmptyError
  | ProposalAnswerError
  | GeminiError
  | DataReadError
  | DataWriteError
  | NotFoundError;

export type RerollScope = 'boundary' | 'all';

export type SettlementDeps = {
  readonly proposals: ProposalRepository;
  readonly wearLog: WearLogRepository;
  readonly forecasts: ForecastService;
  readonly generate: (
    clock: WardrobeClock,
    forecast: ForecastWindow,
    options: GenerateOptions,
  ) => Effect.Effect<Proposal, GenerateError>;
};

const pendingOrFail = (proposal: Proposal) =>
  proposal.status === 'pending'
    ? Effect.succeed(proposal)
    : Effect.fail(
        new ProposalStateError(
          'That proposal has already been decided. Reload to see today.',
        ),
      );

/** One tap: the proposal becomes the day's log. */
export const confirm = ({ proposals, wearLog }: SettlementDeps, id: string) =>
  Effect.gen(function* () {
    const proposal = yield* pendingOrFail(yield* proposals.byId(id));
    yield* wearLog.replaceDay(
      proposal.forDate,
      proposal.payload.items.map((item) => ({
        garmentId: item.garmentId,
        slot: item.slot,
      })),
      'proposed',
    );
    yield* proposals.setStatus(id, 'confirmed');
  });

/**
 * Another suggestion. `boundary` re-picks only what the engine chose
 * freshly and keeps the rotation; `all` reopens every slot. Either way
 * the garments just turned down stay out for the rest of the day.
 */
export const reroll = (
  { proposals, forecasts, generate }: SettlementDeps,
  clock: WardrobeClock,
  id: string,
  scope: RerollScope,
) =>
  Effect.gen(function* () {
    const proposal = yield* pendingOrFail(yield* proposals.byId(id));
    if (proposal.forDate !== clock.today) {
      return yield* new ProposalStateError('That proposal is for another day.');
    }
    yield* proposals.setStatus(id, 'rejected');
    const turnedDown = proposal.payload.items
      .filter((item) => scope === 'all' || !item.continued)
      .map((item) => item.garmentId);
    const excluded = new Set([
      ...proposal.payload.excludedGarmentIds,
      ...turnedDown,
    ]);
    const forecast = yield* forecasts.ensure(clock.settings, clock.today);
    return yield* generate(clock, forecast, {
      excluded,
      releaseAll: scope === 'all',
    });
  });

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
