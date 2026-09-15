/** A day's outfit as the editor holds it: a garment id per slot, or nothing. */

import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';

export type Choice = Partial<Record<Slot, string>>;

export type DayEntries = ReadonlyArray<{
  readonly garmentId: string;
  readonly slot: Slot;
}>;

export const entriesOf = (choice: Choice): DayEntries =>
  slotOrder.flatMap((slot) => {
    const garmentId = choice[slot];
    return garmentId === undefined || garmentId === ''
      ? []
      : [{ garmentId, slot }];
  });

export const sameChoice = (left: Choice, right: Choice) =>
  slotOrder.every((slot) => (left[slot] ?? '') === (right[slot] ?? ''));

export const isBlank = (choice: Choice) => entriesOf(choice).length === 0;
