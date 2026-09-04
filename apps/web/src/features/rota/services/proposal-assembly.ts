/**
 * The pure steps between the engine and the model: summarising recent days for
 * the prompt, and turning the model's aliased answer back into garment ids.
 */

import { Effect, Either } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import {
  effectiveWearBudget,
  type Slot,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { ProposalItem } from '#/shared/data/proposal-repository.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { addDays, type LocalDate } from '#/shared/time/local-date.ts';
import { ProposalAnswerError } from '../errors/rota-errors.ts';
import { consecutiveWears, type RotationInput } from '../rotation.ts';
import type { ProposalAnswer } from '../schemas/proposal-answer.ts';
import type { AliasedGarment, RecentDay } from './proposal-prompt.ts';

export const requiredSlots: ReadonlySet<Slot> = new Set(['bottom', 'top']);
const recentDays = 14;

/** The last two weeks of the log as named outfits, oldest first. */
export const recentSummary = (
  log: ReadonlyArray<WearEntry>,
  garments: ReadonlyArray<Garment>,
  today: LocalDate,
): ReadonlyArray<RecentDay> => {
  const names = new Map(garments.map((garment) => [garment.id, garment.name]));
  const from = addDays(today, -recentDays);
  const byDay = new Map<LocalDate, Array<string>>();
  for (const entry of log.filter(
    (candidate) => candidate.wornOn >= from && candidate.wornOn < today,
  )) {
    const list = byDay.get(entry.wornOn) ?? [];
    list.push(names.get(entry.garmentId) ?? 'unknown garment');
    byDay.set(entry.wornOn, list);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([date, list]) => ({ date, names: list }));
};

type Pick = {
  readonly slot: Slot;
  readonly alias: string;
  readonly aliased: AliasedGarment;
  readonly reason: string;
};

const itemFor = (
  { slot, alias, aliased, reason }: Pick,
  input: RotationInput,
): ProposalItem => ({
  garmentId: aliased.garment.id,
  slot,
  continued: aliased.continuation !== undefined,
  dayOfBudget:
    aliased.continuation?.dayOfBudget ??
    consecutiveWears(input.log, aliased.garment.id, input.today) + 1,
  budget: effectiveWearBudget(aliased.garment, input.settings.categoryBudgets),
  reason: reason === '' ? `Chosen as ${alias}.` : reason,
});

/**
 * Resolves the model's aliases to garments, one per slot in worn order. A
 * required slot left empty, an alias the prompt never offered, or a garment
 * named twice all make the answer unusable.
 */
export const answerToItems = (
  answer: ProposalAnswer,
  aliases: ReadonlyMap<string, AliasedGarment>,
  input: RotationInput,
): Effect.Effect<ReadonlyArray<ProposalItem>, ProposalAnswerError> => {
  const reasons = new Map(
    answer.reasons.map((entry) => [entry.alias, entry.reason] as const),
  );
  const used = new Set<string>();
  const resolved = slotOrder.map(
    (slot): Either.Either<ProposalItem | undefined, string> => {
      const alias = answer.outfit[slot];
      if (alias === null) {
        return requiredSlots.has(slot)
          ? Either.left(`No garment for ${slot}.`)
          : Either.right(undefined);
      }
      const aliased = aliases.get(alias);
      if (aliased === undefined || used.has(aliased.garment.id)) {
        return Either.left(`Unknown or repeated alias ${alias}.`);
      }
      used.add(aliased.garment.id);
      return Either.right(
        itemFor(
          { slot, alias, aliased, reason: reasons.get(alias) ?? '' },
          input,
        ),
      );
    },
  );
  return Either.all(resolved).pipe(
    Either.mapLeft((problem) => new ProposalAnswerError(problem)),
    Either.map((items) =>
      items.filter((item): item is ProposalItem => item !== undefined),
    ),
    Either.match({ onLeft: Effect.fail, onRight: Effect.succeed }),
  );
};
