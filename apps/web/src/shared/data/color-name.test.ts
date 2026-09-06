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

it('rejects the removed name field in persisted and submitted colours', () => {
  expect(
    Schema.is(GarmentColorSchema)({
      name: 'Blue',
      hex: '#ff0000',
    }),
  ).toBe(false);
  expect(
    Schema.decodeUnknownSync(GarmentColorSchema)({
      hex: '#ff0000',
    }),
  ).toEqual({ hex: '#ff0000' });
});

it('rejects malformed colour values before naming', () => {
  expect(Schema.is(GarmentColorSchema)({ hex: '#xyzxyz' })).toBe(false);
  expect(Schema.is(GarmentColorSchema)({ hex: '#fff' })).toBe(false);
});
