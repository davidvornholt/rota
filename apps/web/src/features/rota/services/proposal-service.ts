/**
 * Makes, remakes, and settles the day's proposal.
 *
 * The engine narrows; Gemini chooses; the wear log records. A proposal is a row
 * with a status, and the day is decided the moment a `wear_log` row exists for
 * it — everything else here is bookkeeping around that fact.
 */

import { Effect } from 'effect';

import { Gemini, type ImagePart, type PromptPart } from '#/shared/ai/gemini.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { displayImage, type Garment } from '#/shared/data/garment.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { slotOrder } from '#/shared/data/garment-types.ts';
import {
  type ProposalPayload,
  ProposalRepository,
} from '#/shared/data/proposal-repository.ts';
import {
  type OutfitEntry,
  WearLogRepository,
  type WearSource,
} from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { SlotEmptyError } from '../errors/rota-errors.ts';
import {
  type Continuation,
  candidatesFor,
  continuations,
  type RotationInput,
} from '../rotation.ts';
import {
  ProposalAnswerSchema,
  proposalAnswerJsonSchema,
} from '../schemas/proposal-answer.ts';
import { ForecastService, type ForecastWindow } from './forecast-service.ts';
import {
  answerToItems,
  recentSummary,
  requiredSlots,
} from './proposal-assembly.ts';
import {
  buildProposalPrompt,
  type OpenSlot,
  proposalSystemPrompt,
} from './proposal-prompt.ts';
import {
  confirm,
  logOutfit,
  type RerollScope,
  reroll,
  type SettlementDeps,
} from './proposal-settlement.ts';

export type GenerateOptions = {
  readonly excluded: ReadonlySet<string>;
  /** Also reopen the slots that would have continued from yesterday. */
  readonly releaseAll: boolean;
};

/** The slots not carried over, each with the engine's shortlist. */
const openSlotsFor = (
  input: RotationInput,
  continuing: ReadonlyArray<Continuation>,
): ReadonlyArray<OpenSlot> => {
  const chosen = new Set(continuing.map((c) => c.garment.id));
  return slotOrder
    .filter((slot) => !continuing.some((c) => c.slot === slot))
    .map((slot) => ({
      slot,
      required: requiredSlots.has(slot),
      candidates: candidatesFor(input, slot, chosen),
    }));
};

const imageConcurrency = 4;

const imageBytes = (media: MediaStore, garment: Garment) =>
  Effect.gen(function* () {
    const image = displayImage(garment);
    const bytes = image === undefined ? undefined : yield* media.get(image.key);
    return image === undefined || bytes === undefined
      ? undefined
      : ({ mimeType: image.mime, data: bytes } satisfies ImagePart);
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

/** The pictures the model will see, keyed by garment; a missing file just means no picture. */
const imagesFor = (media: MediaStore, shown: ReadonlyArray<Garment>) =>
  Effect.forEach(
    shown,
    (garment) =>
      Effect.map(
        imageBytes(media, garment),
        (image) => [garment.id, image] as const,
      ),
    { concurrency: imageConcurrency },
  ).pipe(
    Effect.map(
      (pairs) =>
        new Map(
          pairs.flatMap(([id, image]) =>
            image === undefined ? [] : [[id, image] as const],
          ),
        ),
    ),
  );

const ask = (gemini: Gemini, parts: ReadonlyArray<PromptPart>) =>
  gemini.generateJson({
    system: proposalSystemPrompt,
    parts,
    schema: ProposalAnswerSchema,
    jsonSchema: proposalAnswerJsonSchema,
  });

type GenerateDeps = {
  readonly garments: GarmentRepository;
  readonly wearLog: WearLogRepository;
  readonly proposals: ProposalRepository;
  readonly notes: DayNoteRepository;
  readonly media: MediaStore;
  readonly gemini: Gemini;
};

/** Asks Gemini for the day, given a forecast window and what to leave out. */
const generateProposal = (
  { garments, wearLog, proposals, notes, media, gemini }: GenerateDeps,
  clock: WardrobeClock,
  forecast: ForecastWindow,
  options: GenerateOptions,
) =>
  Effect.gen(function* () {
    const [all, log, occasion] = yield* Effect.all([
      garments.list(),
      wearLog.history(),
      notes.read(clock.today),
    ]);
    const input: RotationInput = {
      today: clock.today,
      log,
      garments: all,
      settings: clock.settings,
      weather: forecast.today,
      excluded: options.excluded,
    };
    const continuing = options.releaseAll ? [] : continuations(input);
    const openSlots = openSlotsFor(input, continuing);
    const empty = openSlots.find(
      (open) => open.required && open.candidates.length === 0,
    );
    if (empty !== undefined) {
      return yield* new SlotEmptyError(empty.slot);
    }
    const images = yield* imagesFor(media, [
      ...continuing.map((c) => c.garment),
      ...openSlots.flatMap((open) => open.candidates.map((c) => c.garment)),
    ]);
    const prompt = buildProposalPrompt({
      today: clock.today,
      weather: forecast.today,
      yesterday: forecast.yesterday,
      upcoming: forecast.upcoming,
      forecastStale: forecast.stale,
      occasion,
      continuations: continuing,
      openSlots,
      recent: recentSummary(log, all, clock.today),
      imageFor: (garment) => images.get(garment.id),
    });
    const answer = yield* ask(gemini, prompt.parts);
    const items = yield* answerToItems(answer, prompt.aliases, input);
    const payload: ProposalPayload = {
      items,
      headline: answer.headline,
      excludedGarmentIds: [...options.excluded],
      forecastStale: forecast.stale,
      occasion,
    };
    return yield* proposals.insert(
      clock.today,
      payload,
      answer.headline,
      gemini.model,
    );
  });

export class ProposalService extends Effect.Service<ProposalService>()(
  'rota/ProposalService',
  {
    effect: Effect.gen(function* () {
      const garments = yield* GarmentRepository;
      const wearLog = yield* WearLogRepository;
      const proposals = yield* ProposalRepository;
      const notes = yield* DayNoteRepository;
      const media = yield* MediaStore;
      const gemini = yield* Gemini;
      const forecasts = yield* ForecastService;

      const generate = (
        clock: WardrobeClock,
        forecast: ForecastWindow,
        options: GenerateOptions,
      ) =>
        generateProposal(
          { garments, wearLog, proposals, notes, media, gemini },
          clock,
          forecast,
          options,
        );

      /** The day's open proposal, made now if the day has none yet. */
      const ensure = (clock: WardrobeClock) =>
        Effect.gen(function* () {
          const latest = yield* proposals.latestForDate(clock.today);
          if (latest?.status === 'pending' || latest?.status === 'confirmed') {
            return latest;
          }
          const forecast = yield* forecasts.ensure(clock.settings, clock.today);
          return yield* generate(clock, forecast, {
            excluded: new Set(latest?.payload.excludedGarmentIds ?? []),
            releaseAll: false,
          });
        });

      const settlement: SettlementDeps = {
        proposals,
        wearLog,
        forecasts,
        generate,
      };

      return {
        generate,
        ensure,
        confirm: (id: string) => confirm(settlement, id),
        reroll: (clock: WardrobeClock, id: string, scope: RerollScope) =>
          reroll(settlement, clock, id, scope),
        logOutfit: (
          date: LocalDate,
          entries: ReadonlyArray<OutfitEntry>,
          source: WearSource,
        ) => logOutfit(settlement, date, entries, source),
      };
    }),
  },
) {}
