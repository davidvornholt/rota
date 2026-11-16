import { expect, it } from 'bun:test';
import { structuredOutputProblems } from '#/shared/ai/structured-output-test-support.ts';
import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import { proposalAnswerJsonSchema } from './proposal-answer.ts';

const aliasesFor = (slots: ReadonlyArray<Slot>) =>
  new Map(slots.map((slot, index) => [`G${index + 1}`, { slot }]));

it.each([
  ['every slot offered, a dress among them', slotOrder],
  ['only separates offered', slotOrder.filter((slot) => slot !== 'dress')],
  ['only a top and a bottom offered', ['top', 'bottom'] as const],
])(
  'the outfit schema keeps to the structured-output subset with %s',
  (_case, slots) => {
    expect(
      structuredOutputProblems(proposalAnswerJsonSchema(aliasesFor(slots))),
    ).toEqual([]);
  },
);
