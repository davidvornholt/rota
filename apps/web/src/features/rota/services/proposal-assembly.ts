/**
 * The pure steps between the engine and the model: summarising recent days for
 * the prompt, and turning the model's aliased answer back into garment ids.
 */

import { Effect, Result } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import { garmentCare } from '#/shared/data/garment-care.ts';
import {
  effectiveWearBudget,
  isCompleteOutfit,
  type Slot,
  separateSlots,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { ProposalItem } from '#/shared/data/proposal-repository.ts';
import type {
  OutfitEntry,
  WearEntry,
} from '#/shared/data/wear-log-repository.ts';
import { addDays, type LocalDate } from '#/shared/time/local-date.ts';
import { ProposalAnswerError } from '../errors/rota-errors.ts';
import {
  type Continuation,
  candidatesFor,
  outfitOn,
  type RotationInput,
} from '../rotation.ts';
import type { ProposalAnswer } from '../schemas/proposal-answer.ts';
import type {
  AliasedGarment,
  RecentDay,
  SlotChoices,
} from './proposal-prompt.ts';

const recentDays = 14;

/**
 * Alternatives for every slot, including those with a rotation preference. A
 * top and a bottom are required unless a dress is offered to take their place.
 * A required slot that only today's turned-down garments could fill gets them
 * back rather than failing: the wearer asked for another suggestion, and the
 * rest of the outfit can still change around the one garment there is no
 * alternative to. When no other dress is available and the top and bottom
 * cannot both be filled, even by turned-down, continuing or pinned garments,
 * today's turned-down dresses come back instead as the required piece.
 */
export const slotChoicesFor = (
  input: RotationInput,
  continuing: ReadonlyArray<Continuation>,
  pinned: ReadonlyArray<OutfitEntry>,
): ReadonlyArray<SlotChoices> => {
  const chosen = new Set(continuing.map((c) => c.garment.id));
  const withTurnedDown = (slot: Slot) =>
    candidatesFor({ ...input, excluded: new Set() }, slot, chosen);
  const freshDress = candidatesFor(input, 'dress', chosen).length > 0;
  const separatesFit = separateSlots.every(
    (slot) =>
      continuing.some((c) => c.slot === slot) ||
      pinned.some((pin) => pin.slot === slot) ||
      withTurnedDown(slot).length > 0,
  );
  const turnedDownDresses =
    freshDress || separatesFit ? [] : withTurnedDown('dress');
  const dressOffered = freshDress || turnedDownDresses.length > 0;
  return slotOrder.map((slot) => {
    if (slot === 'dress' && turnedDownDresses.length > 0) {
      return {
        slot,
        required: true,
        candidates: turnedDownDresses,
        turnedDownOnly: true,
      };
    }
    const required = !dressOffered && separateSlots.includes(slot);
    const candidates = candidatesFor(input, slot, chosen);
    if (
      candidates.length > 0 ||
      !required ||
      input.excluded.size === 0 ||
      continuing.some((c) => c.slot === slot)
    ) {
      return { slot, required, candidates, turnedDownOnly: false };
    }
    const turnedDown = withTurnedDown(slot);
    return {
      slot,
      required,
      candidates: turnedDown,
      turnedDownOnly: turnedDown.length > 0,
    };
  });
};

/** The last two weeks of the log as named outfits, oldest first. */
export const recentSummary = (
  log: ReadonlyArray<WearEntry>,
  garments: ReadonlyArray<Garment>,
  today: LocalDate,
): ReadonlyArray<RecentDay> => {
  const names = new Map(garments.map((garment) => [garment.id, garment.name]));
  const from = addDays(today, -recentDays);
  const recent = log.filter(
    (entry) => entry.wornOn >= from && entry.wornOn < today,
  );
  return [...new Set(recent.map((entry) => entry.wornOn))]
    .sort((left, right) => (left < right ? -1 : 1))
    .map((date) => {
      const outfit = outfitOn(recent, date);
      return {
        date,
        pieces: slotOrder.flatMap((slot) => {
          const id = outfit[slot];
          return id === undefined
            ? []
            : [{ slot, name: names.get(id) ?? 'unknown garment' }];
        }),
      };
    });
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
    garmentCare(aliased.garment, input.log, input.today, input.settings)
      .wearsSinceWash + 1,
  budget: effectiveWearBudget(aliased.garment, input.settings.categoryBudgets),
  reason: reason === '' ? `Chosen as ${alias}.` : reason,
});

/**
 * Resolves the model's aliases to garments, one per slot in worn order. An
 * alias the prompt never offered, a garment named twice, or an outfit without
 * a top and a bottom or a dress all make the answer unusable.
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
    (slot): Result.Result<ProposalItem | undefined, string> => {
      const alias = answer.outfit[slot];
      if (alias === null) {
        return Result.succeed(undefined);
      }
      const aliased = aliases.get(alias);
      if (
        aliased === undefined ||
        aliased.slot !== slot ||
        used.has(aliased.garment.id)
      ) {
        return Result.fail(`Unknown, wrong-slot or repeated alias ${alias}.`);
      }
      used.add(aliased.garment.id);
      return Result.succeed(
        itemFor(
          { slot, alias, aliased, reason: reasons.get(alias) ?? '' },
          input,
        ),
      );
    },
  );
  return Result.all(resolved).pipe(
    Result.map((items) =>
      items.filter((item): item is ProposalItem => item !== undefined),
    ),
    Result.flatMap((items) =>
      isCompleteOutfit(items.map((item) => item.slot))
        ? Result.succeed(items)
        : Result.fail('No top and bottom, and no dress.'),
    ),
    Result.mapError((problem) => new ProposalAnswerError(problem)),
    Result.match({ onFailure: Effect.fail, onSuccess: Effect.succeed }),
  );
};

export const choicesWithPins = (
  input: RotationInput,
  continuing: ReadonlyArray<Continuation>,
  pinned: ReadonlyArray<OutfitEntry>,
): ReadonlyArray<SlotChoices> => {
  const pinnedIds = new Set(pinned.map((pin) => pin.garmentId));
  // A kept dress already completes the outfit.
  const dressPinned = pinned.some((pin) => pin.slot === 'dress');
  return slotChoicesFor(input, continuing, pinned).map((choice) => {
    const pin = pinned.find((entry) => entry.slot === choice.slot);
    return pin === undefined
      ? {
          ...choice,
          required: choice.required && !dressPinned,
          candidates: choice.candidates.filter(
            (candidate) => !pinnedIds.has(candidate.garment.id),
          ),
        }
      : {
          ...choice,
          required: true,
          candidates: input.garments
            .filter(
              (garment) =>
                garment.id === pin.garmentId &&
                !garmentCare(garment, input.log, input.today, input.settings)
                  .inLaundry,
            )
            .map((garment) => ({
              garment,
              wearsSinceWash: garmentCare(
                garment,
                input.log,
                input.today,
                input.settings,
              ).wearsSinceWash,
              daysSinceWorn: null,
              inCooldown: false,
            })),
        };
  });
};
