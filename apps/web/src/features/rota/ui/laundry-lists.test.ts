import { describe, expect, it } from 'bun:test';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  backFromLaundry,
  wearsStatus,
  wornSinceWashing,
} from './laundry-lists.ts';

/** A piece worn `wears` of `budget` times, last on `lastWornOn`. */
const piece = (
  name: string,
  [wears, budget]: readonly [number, number],
  lastWornOn: string | null,
  inLaundry = false,
) =>
  ({
    id: name,
    name,
    wearsSinceWash: wears,
    effectiveBudget: budget,
    inLaundry,
    lastWornOn: lastWornOn === null ? null : localDate(lastWornOn),
  }) as GarmentView;

describe('wornSinceWashing', () => {
  it('lists worn pieces outside the laundry, closest to the wash first', () => {
    const listed = wornSinceWashing([
      piece('clean', [0, 4], '2026-11-01'),
      piece('in laundry', [2, 2], '2026-11-20', true),
      piece('jeans', [3, 4], '2026-11-20'),
      piece('blazer', [3, 20], '2026-11-11'),
      piece('chinos', [3, 4], '2026-11-22'),
      piece('shirt', [1, 2], null),
    ]);
    expect(listed.map((garment) => garment.name)).toEqual([
      'chinos',
      'jeans',
      'shirt',
      'blazer',
    ]);
  });
});

describe('wearsStatus', () => {
  it('names the wears and, when known, the last day worn', () => {
    expect(wearsStatus(piece('chinos', [2, 4], '2026-11-22'))).toBe(
      '2 of 4 wears · last worn 22 Nov',
    );
    expect(wearsStatus(piece('shirt', [1, 2], null))).toBe('1 of 2 wears');
  });
});

describe('backFromLaundry', () => {
  it('lists unworn pieces Rota counted as back in the last week', () => {
    const back = (name: string, on: string | null, wears = 0) =>
      ({
        ...piece(name, [wears, 2], null),
        assumedCleanOn: on === null ? null : localDate(on),
      }) as GarmentView;
    const listed = backFromLaundry(
      [
        back('this week', '2026-11-19'),
        back('last month', '2026-11-18'),
        back('worn since', '2026-11-25', 1),
        back('never washed', null),
      ],
      localDate('2026-11-26'),
    );
    expect(listed.map((garment) => garment.name)).toEqual(['this week']);
  });
});
