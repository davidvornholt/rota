import { Schema } from 'effect';

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
const optionalAlias = (description: string) => ({
  type: ['string', 'null'],
  description,
});

export const proposalAnswerJsonSchema = {
  type: 'object',
  properties: {
    outfit: {
      type: 'object',
      properties: {
        bottom: alias('Alias of the garment for the bottom slot.'),
        under: optionalAlias(
          'Alias of the under layer, or null when the day needs none or none was offered.',
        ),
        top: alias('Alias of the garment for the top slot.'),
        over: optionalAlias(
          'Alias of the over layer, or null when the day needs none or none was offered.',
        ),
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
          alias: alias('The garment alias.'),
          reason: alias('Why this garment, today.'),
        },
        required: ['alias', 'reason'],
      },
    },
  },
  required: ['outfit', 'headline', 'reasons'],
} as const;
