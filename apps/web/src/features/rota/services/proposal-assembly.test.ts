import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import { continuations, type RotationInput } from '../rotation.ts';
import { proposalAnswerJsonSchema } from '../schemas/proposal-answer.ts';
import { answerToItems, slotChoicesFor } from './proposal-assembly.ts';
import { buildProposalPrompt, type SlotChoices } from './proposal-prompt.ts';

const garment = (id: string, slots: ReadonlyArray<Slot>): Garment => ({
  id,
  status: 'active',
  name: id,
  category: slots[0] === 'bottom' ? 'shorts' : 'shirt',
  subcategory: '',
  slots,
  warmth: 1,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  images: {},
});

const warm: WeatherDay = {
  date: localDate('2026-09-07'),
  issuedOn: localDate('2026-09-07'),
  locationLabel: 'Berlin',
  high: 24,
  low: 15,
  precipitationProbability: 5,
  precipitationMm: 0,
  windKmh: 8,
  weatherCode: 1,
};

const shorts = garment('shorts', ['bottom']);
const linen = garment('linen', ['top']);
const tee = garment('tee', ['top']);

const input = (
  garments: ReadonlyArray<Garment>,
  excluded: ReadonlyArray<string>,
): RotationInput => ({
  today: localDate('2026-09-07'),
  log: [],
  garments,
  settings: { cooldownDays: 3, categoryBudgets: {} },
  excluded: new Set(excluded),
});

const slotNamed = (slots: ReadonlyArray<SlotChoices>, slot: Slot) =>
  slots.find((open) => open.slot === slot);

describe('slotChoicesFor', () => {
  it('allows the whole outfit to change after a cool rainy turn despite remaining rotation days', async () => {
    const polo = { ...tee, category: 'polo', wearBudget: 2 };
    const chinos = { ...garment('chinos', ['bottom']), warmth: 2 };
    const shirt = { ...garment('shirt', ['top']), warmth: 2 };
    const rotation: RotationInput = {
      ...input([shorts, polo, chinos, shirt], []),
      log: [shorts, polo].map((g) => ({
        wornOn: localDate('2026-09-06'),
        garmentId: g.id,
        slot: g.slots[0] as Slot,
        source: 'proposed' as const,
      })),
    };
    const continuing = continuations(rotation);
    expect(continuing.map((c) => c.garment.id)).toEqual(['shorts', 'tee']);
    const prompt = buildProposalPrompt({
      today: rotation.today,
      weather: { ...warm, high: 18.9, low: 15.8, precipitationProbability: 78 },
      yesterday: { ...warm, high: 32.2 },
      upcoming: [],
      forecastStale: false,
      occasion: 'Meeting today',
      continuations: continuing,
      slotChoices: slotChoicesFor(rotation, continuing),
      recent: [],
      imageFor: () => undefined,
    });
    const schema = proposalAnswerJsonSchema(prompt.aliases);
    expect(schema.properties.outfit.properties.bottom.enum).toEqual([
      'C1',
      'B1',
    ]);
    expect(schema.properties.outfit.properties.top.enum).toEqual(['C2', 'T1']);
    expect(schema.properties.outfit.properties.under.enum).toEqual([null]);
    expect(schema.properties.outfit.properties.bottom.enum).not.toContain(
      'shorts',
    );
    const items = await Effect.runPromise(
      answerToItems(
        {
          outfit: { bottom: 'B1', top: 'T1', under: null, over: null },
          headline: 'Chinos and a shirt for the cooler meeting.',
          reasons: [],
        },
        prompt.aliases,
        rotation,
      ),
    );
    expect(items.map((item) => item.garmentId)).toEqual(['chinos', 'shirt']);
    expect(items.every((item) => !item.continued)).toBeTrue();
    const invalid = await Effect.runPromise(
      Effect.either(
        answerToItems(
          {
            outfit: { bottom: 'T1', top: 'B1', under: null, over: null },
            headline: '',
            reasons: [],
          },
          prompt.aliases,
          rotation,
        ),
      ),
    );
    expect(invalid._tag).toBe('Left');
  });

  it('keeps the continuing choice usable when no replacement exists', () => {
    const rotation = input([shorts, tee], []);
    const continuing = [
      {
        garment: shorts,
        slot: 'bottom' as const,
        budget: 4,
        dayOfBudget: 2,
      },
    ];
    const prompt = buildProposalPrompt({
      today: rotation.today,
      weather: warm,
      yesterday: undefined,
      upcoming: [],
      forecastStale: false,
      occasion: null,
      continuations: continuing,
      slotChoices: slotChoicesFor(rotation, continuing),
      recent: [],
      imageFor: () => undefined,
    });
    expect(
      proposalAnswerJsonSchema(prompt.aliases).properties.outfit.properties
        .bottom.enum,
    ).toEqual(['C1']);
    const text = prompt.parts
      .flatMap((part) => ('text' in part ? [part.text] : []))
      .join('\n');
    expect(text).not.toContain('Bottom: no garment available');
  });
});

describe('rejected alternatives', () => {
  it('re-offers the turned-down garment when it is the only one that fits a required slot', () => {
    const open = slotChoicesFor(
      input([shorts, linen, tee], ['shorts', 'linen']),
      [],
    );

    const bottom = slotNamed(open, 'bottom');
    expect(bottom?.turnedDownOnly).toBeTrue();
    expect(bottom?.candidates.map((c) => c.garment.id)).toEqual(['shorts']);

    const top = slotNamed(open, 'top');
    expect(top?.turnedDownOnly).toBeFalse();
    expect(top?.candidates.map((c) => c.garment.id)).toEqual(['tee']);
  });

  it('keeps a required slot empty when the wardrobe has nothing for it at all', () => {
    const open = slotChoicesFor(input([linen, tee], ['linen']), []);

    const bottom = slotNamed(open, 'bottom');
    expect(bottom?.turnedDownOnly).toBeFalse();
    expect(bottom?.candidates).toEqual([]);
  });

  it('leaves optional slots empty instead of bringing back turned-down garments', () => {
    const cardigan = garment('cardigan', ['over']);
    const open = slotChoicesFor(
      input([shorts, tee, cardigan], ['cardigan']),
      [],
    );

    const over = slotNamed(open, 'over');
    expect(over?.turnedDownOnly).toBeFalse();
    expect(over?.candidates).toEqual([]);
  });
});

it('shows an original image once while offering the garment in each eligible slot', () => {
  const shirt = { ...garment('shirt', ['top', 'over']), warmth: 1 };
  const rotation = input([shorts, shirt], []);
  const image = {
    mimeType: 'image/png',
    data: new TextEncoder().encode('original image bytes'),
  };
  const prompt = buildProposalPrompt({
    today: rotation.today,
    weather: warm,
    yesterday: undefined,
    upcoming: [],
    forecastStale: false,
    occasion: null,
    continuations: [],
    slotChoices: slotChoicesFor(rotation, []),
    recent: [],
    imageFor: (g) => (g.id === shirt.id ? image : undefined),
  });
  const images = prompt.parts.flatMap((part) =>
    'image' in part ? [part.image] : [],
  );
  expect(images).toEqual([image]);
  expect(images[0]?.data).toBe(image.data);
  const schema = proposalAnswerJsonSchema(prompt.aliases);
  expect(schema.properties.outfit.properties.top.enum).toEqual(['T1']);
  expect(schema.properties.outfit.properties.over.enum).toEqual(['O1', null]);
  expect(prompt.aliases.get('T1')?.garment.id).toBe(shirt.id);
  expect(prompt.aliases.get('O1')?.garment.id).toBe(shirt.id);
});
