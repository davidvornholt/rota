import { colorName } from '#/shared/data/color-name.ts';
/**
 * The morning question, written out for Claude. The engine has already decided
 * what may continue and which garments are worth considering; this turns that
 * into text and pictures the model reads in one pass, with a short alias per
 * garment so the answer can name them without a chance of a typo.
 */

import type { ImagePart, PromptPart } from '#/shared/ai/claude-request.ts';
import type { Garment } from '#/shared/data/garment.ts';
import {
  hasWearBudget,
  type Slot,
  slotLabel,
} from '#/shared/data/garment-types.ts';
import type { WeatherDay } from '#/shared/data/weather-repository.ts';
import {
  formatDayMonth,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import { weatherSentence } from '#/shared/weather/weather-words.ts';
import type { Candidate, Continuation } from '../rotation.ts';

export type SlotChoices = {
  readonly slot: Slot;
  readonly required: boolean;
  readonly candidates: ReadonlyArray<Candidate>;
  /** Nothing else fits the slot today, so garments turned down earlier are offered again. */
  readonly turnedDownOnly: boolean;
};

export type RecentDay = {
  readonly date: LocalDate;
  /** What was worn, in worn order. */
  readonly pieces: ReadonlyArray<{
    readonly slot: Slot;
    readonly name: string;
  }>;
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
  "You choose today's outfit for the wearer of Rota, a one-person wardrobe app, from the offered garments. Answer with the offered aliases only.",
  'Garments are rated for warmth (1 light, 2 medium, 3 heavy) and formality (1 casual; 2 smart, which covers smart casual and business casual; 3 formal, for dressy occasions).',
  'Weigh these in order.',
  "1. The weather and the wearer's note. The forecast covers 05:00–20:00 local time. Without a note it is an ordinary day: dress casual to smart, and keep formal garments, such as a blazer, for a note that calls for them.",
  '2. Colours that go together. Do not pair a top or layer with a bottom of the same or a similar colour, such as an olive jumper with olive chinos; choose the rest to contrast with or complement a continuing garment.',
  '3. Wearing clothes up to their allowance before washing. Keep a continuing garment rather than replace it for variety. Otherwise prefer a partly worn garment with wears left to a freshly washed one, and among bottoms the one worn most recently.',
  '4. Variety. Avoid repeating the colours, style or combination of recent days, even with different garments. A continuing or partly worn garment is not a repeat; vary what goes with it.',
  'An outfit is a top and a bottom, or a dress in their place. With a dress, leave the top and bottom null unless it is worn over a top or with leggings; a continuing bottom may be left out then.',
  "Include suitable shoes and a bag when offered. Add an underlayer, overlayer, hat or scarf only when the weather, outfit or note calls for one, such as a beanie and scarf in the cold, and count the whole outfit's warmth. Shoes, bags, hats and scarves may repeat freely.",
  "Write for the wearer in plain, specific, second-person English, without exclamation marks, emoji or sales tone. When you replace a continuing garment, say why in the new garment's reason.",
].join('\n');

const slotPrefix: Readonly<Record<Slot, string>> = {
  bottom: 'B',
  under: 'U',
  top: 'T',
  dress: 'D',
  over: 'O',
  scarf: 'F',
  hat: 'H',
  shoes: 'S',
  bag: 'G',
};

const restWords = (days: number | null): string =>
  days === null
    ? 'never worn yet'
    : `last worn ${days} day${days === 1 ? '' : 's'} ago`;

/** Wears used and left, so the model need not work out whether a piece is at its limit. */
const wearWords = (worn: number, budget: number): string => {
  const left = budget - worn;
  return `worn ${worn} of ${budget} times since washing, ${left} wear${left === 1 ? '' : 's'} left`;
};

const describeRecentDay = (day: RecentDay): string =>
  `${formatWeekday(day.date, 'short')} ${formatDayMonth(day.date)}: ${day.pieces
    .map((piece) => `${slotLabel[piece.slot].toLowerCase()} ${piece.name}`)
    .join(', ')}`;

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
      ? 'No occasion note today.'
      : `Occasion note from the wearer: "${input.occasion}".`,
  );

  if (input.recent.length > 0) {
    say(
      `Recent outfits, oldest first: ${input.recent.map(describeRecentDay).join(' | ')}.`,
    );
  }

  if (input.continuations.length > 0) {
    say('Continuing from yesterday:');
    input.continuations.forEach((continuation, index) => {
      const alias = `C${index + 1}`;
      aliases.set(alias, {
        garment: continuation.garment,
        slot: continuation.slot,
        continuation,
      });
      say(
        `${alias} (${slotLabel[continuation.slot].toLowerCase()}) — ${continuation.garment.name}: ${describeGarment(continuation.garment)}; ${wearWords(continuation.dayOfBudget - 1, continuation.budget)}.`,
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
        `${alias} (${label}) — ${candidate.garment.name}: ${describeGarment(candidate.garment)}; ${restWords(candidate.daysSinceWorn)}${hasWearBudget(candidate.garment) ? `; ${wearWords(candidate.wearsSinceWash, candidate.budget)}` : ''}${candidate.inCooldown ? '; worn recently, only if nothing else works' : ''}.`,
      );
      show(alias, candidate.garment);
    });
  };
  for (const open of input.slotChoices) {
    describeSlotChoices(open);
  }

  return { parts, aliases };
};
