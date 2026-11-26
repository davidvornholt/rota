import { describe, expect, it } from 'bun:test';
import { Effect, Result } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import { changedEdit } from './changed-edit.ts';

const stored: Garment = {
  id: 'overshirt',
  revision: 3,
  status: 'active',
  name: 'Off-white cotton overshirt',
  category: 'overshirt',
  subcategory: '',
  slots: ['over'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: 4,
  colors: [{ hex: '#F0EFEA' }],
  pattern: 'solid',
  material: 'cotton',
  fit: '',
  sleeve: '',
  brand: '',
  notes: 'Wear open',
  price: 40,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  washedOn: null,
  washedAfterWear: false,
  laundryStartedOn: null,
  laundryReadyOn: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date(),
  images: {},
};

const edit = (changes: Parameters<typeof changedEdit>[1]) =>
  Effect.runSync(Effect.result(changedEdit(stored, changes)));

const success = (changes: Parameters<typeof changedEdit>[1]) =>
  Result.getOrThrow(edit(changes));

describe('changedEdit', () => {
  it('changes only the given fields and keeps the rest as stored', () => {
    expect(success({ slots: ['top', 'over'] })).toMatchObject({
      name: 'Off-white cotton overshirt',
      slots: ['top', 'over'],
      wearBudget: 4,
      colors: [{ hex: '#F0EFEA' }],
      notes: 'Wear open',
      price: 40,
    });
  });

  it('takes hex colours and null for a cleared field', () => {
    expect(
      success({ colors: ['#3B2A22'], wearBudget: null, price: null }),
    ).toMatchObject({
      colors: [{ hex: '#3B2A22' }],
      wearBudget: null,
      price: null,
    });
  });

  it('rejects a change the form would refuse, with the reason', () => {
    const refused = [
      { warmth: 4 },
      { category: 'cape' },
      { slots: [] },
      { colors: ['brown'] },
    ].map((changes) =>
      Result.match(edit(changes as Parameters<typeof changedEdit>[1]), {
        onSuccess: () => undefined,
        onFailure: (failure) => failure,
      }),
    );
    for (const failure of refused) {
      expect(failure?.httpStatus).toBe(400);
      expect(failure?.message).toStartWith('Invalid garment: ');
    }
  });
});
