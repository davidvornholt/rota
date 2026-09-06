import { expect, it } from 'bun:test';
import { Schema } from 'effect';
import { colorName } from './color-name.ts';
import { GarmentColorSchema } from './garment.ts';

it.each([
  ['#000000', 'Black'],
  ['#ffffff', 'White'],
  ['#818180', 'Grey'],
  ['#112233', 'Navy'],
  ['#ff0000', 'Red'],
  ['#808001', 'Olive'],
  ['#F5F0E6', 'Off-white'],
])('names %s by its nearest wardrobe colour', (hex, name) => {
  expect(colorName(hex)).toBe(name);
});

it('discards stored names and derives the label from the validated value', () => {
  const color = Schema.decodeUnknownSync(GarmentColorSchema)({
    name: 'Blue',
    hex: '#ff0000',
  });
  expect(color).toEqual({ hex: '#ff0000' });
  expect(colorName(color.hex)).toBe('Red');
});

it('rejects malformed colour values before naming', () => {
  expect(Schema.is(GarmentColorSchema)({ hex: '#xyzxyz' })).toBe(false);
  expect(Schema.is(GarmentColorSchema)({ hex: '#fff' })).toBe(false);
});
