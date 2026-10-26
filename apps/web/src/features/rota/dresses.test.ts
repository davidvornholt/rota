import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import type { WearEntry } from '#/shared/data/wear-log-repository.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import { localDate } from '#/shared/time/local-date.ts';
import {
  type Continuation,
  candidatesFor,
  continuations,
  type RotationInput,
} from './rotation.ts';
import {
  type ProposalAnswer,
  proposalAnswerJsonSchema,
} from './schemas/proposal-answer.ts';
import { validateEntries } from './services/planning-rules.ts';
import {
  answerToItems,
  choicesWithPins,
  slotChoicesFor,
} from './services/proposal-assembly.ts';
import {
  buildProposalPrompt,
  proposalSystemPrompt,
  type SlotChoices,
} from './services/proposal-prompt.ts';

const garment = (
  id: string,
  category: string,
  slots: ReadonlyArray<Slot>,
): Garment => ({
  id,
  status: 'active',
  name: id,
  category,
  subcategory: '',
  slots,
  warmth: 2,
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
  washedOn: null,
  washedAfterWear: false,
  laundryStartedOn: null,
  laundryReadyOn: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  images: {},
});

const skirt = garment('skirt', 'skirt', ['bottom']);
const blouse = garment('blouse', 'shirt', ['top']);
const dress = garment('dress', 'dress', ['dress']);
const beanie = garment('beanie', 'beanie', ['hat']);
const scarf = garment('scarf', 'scarf', ['scarf']);

const today = localDate('2026-10-19');
const yesterday = localDate('2026-10-18');

const worn = (garmentId: string, slot: Slot): WearEntry => ({
  wornOn: yesterday,
  garmentId,
  slot,
  source: 'proposed',
});

const rotation = (
  garments: ReadonlyArray<Garment>,
  log: ReadonlyArray<WearEntry> = [],
): RotationInput => ({
  cleanTop: false,
  today,
  log,
  garments,
  settings: { laundryDays: 4, cooldownDays: 3, categoryBudgets: {} },
  excluded: new Set(),
});

const cold: WeatherDay = {
  date: today,
  issuedOn: today,
  locationLabel: 'Berlin',
  high: 6,
  low: 1,
  precipitationProbability: 10,
  precipitationMm: 0,
  windKmh: 12,
  weatherCode: 3,
};

const promptFor = (
  choices: ReadonlyArray<SlotChoices>,
  continuing: ReadonlyArray<Continuation> = [],
) =>
  buildProposalPrompt({
    cleanTop: false,
    today,
    weather: cold,
    yesterday: undefined,
    upcoming: [],
    forecastStale: false,
    occasion: null,
    continuations: continuing,
    slotChoices: choices,
    recent: [],
    imageFor: () => undefined,
  });

const promptText = (
  choices: ReadonlyArray<SlotChoices>,
  continuing: ReadonlyArray<Continuation> = [],
) =>
  promptFor(choices, continuing)
    .parts.flatMap((part) => ('text' in part ? [part.text] : []))
    .join('\n');

const answer = (outfit: Partial<ProposalAnswer['outfit']>): ProposalAnswer => ({
  outfit: {
    bottom: null,
    under: null,
    top: null,
    dress: null,
    over: null,
    scarf: null,
    hat: null,
    shoes: null,
    bag: null,
    ...outfit,
  },
  headline: '',
  reasons: [],
});

const required = (choices: ReadonlyArray<SlotChoices>) =>
  choices.filter((choice) => choice.required).map((choice) => choice.slot);

describe('a dress in place of a top and a bottom', () => {
  it('saves a dress on its own as a complete outfit', () => {
    const entries = [{ garmentId: dress.id, slot: 'dress' as const }];
    expect(
      Effect.runSync(Effect.result(validateEntries(entries, [dress], true)))
        ._tag,
    ).toBe('Success');
    const topOnly = [{ garmentId: blouse.id, slot: 'top' as const }];
    expect(
      Effect.runSync(Effect.result(validateEntries(topOnly, [blouse], true)))
        ._tag,
    ).toBe('Failure');
  });

  it('requires a top and a bottom only when no dress is offered', () => {
    expect(required(slotChoicesFor(rotation([skirt, blouse]), [], []))).toEqual(
      ['bottom', 'top'],
    );
    expect(
      required(slotChoicesFor(rotation([skirt, blouse, dress]), [], [])),
    ).toEqual([]);
  });

  it('lets a kept dress complete the outfit even when it was worn yesterday', () => {
    const input = rotation([skirt, blouse, dress], [worn(dress.id, 'dress')]);
    expect(required(slotChoicesFor(input, [], []))).toEqual(['bottom', 'top']);
    const kept = choicesWithPins(
      input,
      [],
      [{ garmentId: dress.id, slot: 'dress' }],
    );
    expect(required(kept)).toEqual(['dress']);
  });

  it('lets the model answer with a dress alone, but not with half an outfit', async () => {
    const input = rotation([skirt, blouse, dress]);
    const choices = slotChoicesFor(input, [], []);
    const prompt = promptFor(choices);
    const outfit = proposalAnswerJsonSchema(prompt.aliases).properties.outfit
      .properties;
    expect(outfit.dress.enum).toEqual(['D1', null]);
    expect(outfit.top.enum).toEqual(['T1', null]);
    expect(outfit.bottom.enum).toEqual(['B1', null]);
    expect(promptText(choices)).toContain(
      'Leave the top null when you choose a dress',
    );
    const items = await Effect.runPromise(
      answerToItems(answer({ dress: 'D1' }), prompt.aliases, input),
    );
    expect(items.map((item) => [item.slot, item.garmentId])).toEqual([
      ['dress', 'dress'],
    ]);
    const half = await Effect.runPromise(
      Effect.result(
        answerToItems(answer({ top: 'T1' }), prompt.aliases, input),
      ),
    );
    expect(half._tag).toBe('Failure');
  });

  it('keeps a top and a bottom required in the answer when no dress is offered', () => {
    const prompt = promptFor(slotChoicesFor(rotation([skirt, blouse]), [], []));
    const outfit = proposalAnswerJsonSchema(prompt.aliases).properties.outfit
      .properties;
    expect(outfit.top.type).toBe('string');
    expect(outfit.bottom.type).toBe('string');
    expect(outfit.dress.enum).toEqual([null]);
  });

  it('treats a dress like a top for washing and daily variety', () => {
    const second = { ...dress, id: 'second-dress' };
    const log = [worn(dress.id, 'dress')];
    expect(
      candidatesFor(rotation([dress, second], log), 'dress', new Set()).map(
        (candidate) => candidate.garment.id,
      ),
    ).toEqual(['second-dress']);
    const clean = {
      ...rotation(
        [dress],
        [{ ...worn(dress.id, 'dress'), wornOn: localDate('2026-10-16') }],
      ),
      cleanTop: true,
    };
    expect(candidatesFor(clean, 'dress', new Set())).toEqual([]);
    expect(continuations(rotation([dress], log))).toEqual([]);
  });
});

describe('a dress with a continuing bottom', () => {
  it('lets a dress replace a continuing bottom', () => {
    // Daily variety rules out yesterday's blouse, so the dress is the only
    // complete outfit even though the skirt has wears left.
    const input = rotation(
      [skirt, blouse, dress],
      [worn(skirt.id, 'bottom'), worn(blouse.id, 'top')],
    );
    const continuing = continuations(input);
    expect(continuing.map((c) => c.garment.id)).toEqual([skirt.id]);
    const choices = slotChoicesFor(input, continuing, []);
    const outfit = proposalAnswerJsonSchema(
      promptFor(choices, continuing).aliases,
    ).properties.outfit.properties;
    expect(outfit.bottom.enum).toEqual(['C1', null]);
    expect(outfit.top.enum).toEqual([null]);
    expect(outfit.dress.enum).toEqual(['D1', null]);
    expect(promptText(choices, continuing)).toContain(
      'Bottom: no replacement available; use the continuing alias or null.',
    );
    expect(proposalSystemPrompt).toContain(
      'You may also leave out a continuing bottom when you choose a dress in place of the top and bottom.',
    );
  });
});

describe('another suggestion after a turned-down dress', () => {
  it('offers a turned-down dress again when nothing else completes the outfit', () => {
    const shoes = garment('trainers', 'trainers', ['shoes']);
    const input = {
      ...rotation([dress, shoes]),
      excluded: new Set([dress.id]),
    };
    const choices = slotChoicesFor(input, [], []);
    const offered = choices.find((choice) => choice.slot === 'dress');
    expect(offered?.turnedDownOnly).toBeTrue();
    expect(offered?.candidates.map((c) => c.garment.id)).toEqual([dress.id]);
    expect(required(choices)).toEqual(['dress']);
    // A shirt kept as the overlayer cannot also be the top.
    const shirt = garment('shirt', 'shirt', ['top', 'over']);
    const kept = choicesWithPins(
      {
        ...input,
        garments: [dress, shoes, shirt, garment('skirt', 'skirt', ['bottom'])],
      },
      [],
      [{ garmentId: shirt.id, slot: 'over' }],
    );
    expect(
      kept.find((choice) => choice.slot === 'dress')?.turnedDownOnly,
    ).toBeTrue();
    expect(required(kept)).toEqual(['dress', 'over']);
  });
});

describe('hats and scarves', () => {
  it('offers them as optional pieces with guidance for the weather', () => {
    const choices = slotChoicesFor(
      rotation([skirt, blouse, beanie, scarf]),
      [],
      [],
    );
    for (const slot of ['hat', 'scarf'] as const) {
      expect(choices.find((choice) => choice.slot === slot)?.required).toBe(
        false,
      );
    }
    const prompt = promptFor(choices);
    const outfit = proposalAnswerJsonSchema(prompt.aliases).properties.outfit
      .properties;
    expect(outfit.hat.enum).toEqual(['H1', null]);
    expect(outfit.scarf.enum).toEqual(['F1', null]);
    expect(promptText(choices)).toContain(
      "Choose a hat only if the weather, outfit or wearer's note calls for one",
    );
  });
});
