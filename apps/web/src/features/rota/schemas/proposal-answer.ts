import { Schema } from 'effect';
import {
  type Slot,
  separateSlots,
  slotOrder,
} from '#/shared/data/garment-types.ts';

/**
 * What Bedrock answers with. Garments are named by the short aliases the prompt
 * introduced (C1, B2, T1 …), never by id: an alias is one token the model
 * cannot mistype, and the engine maps it back. Any slot may be null here; the
 * engine checks that the answer is a complete outfit.
 */
const slotAnswer = Schema.NullOr(Schema.String);
export const ProposalAnswerSchema = Schema.Struct({
  outfit: Schema.Struct({
    bottom: slotAnswer,
    under: slotAnswer,
    top: slotAnswer,
    dress: slotAnswer,
    over: slotAnswer,
    scarf: slotAnswer,
    hat: slotAnswer,
    shoes: slotAnswer,
    bag: slotAnswer,
  }),
  headline: Schema.String,
  reasons: Schema.Array(
    Schema.Struct({
      alias: Schema.String,
      reason: Schema.String,
    }),
  ),
});

export type ProposalAnswer = Schema.Schema.Type<typeof ProposalAnswerSchema>;

const alias = (description: string) => ({ type: 'string', description });
const optionalSlotDescription: Readonly<Partial<Record<Slot, string>>> = {
  under:
    " Choose only when useful for the outfit, weather or wearer's note; otherwise null.",
  over: " Choose only when useful for the outfit, weather or wearer's note; null when it would be too warm.",
  shoes:
    " Include suitable offered shoes; null only when unavailable or unsuitable for the weather, outfit or wearer's note.",
  bag: " Include a suitable offered bag; null only when unavailable or unsuitable for the weather, outfit or wearer's note.",
  dress:
    ' Choose a dress in place of a top and a bottom when it suits the weather, occasion and recent outfits; otherwise null.',
  scarf:
    " Choose only when the weather, outfit or wearer's note calls for one; otherwise null.",
  hat: " Choose only when the weather, outfit or wearer's note calls for one, such as a beanie in the cold or a cap in strong sun; otherwise null.",
};
const separateWithDressDescription =
  ' Null when a dress is chosen, unless the dress is worn over a top or with leggings.';

/**
 * A top and a bottom are required strings unless a dress is offered; then the
 * model picks either and the engine rejects an incomplete outfit.
 */
export const proposalAnswerJsonSchema = (
  aliases: ReadonlyMap<string, { readonly slot: Slot }>,
) => {
  const dressOffered = [...aliases.values()].some(
    (garment) => garment.slot === 'dress',
  );
  const forSlot = (slot: Slot) => {
    const choices = [...aliases]
      .filter(([, garment]) => garment.slot === slot)
      .map(([name]) => name);
    const separate = separateSlots.includes(slot);
    const optional = !separate || dressOffered;
    const optionalType = choices.length === 0 ? 'null' : ['string', 'null'];
    const guidance =
      separate && dressOffered
        ? separateWithDressDescription
        : (optionalSlotDescription[slot] ?? '');
    return {
      type: optional ? optionalType : 'string',
      enum: optional ? [...choices, null] : choices,
      description: `An offered alias for ${slot}, never a garment name.${guidance}`,
    };
  };
  return {
    type: 'object',
    properties: {
      outfit: {
        type: 'object',
        properties: {
          bottom: forSlot('bottom'),
          under: forSlot('under'),
          top: forSlot('top'),
          dress: forSlot('dress'),
          over: forSlot('over'),
          scarf: forSlot('scarf'),
          hat: forSlot('hat'),
          shoes: forSlot('shoes'),
          bag: forSlot('bag'),
        },
        required: [...slotOrder],
      },
      headline: alias(
        'One short sentence, second person, plain and specific, that opens the morning: what to keep, what is fresh, and the one reason. At most 90 characters. Example: "Keep the grey chinos; a fresh white shirt for the warmer afternoon."',
      ),
      reasons: {
        type: 'array',
        description:
          'One entry per garment in the outfit, in worn order, each with a reason of at most 80 characters written for the wearer.',
        items: {
          type: 'object',
          properties: {
            alias: {
              ...alias('The garment alias.'),
              enum: [...aliases.keys()],
            },
            reason: alias('Why this garment, today.'),
          },
          required: ['alias', 'reason'],
        },
      },
    },
    required: ['outfit', 'headline', 'reasons'],
  } as const;
};
