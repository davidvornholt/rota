/**
 * From a phone photo to a garment ready for review.
 *
 * `start` does the little that has to happen before the upload is answered:
 * store the photo and open the garment row. `process` does the slow part in the
 * background — Gemini reads the garment, then GPT-Image-2 renders the studio
 * flat lay — and never fails as an Effect: whatever goes wrong is written onto
 * the garment, which still reaches review with the photo it has, so nothing
 * you photographed is ever lost to a model that was down.
 */

import { Effect } from 'effect';
import { Gemini } from '#/shared/ai/gemini.ts';
import { StudioRenderer } from '#/shared/ai/studio-renderer.ts';
import type { Garment } from '#/shared/data/garment.ts';
import {
  type GarmentAttributes,
  GarmentRepository,
  type StoredImage,
} from '#/shared/data/garment-repository.ts';
import { categoryDefaults } from '#/shared/data/garment-types.ts';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import { isStorableMime, MediaStore } from '#/shared/media/media-store.ts';
import { UploadError } from '../errors/garment-errors.ts';
import {
  type Extraction,
  ExtractionSchema,
  extractionJsonSchema,
  extractionPrompt,
  extractionSystemPrompt,
} from '../schemas/extraction.ts';
import { makeStudioJobs } from './studio-jobs.ts';
import { makeStudioWork, renderStudio } from './studio-render-job.ts';

export type Upload = {
  readonly bytes: Uint8Array;
  readonly mime: string;
};

/** Photos are downscaled in the browser before upload; anything larger did not come from the app. */
const bytesPerKibibyte = 1024;
const bytesPerMebibyte = bytesPerKibibyte * bytesPerKibibyte;
const uploadLimitMebibytes = 6;
export const maximumUploadBytes = uploadLimitMebibytes * bytesPerMebibyte;

const unreadablePhoto = new UploadError({
  message: 'That file is not a readable JPEG or PNG photo.',
  httpStatus: 400,
});

/** Everything that can be wrong with an upload before any byte is stored. */
export const validateUpload = (upload: Upload): UploadError | undefined => {
  if (!isStorableMime(upload.mime)) {
    return new UploadError({
      message: 'Only JPEG, PNG, and WebP photos can be added.',
      httpStatus: 400,
    });
  }
  if (upload.bytes.byteLength > maximumUploadBytes) {
    return new UploadError({
      message:
        'That photo is too large. Photos are resized in the app before upload; try again from the app.',
      httpStatus: 413,
    });
  }
  return imageDimensions(upload.bytes) === undefined
    ? unreadablePhoto
    : undefined;
};

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
  seasons: extraction.seasons,
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

/** A garment's description for the render prompt, from its accepted or extracted fields. */
export const renderDescription = (garment: Garment): string =>
  [
    garment.name,
    garment.material === '' ? undefined : `made of ${garment.material}`,
    garment.pattern === '' || garment.pattern === 'solid'
      ? undefined
      : `with a ${garment.pattern} pattern`,
    garment.colors.length === 0
      ? undefined
      : `in ${garment.colors.map((color) => color.name).join(' and ')}`,
  ]
    .filter((part) => part !== undefined)
    .join(', ');

type IngestDependencies = {
  readonly garments: GarmentRepository;
  readonly media: MediaStore;
  readonly gemini: Gemini;
  readonly studio: StudioRenderer;
};

const storeUpload = ({ media }: IngestDependencies, upload: Upload) =>
  Effect.gen(function* () {
    const rejection = validateUpload(upload);
    if (rejection !== undefined) {
      return yield* rejection;
    }
    const dimensions = imageDimensions(upload.bytes);
    if (dimensions === undefined) {
      return yield* unreadablePhoto;
    }
    const stored = yield* media.put(upload.bytes, upload.mime);
    const image: StoredImage = {
      key: stored.key,
      mime: upload.mime,
      width: dimensions.width,
      height: dimensions.height,
      bytes: stored.bytes,
    };
    return image;
  });

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
    return { bytes, mime: original.mime };
  });

/** Gemini reads the photo; the reading lands on the row and review opens. */
const readGarment = (deps: IngestDependencies, garment: Garment) =>
  Effect.gen(function* () {
    const photo = yield* originalPhoto(deps, garment);
    const extraction = yield* deps.gemini.generateJson({
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
        jobs.start(id, (report) =>
          Effect.gen(function* () {
            const garment = yield* garments.byId(id);
            const extraction = yield* readGarment(deps, garment);
            const read = yield* garments.byId(id);
            yield* studioWork(
              id,
              renderStudio(deps, {
                garment: read,
                description: extraction.description,
                photoEffect: originalPhoto(deps, read),
                report,
              }),
            );
          }).pipe(
            Effect.catchAll(recordFailure(id, 'Reading the photo')),
            Effect.catchAllDefect(recordFailure(id, 'Processing')),
          ),
        );

      /** Renders the studio image again for a garment whose attributes are already known. */
      const retryStudio = (id: string): Effect.Effect<void> =>
        jobs.start(id, (report) =>
          studioWork(
            id,
            Effect.gen(function* () {
              const garment = yield* garments.byId(id);
              yield* renderStudio(deps, {
                garment,
                description: renderDescription(garment),
                photoEffect: originalPhoto(deps, garment),
                report,
              });
            }),
          ),
        );

      return { start, process, retryStudio, studioProgress: jobs.progress };
    }),
  },
) {}
