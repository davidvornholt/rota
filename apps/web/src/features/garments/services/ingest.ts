/**
 * From a phone photo to a garment ready for review.
 *
 * `start` does the little that has to happen before the upload is answered:
 * store the photo and open the garment row. `process` does the slow part in the
 * background — Gemini reads the garment, then GPT-Image-2.5 Flare renders the studio
 * flat lay — and never fails as an Effect: whatever goes wrong is written onto
 * the garment, which still reaches review with the photo it has, so nothing
 * you photographed is ever lost to a model that was down.
 */

import { Effect } from 'effect';
import { StudioRenderError } from '#/shared/ai/errors/ai-errors.ts';
import { Gemini } from '#/shared/ai/gemini.ts';
import { StudioRenderer } from '#/shared/ai/studio-renderer.ts';
import type { Garment } from '#/shared/data/garment.ts';
import {
  type GarmentAttributes,
  GarmentRepository,
} from '#/shared/data/garment-repository.ts';
import { categoryDefaults } from '#/shared/data/garment-types.ts';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import { maximumSourcePixels } from '#/shared/media/image-limits.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { rotateImage } from '#/shared/media/rotate-image.ts';
import {
  type Extraction,
  ExtractionSchema,
  extractionJsonSchema,
  extractionPrompt,
  extractionSystemPrompt,
} from '../schemas/extraction.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { renderDescription } from '../schemas/render-description.ts';
import { orientStudioPhoto } from './orient-studio-photo.ts';
import {
  replaceOriginalPhoto,
  storeUpload,
  type Upload,
} from './photo-upload.ts';
import { makeStudioJobs } from './studio-jobs.ts';
import {
  makeStudioWork,
  renderStudio,
  withStudioPersistenceDeadline,
} from './studio-render-job.ts';

/** The model's reading, as the garment row stores it. A budget equal to the category default stays null so later category changes apply. */
export const attributesFromExtraction = (
  extraction: Extraction,
): GarmentAttributes => ({
  name: extraction.name,
  category: extraction.category,
  subcategory: extraction.subcategory,
  slots: extraction.slots,
  warmth: extraction.warmth,
  rainOk: extraction.rainOk,
  formality: extraction.formality,
  wearBudget:
    extraction.wearBudgetDays === categoryDefaults[extraction.category].budget
      ? null
      : extraction.wearBudgetDays,
  colors: extraction.colors,
  pattern: extraction.pattern,
  material: extraction.material,
  fit: extraction.fit,
  sleeve: extraction.sleeve,
  brand: extraction.brand,
  notes: '',
  price: null,
  purchasedOn: null,
});

const messageOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return String(value.message);
  }
  return undefined;
};

const failureDetailLimit = 300;

/** The failure and, when it carries one, the cause underneath: what the card shows the wearer. */
const describeFailure = (error: unknown): string => {
  const message = messageOf(error) ?? String(error);
  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? messageOf(error.cause)
      : undefined;
  const detail =
    cause === undefined || cause === message ? message : `${message} ${cause}`;
  return detail.length > failureDetailLimit
    ? `${detail.slice(0, failureDetailLimit)} …`
    : detail;
};

type IngestDependencies = {
  readonly garments: GarmentRepository;
  readonly media: MediaStore;
  readonly gemini: Gemini;
  readonly studio: StudioRenderer;
};

const originalPhoto = ({ media }: IngestDependencies, garment: Garment) =>
  Effect.gen(function* () {
    const { original } = garment.images;
    if (original === undefined) {
      return yield* Effect.fail(new Error('The garment has no photo.'));
    }
    const bytes = yield* media.get(original.key);
    if (bytes === undefined) {
      return yield* Effect.fail(
        new Error('The photo is missing from the media store.'),
      );
    }
    const dimensions = imageDimensions(bytes);
    if (
      dimensions === undefined ||
      dimensions.width * dimensions.height > maximumSourcePixels
    ) {
      return yield* Effect.fail(
        new Error('The stored source photo is too large to process.'),
      );
    }
    return { bytes, mime: original.mime };
  });

/** Gemini reads the photo; the reading lands on the row and review opens. */
const readGarment = (deps: IngestDependencies, garment: Garment) =>
  Effect.gen(function* () {
    const photo = yield* originalPhoto(deps, garment);
    const extraction = yield* deps.gemini.generateJson({
      purpose: 'garment',
      system: extractionSystemPrompt,
      parts: [
        { image: { mimeType: photo.mime, data: photo.bytes } },
        { text: extractionPrompt },
      ],
      schema: ExtractionSchema,
      jsonSchema: extractionJsonSchema,
    });
    yield* deps.garments.applyExtraction(
      garment.id,
      attributesFromExtraction(extraction),
      extraction,
    );
    return extraction;
  });

const renderInProgress = new StudioRenderError({
  message:
    'A studio picture is already in progress. Wait for it to finish before changing the render.',
  cause: undefined,
});

export class IngestService extends Effect.Service<IngestService>()(
  'garments/IngestService',
  {
    effect: Effect.gen(function* () {
      const deps: IngestDependencies = {
        garments: yield* GarmentRepository,
        media: yield* MediaStore,
        gemini: yield* Gemini,
        studio: yield* StudioRenderer,
      };
      const { garments } = deps;
      const jobs = makeStudioJobs();

      /** Stores the photo and opens the garment; the caller starts `process`. */
      const start = (upload: Upload) =>
        storeUpload(deps, upload).pipe(Effect.flatMap(garments.create));

      const recordFailure = (id: string, step: string) => (error: unknown) =>
        Effect.logWarning(`${step} failed for garment ${id}.`, error).pipe(
          Effect.andThen(
            garments.markProcessingError(
              id,
              `${step}: ${describeFailure(error)}`,
            ),
          ),
          Effect.catchAll(() => Effect.void),
        );

      const studioWork = makeStudioWork(garments);

      /** The whole pipeline for one garment. Never fails; failures land on the row. */
      const process = (id: string): Effect.Effect<void> =>
        jobs
          .start(id, (report) =>
            Effect.gen(function* () {
              const garment = yield* garments.byId(id);
              const extraction = yield* readGarment(deps, garment);
              const read = yield* garments.byId(id);
              yield* studioWork(
                id,
                renderStudio(deps, {
                  garment: read,
                  description: extraction.description,
                  instructions: '',
                  photoEffect: originalPhoto(deps, read).pipe(
                    Effect.flatMap((photo) =>
                      rotateImage(photo, extraction.rotationClockwise),
                    ),
                  ),
                  report,
                }),
              );
            }).pipe(
              Effect.catchAll(recordFailure(id, 'Reading the photo')),
              Effect.catchAllDefect(recordFailure(id, 'Processing')),
            ),
          )
          .pipe(Effect.asVoid);

      /** Renders the studio image again for a garment whose attributes are already known. */
      const retryStudio = (
        id: string,
        edit: GarmentEdit,
        instructions: string,
      ) =>
        jobs
          .start(id, (report) =>
            studioWork(
              id,
              Effect.gen(function* () {
                const garment = yield* garments
                  .update(id, edit)
                  .pipe(
                    Effect.andThen(garments.byId(id)),
                    withStudioPersistenceDeadline,
                  );
                yield* renderStudio(deps, {
                  garment,
                  description: renderDescription(edit),
                  instructions,
                  photoEffect: originalPhoto(deps, garment).pipe(
                    Effect.flatMap((photo) =>
                      orientStudioPhoto(deps.gemini, photo),
                    ),
                  ),
                  report,
                });
              }),
            ),
          )
          .pipe(
            Effect.flatMap((started) =>
              started ? Effect.void : Effect.fail(renderInProgress),
            ),
          );

      return {
        start,
        process,
        retryStudio,
        replacePhoto: (id: string, upload: Upload) =>
          replaceOriginalPhoto(deps, jobs.progress().has(id), id, upload),
        studioProgress: jobs.progress,
      };
    }),
  },
) {}
