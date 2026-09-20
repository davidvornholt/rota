/**
 * Makes, remakes, and settles the day's proposal.
 *
 * The engine narrows; Gemini chooses; the wear log records. A proposal is a row
 * with a status, and the day is decided the moment a `wear_log` row exists for
 * it — everything else here is bookkeeping around that fact.
 */

import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

import { Gemini } from '#/shared/ai/gemini.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { writeError } from '#/shared/data/errors/data-errors.ts';
import { displayImage } from '#/shared/data/garment.ts';
import { cleanTopOn } from '#/shared/data/garment-care.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import {
  type ProposalPayload,
  ProposalRepository,
} from '#/shared/data/proposal-repository.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  ProposalAnswerError,
  ProposalGenerationError,
  SlotEmptyError,
} from '../errors/rota-errors.ts';
import { continuations, type RotationInput } from '../rotation.ts';
import {
  ProposalAnswerSchema,
  proposalAnswerJsonSchema,
} from '../schemas/proposal-answer.ts';
import { ForecastService, type ForecastWindow } from './forecast-service.ts';
import { projectedLog, validateEntries } from './planning-rules.ts';
import {
  answerToItems,
  choicesWithPins,
  recentSummary,
} from './proposal-assembly.ts';
import { proposalImages } from './proposal-images.ts';
import { makeProposalOperations } from './proposal-operations.ts';
import {
  type BuiltPrompt,
  buildProposalPrompt,
  proposalSystemPrompt,
} from './proposal-prompt.ts';
import type { SettlementDeps } from './proposal-settlement.ts';
import { proposalStage } from './proposal-stage.ts';

export type GenerateOptions = {
  readonly pinned: ReadonlyArray<OutfitEntry>;
  readonly excluded: ReadonlySet<string>;
  /** Also reopen the slots that would have continued from yesterday. */
  readonly releaseAll: boolean;
  readonly rejectedProposalId: string | null;
};

const withOutfitContext = (
  prompt: BuiltPrompt,
  pinned: ReadonlyArray<OutfitEntry>,
  saved: ReadonlyArray<SavedOutfit>,
): BuiltPrompt => {
  const aliasesFor = (entries: ReadonlyArray<OutfitEntry>) =>
    entries.map(
      (entry) =>
        [...prompt.aliases].find(
          ([, value]) =>
            value.garment.id === entry.garmentId && value.slot === entry.slot,
        )?.[0],
    );
  const favourites = saved.flatMap((outfit) => {
    const aliases = aliasesFor(outfit.entries);
    return aliases.every((alias) => alias !== undefined)
      ? [`${outfit.name}: ${aliases.join(', ')}`]
      : [];
  });
  return {
    ...prompt,
    parts: [
      ...prompt.parts,
      {
        text: `Keep these wearer-selected aliases exactly: ${aliasesFor(pinned).join(', ') || 'none'}. Saved combinations the wearer likes (consider when suitable, but you may propose new combinations): ${favourites.join('; ') || 'none'}.`,
      },
    ],
  };
};

const ask = (gemini: Gemini, prompt: BuiltPrompt) =>
  gemini
    .generateJson({
      purpose: 'outfit',
      system: proposalSystemPrompt,
      parts: prompt.parts,
      schema: ProposalAnswerSchema,
      jsonSchema: proposalAnswerJsonSchema(prompt.aliases),
    })
    .pipe(
      Effect.mapError(
        (error) =>
          new ProposalGenerationError(error.reason === 'timeout', error),
      ),
    );

type GenerateDeps = {
  readonly sql: SqlClient.SqlClient;
  readonly outfits: OutfitRepository;
  readonly garments: GarmentRepository;
  readonly wearLog: WearLogRepository;
  readonly proposals: ProposalRepository;
  readonly notes: DayNoteRepository;
  readonly media: MediaStore;
  readonly gemini: Gemini;
};

// Keep the proposal and saved selection atomic after the model has finished.
const persistProposal = (
  {
    sql,
    outfits,
    proposals,
  }: Pick<GenerateDeps, 'sql' | 'outfits' | 'proposals'>,
  {
    date,
    forecast,
    payload,
    model,
    rejectedProposalId,
  }: {
    readonly date: WardrobeClock['today'];
    readonly forecast: ForecastWindow['today'];
    readonly payload: ProposalPayload;
    readonly model: string;
    readonly rejectedProposalId: string | null;
  },
) =>
  proposalStage(
    'persist',
    sql
      .withTransaction(
        Effect.gen(function* () {
          const proposal = yield* proposals.insert(
            date,
            payload,
            payload.headline,
            model,
          );
          yield* outfits.savePlan(date, {
            entries: payload.items.map(({ garmentId, slot }) => ({
              garmentId,
              slot,
            })),
            basedOn: null,
            forecast,
          });
          if (rejectedProposalId !== null) {
            yield* proposals.setStatus(rejectedProposalId, 'rejected');
          }
          return proposal;
        }),
      )
      .pipe(
        Effect.catchTag('SqlError', (cause) =>
          Effect.fail(writeError('The daily suggestion')(cause)),
        ),
      ),
  );

/** Asks Gemini for the day, given a forecast window and what to leave out. */
const generateProposal = (
  {
    sql,
    outfits,
    garments,
    wearLog,
    proposals,
    notes,
    media,
    gemini,
  }: GenerateDeps,
  clock: WardrobeClock,
  forecast: ForecastWindow,
  options: GenerateOptions,
) =>
  Effect.gen(function* () {
    const [all, history, occasion, plan, todayPlan, saved] =
      yield* proposalStage(
        'context',
        Effect.all([
          garments.list(),
          wearLog.history(),
          notes.read(clock.today),
          outfits.plan(clock.today),
          outfits.plan(clock.actualToday),
          outfits.list(),
        ]),
      );
    yield* validateEntries(options.pinned, all, false);
    const log = projectedLog(history, todayPlan, clock);
    const input: RotationInput = {
      cleanTop: cleanTopOn(
        clock.today,
        clock.settings.cleanTopAnchor,
        plan.cleanTop,
      ),
      today: clock.today,
      log,
      garments: all,
      settings: clock.settings,
      excluded: options.excluded,
    };
    const continuing = (options.releaseAll ? [] : continuations(input)).filter(
      (item) =>
        !options.pinned.some(
          (pin) => pin.slot === item.slot || pin.garmentId === item.garment.id,
        ),
    );
    const slotChoices = choicesWithPins(input, continuing, options.pinned);
    const empty = slotChoices.find(
      (open) =>
        open.required &&
        open.candidates.length === 0 &&
        !continuing.some((c) => c.slot === open.slot),
    );
    if (empty !== undefined) {
      return yield* new SlotEmptyError(empty.slot);
    }
    const images = yield* proposalStage(
      'images',
      proposalImages(
        media,
        [
          ...continuing.map((c) => c.garment),
          ...slotChoices.flatMap((open) =>
            open.candidates.map((c) => c.garment),
          ),
        ].map((garment) => ({
          garmentId: garment.id,
          image: displayImage(garment),
        })),
      ),
    );
    const prompt = buildProposalPrompt({
      cleanTop: input.cleanTop,
      today: clock.today,
      weather: forecast.today,
      yesterday: forecast.yesterday,
      upcoming: forecast.upcoming,
      forecastStale: forecast.stale,
      occasion,
      continuations: continuing,
      slotChoices,
      recent: recentSummary(log, all, clock.today),
      imageFor: (garment) => images.get(garment.id),
    });
    const answer = yield* proposalStage(
      'model',
      ask(gemini, withOutfitContext(prompt, options.pinned, saved)),
    );
    const items = yield* answerToItems(answer, prompt.aliases, input);
    if (
      options.pinned.some(
        (pin) =>
          !items.some(
            (item) =>
              item.slot === pin.slot && item.garmentId === pin.garmentId,
          ),
      )
    ) {
      return yield* new ProposalAnswerError(
        'The answer changed a selected piece.',
      );
    }
    const payload: ProposalPayload = {
      items,
      headline: answer.headline,
      excludedGarmentIds: [...options.excluded],
      forecastStale: forecast.stale,
      occasion,
    };
    return yield* persistProposal(
      { sql, outfits, proposals },
      {
        date: clock.today,
        forecast: forecast.today,
        payload,
        model: gemini.model,
        rejectedProposalId: options.rejectedProposalId,
      },
    );
  });

export class ProposalService extends Effect.Service<ProposalService>()(
  'rota/ProposalService',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const outfits = yield* OutfitRepository;
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
          { sql, outfits, garments, wearLog, proposals, notes, media, gemini },
          clock,
          forecast,
          options,
        );

      const settlement: SettlementDeps = {
        outfits,
        proposals,
        wearLog,
        forecasts,
        generate,
      };

      return yield* makeProposalOperations(settlement);
    }),
  },
) {}
