import { displayImage, type Garment } from '#/shared/data/garment.ts';
import {
  effectiveWearBudget,
  type GarmentColor,
  type GarmentStatus,
  type ImageChoice,
  type Slot,
} from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import { daysBetween, type LocalDate } from '#/shared/time/local-date.ts';

export type GarmentImageView = {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** Studio renders sit on the paper; originals fill their frame. */
  readonly fit: 'contain' | 'cover';
};

/** A garment as every page shows it: the row plus its image URLs and wear facts. */
export type GarmentView = {
  readonly id: string;
  readonly status: GarmentStatus;
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly slots: ReadonlyArray<Slot>;
  readonly warmth: number;
  readonly rainOk: boolean;
  readonly formality: number;
  readonly wearBudget: number | null;
  readonly effectiveBudget: number;
  readonly colors: ReadonlyArray<GarmentColor>;
  readonly pattern: string;
  readonly material: string;
  readonly fit: string;
  readonly sleeve: string;
  readonly brand: string;
  readonly seasons: ReadonlyArray<string>;
  readonly notes: string;
  readonly price: number | null;
  readonly purchasedOn: LocalDate | null;
  readonly imageChoice: ImageChoice;
  readonly processingError: string | null;
  readonly image: GarmentImageView | undefined;
  readonly original: GarmentImageView | undefined;
  readonly studio: GarmentImageView | undefined;
  readonly wears: number;
  readonly lastWornOn: LocalDate | null;
  readonly daysSinceWorn: number | null;
  readonly costPerWear: number | null;
};

const centsPerUnit = 100;

export type WearFacts = {
  readonly wears: number;
  readonly lastWornOn: LocalDate | null;
};

/** Wear counts per garment from the whole log; days on or after `today` do not count as the past. */
export const wearFactsByGarment = (
  log: ReadonlyArray<WearEntry>,
  today: LocalDate,
): ReadonlyMap<string, WearFacts> => {
  const facts = new Map<string, WearFacts>();
  for (const entry of log.filter((candidate) => candidate.wornOn <= today)) {
    const current = facts.get(entry.garmentId) ?? {
      wears: 0,
      lastWornOn: null,
    };
    facts.set(entry.garmentId, {
      wears: current.wears + 1,
      lastWornOn:
        current.lastWornOn === null || entry.wornOn > current.lastWornOn
          ? entry.wornOn
          : current.lastWornOn,
    });
  }
  return facts;
};

const imageView = (
  image: Garment['images']['original'],
  fit: GarmentImageView['fit'],
  urlFor: (key: string) => string,
): GarmentImageView | undefined =>
  image === undefined
    ? undefined
    : { url: urlFor(image.key), width: image.width, height: image.height, fit };

export type GarmentViewInput = {
  readonly garment: Garment;
  readonly facts: WearFacts | undefined;
  readonly categoryBudgets: Readonly<Record<string, number>>;
  readonly today: LocalDate;
  readonly urlFor: (key: string) => string;
};

export const toGarmentView = ({
  garment,
  facts,
  categoryBudgets,
  today,
  urlFor,
}: GarmentViewInput): GarmentView => {
  const chosen = displayImage(garment);
  const wears = facts?.wears ?? 0;
  const lastWornOn = facts?.lastWornOn ?? null;
  return {
    id: garment.id,
    status: garment.status,
    name: garment.name,
    category: garment.category,
    subcategory: garment.subcategory,
    slots: garment.slots,
    warmth: garment.warmth,
    rainOk: garment.rainOk,
    formality: garment.formality,
    wearBudget: garment.wearBudget,
    effectiveBudget: effectiveWearBudget(garment, categoryBudgets),
    colors: garment.colors,
    pattern: garment.pattern,
    material: garment.material,
    fit: garment.fit,
    sleeve: garment.sleeve,
    brand: garment.brand,
    seasons: garment.seasons,
    notes: garment.notes,
    price: garment.price,
    purchasedOn: garment.purchasedOn,
    imageChoice: garment.imageChoice,
    processingError: garment.processingError,
    image:
      chosen === undefined
        ? undefined
        : imageView(
            chosen,
            chosen === garment.images.studio ? 'contain' : 'cover',
            urlFor,
          ),
    original: imageView(garment.images.original, 'cover', urlFor),
    studio: imageView(garment.images.studio, 'contain', urlFor),
    wears,
    lastWornOn,
    daysSinceWorn: lastWornOn === null ? null : daysBetween(lastWornOn, today),
    costPerWear:
      garment.price === null || wears === 0
        ? null
        : Math.round((garment.price / wears) * centsPerUnit) / centsPerUnit,
  };
};
