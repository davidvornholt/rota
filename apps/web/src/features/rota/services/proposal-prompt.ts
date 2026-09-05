/**
 * The morning question, written out for Gemini. The engine has already decided
 * what may continue and which garments are worth considering; this turns that
 * into text and pictures the model reads in one pass, with a short alias per
 * garment so the answer can name them without a chance of a typo.
 */

import type { ImagePart, PromptPart } from '#/shared/ai/gemini.ts';
import type { Garment } from '#/shared/data/garment.ts';
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
import { warmthBand } from '../rotation.ts';
import { weatherSentence } from '../weather-words.ts';

export type OpenSlot = {
  readonly slot: Slot;
  readonly required: boolean;
  readonly candidates: ReadonlyArray<Candidate>;
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
  readonly openSlots: ReadonlyArray<OpenSlot>;
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
  "You are the valet behind Rota, a one-person wardrobe app. Each morning you decide today's outfit from a short list the wardrobe has already narrowed down.",
  'The wearer rotates clothes: trousers and jumpers for several days in a row, tops for a day or two, and expects to keep wearing what still has days left unless the weather has changed enough to make it wrong.',
  'Rules: keep every continuing garment unless the weather or the occasion makes it a poor choice, and say so in its reason when you drop one. Choose only from the aliases offered; never invent a garment. Dress for 05:00–20:00 in the wardrobe location’s time zone. Forecast highs and lows cover the stated hours; the high matters more than the low. Use an over layer when the day is cool; skip it when the day is warm. Use an under layer only on cold days or under a thin shirt on a cool day. Mind colour harmony and formality, and read the occasion note as an instruction.',
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
    `warmth ${garment.warmth}/5`,
    `formality ${garment.formality}/5`,
    garment.colors.length === 0
      ? undefined
      : `colours ${garment.colors.map((color) => `${color.name} ${color.hex}`).join(', ')}`,
    garment.material === '' ? undefined : garment.material,
    garment.pattern === '' ? undefined : garment.pattern,
    garment.rainOk ? undefined : 'not for rain',
  ]
    .filter((part) => part !== undefined)
    .join('; ');

export const buildProposalPrompt = (input: PromptInput): BuiltPrompt => {
  const aliases = new Map<string, AliasedGarment>();
  const parts: Array<PromptPart> = [];
  const say = (text: string) => parts.push({ text });
  const show = (alias: string, garment: Garment) => {
    const image = input.imageFor(garment);
    if (image !== undefined) {
      say(`Picture of ${alias}:`);
      parts.push({ image });
    }
  };

  const band = warmthBand(input.weather);
  say(
    `Today is ${formatWeekday(input.today)} ${formatDayMonth(input.today)}. Forecast: ${weatherSentence(input.weather)}. Warmth band ${band}/5 (1 hot … 5 cold).`,
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
    say('Continuing from yesterday (still within their rotation):');
    input.continuations.forEach((continuation, index) => {
      const alias = `C${index + 1}`;
      aliases.set(alias, {
        garment: continuation.garment,
        slot: continuation.slot,
        continuation,
      });
      say(
        `${alias} (${slotLabel[continuation.slot].toLowerCase()}) — ${continuation.garment.name}: ${describeGarment(continuation.garment)}; day ${continuation.dayOfBudget} of ${continuation.budget}; ${continuation.weatherFits ? "still suits today's weather" : "may no longer suit today's weather"}.`,
      );
      show(alias, continuation.garment);
    });
  } else {
    say('Nothing continues from yesterday; every slot is open.');
  }

  const describeOpenSlot = (open: OpenSlot) => {
    const label = slotLabel[open.slot].toLowerCase();
    if (open.candidates.length === 0) {
      say(
        `${slotLabel[open.slot]}: no garment available${open.required ? '' : '; leave it null'}.`,
      );
      return;
    }
    say(
      `${slotLabel[open.slot]} candidates${open.required ? ' (choose one)' : ' (choose one or null)'}:`,
    );
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
  for (const open of input.openSlots) {
    describeOpenSlot(open);
  }

  say(
    `Decide today's outfit. Fill ${slotOrder.join(', ')} with aliases (under and over may be null). Then write the headline and one reason per chosen garment.`,
  );

  return { parts, aliases };
};
