import { describe, expect, it } from 'bun:test';
import {
  categoryGroups,
  categoryName,
  garmentCategories,
  hasWearBudget,
  isCompleteOutfit,
} from './garment-types.ts';

describe('garment vocabulary', () => {
  it('accepts a top and a bottom, or a dress, as a complete outfit', () => {
    expect(isCompleteOutfit(['bottom', 'top'])).toBe(true);
    expect(isCompleteOutfit(['dress'])).toBe(true);
    expect(isCompleteOutfit(['dress', 'over', 'hat'])).toBe(true);
    expect(isCompleteOutfit(['top', 'over'])).toBe(false);
    expect(isCompleteOutfit(['bottom', 'shoes', 'scarf'])).toBe(false);
  });

  it('gives clothes a wear allowance but not accessories', () => {
    for (const category of ['dress', 'skirt', 'jumper', 'something new']) {
      expect(hasWearBudget({ category })).toBe(true);
    }
    for (const category of ['shoes', 'handbag', 'cap', 'beanie', 'scarf']) {
      expect(hasWearBudget({ category })).toBe(false);
    }
  });

  it('lists every category in exactly one group', () => {
    const grouped = categoryGroups.flatMap((group) => group.categories);
    expect([...grouped].sort()).toEqual([...garmentCategories].sort());
  });

  it('names categories for people, keeping unknown ones as entered', () => {
    expect(categoryName('t-shirt')).toBe('T-shirt');
    expect(categoryName('beanie')).toBe('Beanie');
    expect(categoryName('kimono')).toBe('kimono');
  });
});
