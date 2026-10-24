/** A day's outfit as the editor holds it: a garment id per slot, or nothing. */

import {
  type Slot,
  separateSlots,
  slotOrder,
} from '#/shared/data/garment-types.ts';

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

/** The slots worth offering for a day: those the wardrobe can fill, and any already logged. */
export const slotsToLog = (
  candidates: Readonly<Record<Slot, ReadonlyArray<unknown>>>,
  choice: Choice,
): ReadonlyArray<Slot> =>
  slotOrder.filter(
    (slot) => candidates[slot].length > 0 || (choice[slot] ?? '') !== '',
  );

/** Whether leaving the slot empty leaves the outfit unrecorded: a top and a bottom, unless a dress was worn. */
export const isExpected = (choice: Choice, slot: Slot): boolean =>
  separateSlots.includes(slot) && (choice.dress ?? '') === '';
