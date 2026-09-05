/**
 * The garment vocabulary the browser needs too: slots, categories, budgets,
 * and the small total functions over them. No schemas live here, so a page can
 * import it without pulling the decoding machinery into the client bundle.
 */

export type Slot = 'bottom' | 'under' | 'top' | 'over';

/** Warmth and formality are both judged on a three-step scale. */
export const scaleMinimum = 1;
export const scaleMaximum = 3;
/** The most days in a row any garment may be worn before washing. */
export const longestWearBudget = 30;

/** Worn order, bottom up: the order an outfit is listed and a rota board is grouped. */
export const slotOrder: ReadonlyArray<Slot> = [
  'bottom',
  'under',
  'top',
  'over',
];

export const slotLabel: Readonly<Record<Slot, string>> = {
  bottom: 'Bottom',
  under: 'Under layer',
  top: 'Top',
  over: 'Over layer',
};

export type GarmentStatus = 'processing' | 'review' | 'active' | 'retired';

export type ImageChoice = 'studio' | 'original';

export type GarmentColor = {
  readonly name: string;
  readonly hex: string;
};

export const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof seasons)[number];

/**
 * The categories a garment can be filed under. Each carries the default wear
 * budget (days in a row before it goes to the wash) and the slots it can fill.
 * Settings may override the budgets; a garment may override its own.
 */
export const garmentCategories = [
  'trousers',
  'shorts',
  'shirt',
  't-shirt',
  'polo',
  'undershirt',
  'jumper',
  'cardigan',
  'hoodie',
  'overshirt',
] as const;

export type GarmentCategory = (typeof garmentCategories)[number];

export const categoryDefaults: Readonly<
  Record<
    GarmentCategory,
    { readonly budget: number; readonly slots: ReadonlyArray<Slot> }
  >
> = {
  trousers: { budget: 4, slots: ['bottom'] },
  shorts: { budget: 4, slots: ['bottom'] },
  shirt: { budget: 2, slots: ['top', 'over'] },
  't-shirt': { budget: 2, slots: ['top'] },
  polo: { budget: 2, slots: ['top'] },
  undershirt: { budget: 1, slots: ['under'] },
  jumper: { budget: 4, slots: ['over', 'top'] },
  cardigan: { budget: 4, slots: ['over'] },
  hoodie: { budget: 4, slots: ['over', 'top'] },
  overshirt: { budget: 3, slots: ['over'] },
};

export const isCategory = (value: string): value is GarmentCategory =>
  (garmentCategories as ReadonlyArray<string>).includes(value);

/** The wear budget in force for a garment, given the settings' category budgets. */
export const effectiveWearBudget = (
  garment: { readonly category: string; readonly wearBudget: number | null },
  categoryBudgets: Readonly<Record<string, number>>,
): number => {
  if (garment.wearBudget !== null) {
    return garment.wearBudget;
  }
  const configured = categoryBudgets[garment.category];
  if (configured !== undefined) {
    return configured;
  }
  return isCategory(garment.category)
    ? categoryDefaults[garment.category].budget
    : 2;
};
