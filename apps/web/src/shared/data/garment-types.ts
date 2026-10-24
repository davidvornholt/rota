/**
 * The garment vocabulary the browser needs too: slots, categories, budgets,
 * and the small total functions over them. No schemas live here, so a page can
 * import it without pulling the decoding machinery into the client bundle.
 */

export type Slot =
  | 'bottom'
  | 'under'
  | 'top'
  | 'dress'
  | 'over'
  | 'scarf'
  | 'hat'
  | 'shoes'
  | 'bag';

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
  'dress',
  'over',
  'scarf',
  'hat',
  'shoes',
  'bag',
];

/** Slots worn above the waist. A dress counts: it sits on the torso like a top. */
export const upperBodySlots: ReadonlySet<Slot> = new Set([
  'under',
  'top',
  'dress',
  'over',
]);

/** The visible torso layer, where the clean-top rule applies: a top, or a dress in its place. */
export const torsoSlots: ReadonlySet<Slot> = new Set(['top', 'dress']);

/** The pair a dress replaces. */
export const separateSlots: ReadonlyArray<Slot> = ['bottom', 'top'];

/** Accessories repeat freely and do not have a laundry wear allowance. */
export const accessorySlots: ReadonlySet<Slot> = new Set([
  'scarf',
  'hat',
  'shoes',
  'bag',
]);

/** An outfit needs a top and a bottom, or a dress in their place. */
export const isCompleteOutfit = (slots: Iterable<Slot>): boolean => {
  const filled = new Set(slots);
  return filled.has('dress') || separateSlots.every((slot) => filled.has(slot));
};

export const slotLabel: Readonly<Record<Slot, string>> = {
  bottom: 'Bottom',
  under: 'Under layer',
  top: 'Top',
  dress: 'Dress',
  over: 'Over layer',
  scarf: 'Scarf',
  hat: 'Hat',
  shoes: 'Shoes',
  bag: 'Bag',
};

export type GarmentStatus = 'processing' | 'review' | 'active' | 'retired';

export type ImageChoice = 'studio' | 'original';

export type GarmentColor = {
  readonly hex: string;
};

/**
 * The categories a garment can be filed under. Each carries the default wear
 * budget (days in a row before it goes to the wash) and the slots it can fill.
 * Settings may override the budgets; a garment may override its own.
 */
export const garmentCategories = [
  't-shirt',
  'shirt',
  'polo',
  'undershirt',
  'jumper',
  'cardigan',
  'hoodie',
  'overshirt',
  'trousers',
  'shorts',
  'skirt',
  'dress',
  'shoes',
  'handbag',
  'cap',
  'beanie',
  'hat',
  'scarf',
] as const;

export type GarmentCategory = (typeof garmentCategories)[number];

export const categoryLabel: Readonly<Record<GarmentCategory, string>> = {
  't-shirt': 'T-shirt',
  shirt: 'Shirt',
  polo: 'Polo',
  undershirt: 'Undershirt',
  jumper: 'Jumper',
  cardigan: 'Cardigan',
  hoodie: 'Hoodie',
  overshirt: 'Overshirt',
  trousers: 'Trousers',
  shorts: 'Shorts',
  skirt: 'Skirt',
  dress: 'Dress',
  shoes: 'Shoes',
  handbag: 'Handbag',
  cap: 'Cap',
  beanie: 'Beanie',
  hat: 'Hat',
  scarf: 'Scarf',
};

/** How a category list is grouped for choosing; together the groups hold every category once. */
export const categoryGroups: ReadonlyArray<{
  readonly label: string;
  readonly categories: ReadonlyArray<GarmentCategory>;
}> = [
  { label: 'Tops', categories: ['t-shirt', 'shirt', 'polo', 'undershirt'] },
  {
    label: 'Layers',
    categories: ['jumper', 'cardigan', 'hoodie', 'overshirt'],
  },
  { label: 'Bottoms', categories: ['trousers', 'shorts', 'skirt'] },
  { label: 'Dresses', categories: ['dress'] },
  {
    label: 'Accessories',
    categories: ['shoes', 'handbag', 'cap', 'beanie', 'hat', 'scarf'],
  },
];

export const categoryDefaults: Readonly<
  Record<
    GarmentCategory,
    { readonly budget: number; readonly slots: ReadonlyArray<Slot> }
  >
> = {
  shoes: { budget: 1, slots: ['shoes'] },
  handbag: { budget: 1, slots: ['bag'] },
  cap: { budget: 1, slots: ['hat'] },
  beanie: { budget: 1, slots: ['hat'] },
  hat: { budget: 1, slots: ['hat'] },
  scarf: { budget: 1, slots: ['scarf'] },
  trousers: { budget: 4, slots: ['bottom'] },
  shorts: { budget: 4, slots: ['bottom'] },
  skirt: { budget: 4, slots: ['bottom'] },
  dress: { budget: 2, slots: ['dress'] },
  shirt: { budget: 2, slots: ['top', 'over'] },
  't-shirt': { budget: 2, slots: ['top'] },
  polo: { budget: 2, slots: ['top'] },
  undershirt: { budget: 1, slots: ['under'] },
  jumper: { budget: 4, slots: ['over', 'top'] },
  cardigan: { budget: 4, slots: ['over'] },
  hoodie: { budget: 4, slots: ['over', 'top'] },
  overshirt: { budget: 2, slots: ['over'] },
};

export const isCategory = (value: string): value is GarmentCategory =>
  (garmentCategories as ReadonlyArray<string>).includes(value);

/** A category's label, or the stored text when it is not a known category. */
export const categoryName = (category: string): string =>
  isCategory(category) ? categoryLabel[category] : category;

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

/** Whether a garment follows the laundry cycle; accessory categories do not. */
export const hasWearBudget = (garment: {
  readonly category: string;
}): boolean =>
  !(
    isCategory(garment.category) &&
    categoryDefaults[garment.category].slots.every((slot) =>
      accessorySlots.has(slot),
    )
  );
