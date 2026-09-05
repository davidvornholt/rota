import { expect, it } from 'bun:test';
import { Schema } from 'effect';

import { GarmentFromRow } from '#/shared/data/garment.ts';
import { ExtractionSchema } from './extraction.ts';
import { GarmentEditSchema } from './garment-input.ts';

const schemas = [
  GarmentFromRow.pipe(Schema.pick('warmth', 'formality')),
  ExtractionSchema.pipe(Schema.pick('warmth', 'formality')),
  GarmentEditSchema.pipe(Schema.pick('warmth', 'formality')),
];

it.each([
  { value: 1, valid: true },
  { value: 2, valid: true },
  { value: 3, valid: true },
  { value: 0, valid: false },
  { value: 4, valid: false },
  { value: 5, valid: false },
  { value: 1.5, valid: false },
  { value: '2', valid: false },
])(
  'validates rating $value at database, extraction, and edit boundaries',
  ({ value, valid }) => {
    for (const schema of schemas) {
      expect(Schema.is(schema)({ warmth: value, formality: 2 })).toBe(valid);
      expect(Schema.is(schema)({ warmth: 2, formality: value })).toBe(valid);
    }
  },
);
