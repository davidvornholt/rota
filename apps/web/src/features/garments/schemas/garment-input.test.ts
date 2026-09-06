import { expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  AcceptGarmentInputSchema,
  RetryStudioInputSchema,
  renderInstructionsLength,
  UpdateGarmentInputSchema,
} from './garment-input.ts';

const color = { hex: '#336699' };

it.each([
  { count: 0, valid: false },
  { count: 1, valid: true },
  { count: 5, valid: true },
  { count: 6, valid: false },
])(
  'validates $count colours when accepting and updating garments',
  ({ count, valid }) => {
    for (const input of [
      AcceptGarmentInputSchema,
      UpdateGarmentInputSchema,
      RetryStudioInputSchema,
    ]) {
      const schema = input.fields.edit.pipe(Schema.pick('colors'));
      expect(
        Schema.is(schema)({
          colors: Array.from({ length: count }, () => color),
        }),
      ).toBe(valid);
    }
  },
);

it('bounds render instructions and accepts an empty instruction', () => {
  const schema = RetryStudioInputSchema.pipe(Schema.pick('instructions'));
  expect(Schema.is(schema)({ instructions: '' })).toBe(true);
  expect(
    Schema.is(schema)({ instructions: 'x'.repeat(renderInstructionsLength) }),
  ).toBe(true);
  expect(
    Schema.is(schema)({
      instructions: 'x'.repeat(renderInstructionsLength + 1),
    }),
  ).toBe(false);
});
