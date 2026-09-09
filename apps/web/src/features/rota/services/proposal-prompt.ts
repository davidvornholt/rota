import { colorName } from '#/shared/data/color-name.ts';
/**
 * The morning question, written out for Gemini. The engine has already decided
 * what may continue and which garments are worth considering; this turns that
 * into text and pictures the model reads in one pass, with a short alias per
 * garment so the answer can name them without a chance of a typo.
 */

import type { ImagePart, PromptPart } from '#/shared/ai/gemini-request.ts';
import type { Garment } from '#/shared/data/garment.ts';
import {
  formalityInstruction,
  warmthInstruction,
} from '#/shared/data/garment-scales.ts';
import {
  type Slot,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import {
  formatDayMonth,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import type { Candidate, Continuation } from '../rotation.ts';
import { weatherSentence } from '../weather-words.ts';

export type SlotChoices = {
  readonly slot: Slot;
  readonly required: boolean;
  readonly candidates: ReadonlyArray<Candidate>;
  /** Nothing else fits the slot today, so garments turned down earlier are offered again. */
  readonly turnedDownOnly: boolean;
};

export type RecentDay = {
  readonly date: LocalDate;
  readonly names: ReadonlyArray<string>;
};

export type PromptInput = {
  readonly today: LocalDate;
  readonly weather: WeatherDay;
  readonly yesterday: WeatherDay | undefined;
  readonly upcoming: ReadonlyArray<WeatherDay>;
  readonly forecastStale: boolean;
  readonly occasion: string | null;
  readonly continuations: ReadonlyArray<Continuation>;
  readonly slotChoices: ReadonlyArray<SlotChoices>;
  readonly recent: ReadonlyArray<RecentDay>;
  /** The picture to show for a garment, when it has one. */
  readonly imageFor: (garment: Garment) => ImagePart | undefined;
};

export type AliasedGarment = {
  readonly garment: Garment;
  readonly slot: Slot;
  readonly continuation: Continuation | undefined;
};

export type BuiltPrompt = {
  readonly parts: ReadonlyArray<PromptPart>;
  readonly aliases: ReadonlyMap<string, AliasedGarment>;
};

export const proposalSystemPrompt = [
  warmthInstruction,
  formalityInstruction,
  "You are the valet behind Rota, a one-person wardrobe app. Choose today's outfit from the available wardrobe for the supplied forecast and the wearer's note.",
  "Rotation is a preference: keep continuing garments when appropriate, but weather and the note take priority. You may replace any or all of them. Explain a replacement in the new garment's reason.",
  "Judge the outfit as a whole. Choose only the offered aliases. The forecast covers 05:00–20:00 in the wardrobe location's time zone.",
  'Write for the wearer in plain, specific, second-person English. No exclamation marks, no emoji, no sales tone.',
].join(' ');

const slotPrefix: Readonly<Record<Slot, string>> = {
  bottom: 'B',
  under: 'U',
  top: 'T',
  over: 'O',
};

const restWords = (days: number | null): string =>
  days === null
    ? 'never worn yet'
    : `last worn ${days} day${days === 1 ? '' : 's'} ago`;

const describeGarment = (garment: Garment): string =>
  [
    garment.category +
      (garment.subcategory === '' ? '' : `, ${garment.subcategory}`),
    `warmth ${garment.warmth}/3`,
    `formality ${garment.formality}/3`,
    garment.colors.length === 0
      ? undefined
      : `colours ${garment.colors.map((color) => `${colorName(color.hex)} ${color.hex}`).join(', ')}`,
    garment.material === '' ? undefined : garment.material,
    garment.pattern === '' ? undefined : garment.pattern,
    garment.rainOk ? undefined : 'not for rain',
  ]
    .filter((part) => part !== undefined)
    .join('; ');

const slotInstruction = (
  open: SlotChoices,
  hasContinuation: boolean,
): string => {
  const label = slotLabel[open.slot];
  if (open.candidates.length === 0) {
    if (hasContinuation) {
      const choice = open.required
        ? 'use the continuing alias'
        : 'use the continuing alias or null';
      return `${label}: no replacement available; ${choice}.`;
    }
    return `${label}: no garment available${open.required ? '' : '; leave it null'}.`;
  }
  if (open.turnedDownOnly) {
    return `${label} candidates (choose one; the wearer turned these down today, but nothing else in the wardrobe fits the slot, so say so plainly in the reason):`;
  }
  let choice = open.required ? 'choose one' : 'choose one or null';
  if (hasContinuation) {
    choice = open.required
      ? 'choose a replacement or the continuing alias'
      : 'choose a replacement, the continuing alias or null';
  }
  return `${label} alternatives (${choice}):`;
};

export const buildProposalPrompt = (input: PromptInput): BuiltPrompt => {
  const aliases = new Map<string, AliasedGarment>();
  const parts: Array<PromptPart> = [];
  const say = (text: string) => parts.push({ text });
  const pictured = new Map<string, string>();
  const show = (alias: string, garment: Garment) => {
    const earlier = pictured.get(garment.id);
    if (earlier !== undefined) {
      say(`${alias} is the same garment as ${earlier}; see its picture above.`);
      return;
    }
    const image = input.imageFor(garment);
    if (image !== undefined) {
      say(`Picture of ${alias}:`);
      parts.push({ image });
      pictured.set(garment.id, alias);
    }
  };

  say(
    `Today is ${formatWeekday(input.today)} ${formatDayMonth(input.today)}. Forecast: ${weatherSentence(input.weather)}.`,
  );
  if (input.forecastStale) {
    say("This forecast is from yesterday; today's could not be fetched.");
  }
  if (input.yesterday !== undefined) {
    say(`Yesterday was: ${weatherSentence(input.yesterday)}.`);
  }
  if (input.upcoming.length > 0) {
    say(
      `Coming days: ${input.upcoming
        .map(
          (day) =>
            `${formatWeekday(day.date, 'short')} ${weatherSentence(day)}`,
        )
        .join('; ')}.`,
    );
  }
  say(
    input.occasion === null
      ? 'No occasion note for today.'
      : `Occasion note from the wearer: "${input.occasion}".`,
  );

  if (input.recent.length > 0) {
    say(
      `Recently worn: ${input.recent
        .map(
          (day) =>
            `${formatWeekday(day.date, 'short')} ${formatDayMonth(day.date)}: ${day.names.join(', ')}`,
        )
        .join(' | ')}.`,
    );
  }

  if (input.continuations.length > 0) {
    say(
      'Available to continue from yesterday, but replace any that no longer fit the weather or note:',
    );
    input.continuations.forEach((continuation, index) => {
      const alias = `C${index + 1}`;
      aliases.set(alias, {
        garment: continuation.garment,
        slot: continuation.slot,
        continuation,
      });
      say(
        `${alias} (${slotLabel[continuation.slot].toLowerCase()}) — ${continuation.garment.name}: ${describeGarment(continuation.garment)}; day ${continuation.dayOfBudget} of ${continuation.budget}.`,
      );
      show(alias, continuation.garment);
    });
  } else {
    say('Nothing continues from yesterday; every slot is open.');
  }

  const describeSlotChoices = (open: SlotChoices) => {
    const label = slotLabel[open.slot].toLowerCase();
    const hasContinuation = input.continuations.some(
      (c) => c.slot === open.slot,
    );
    say(slotInstruction(open, hasContinuation));
    open.candidates.forEach((candidate, index) => {
      const alias = `${slotPrefix[open.slot]}${index + 1}`;
      aliases.set(alias, {
        garment: candidate.garment,
        slot: open.slot,
        continuation: undefined,
      });
      say(
        `${alias} (${label}) — ${candidate.garment.name}: ${describeGarment(candidate.garment)}; ${restWords(candidate.daysSinceWorn)}${candidate.inCooldown ? '; worn recently, only if nothing else works' : ''}.`,
      );
      show(alias, candidate.garment);
    });
  };
  for (const open of input.slotChoices) {
    describeSlotChoices(open);
  }

  say(
    `Decide today's outfit. Fill ${slotOrder.join(', ')} with aliases (under and over may be null). Then write the headline and one reason per chosen garment.`,
  );

  return { parts, aliases };
};
