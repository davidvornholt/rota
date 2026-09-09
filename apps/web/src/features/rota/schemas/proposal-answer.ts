import { Schema } from 'effect';
import type { Slot } from '#/shared/data/garment-types.ts';

/**
 * What Gemini answers with. Garments are named by the short aliases the prompt
 * introduced (C1, B2, T1 …), never by id: an alias is one token the model
 * cannot mistype, and the engine maps it back.
 */
export const ProposalAnswerSchema = Schema.Struct({
  outfit: Schema.Struct({
    bottom: Schema.String,
    under: Schema.NullOr(Schema.String),
    top: Schema.String,
    over: Schema.NullOr(Schema.String),
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
export const proposalAnswerJsonSchema = (
  aliases: ReadonlyMap<string, { readonly slot: Slot }>,
) => {
  const forSlot = (slot: Slot, optional: boolean) => {
    const choices = [...aliases]
      .filter(([, garment]) => garment.slot === slot)
      .map(([name]) => name);
    const optionalType = choices.length === 0 ? 'null' : ['string', 'null'];
    return {
      type: optional ? optionalType : 'string',
      enum: optional ? [...choices, null] : choices,
      description: `An offered alias for ${slot}, never a garment name.${optional ? ' Null omits this layer.' : ''}`,
    };
  };
  return {
    type: 'object',
    properties: {
      outfit: {
        type: 'object',
        properties: {
          bottom: forSlot('bottom', false),
          under: forSlot('under', true),
          top: forSlot('top', false),
          over: forSlot('over', true),
        },
        required: ['bottom', 'under', 'top', 'over'],
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
