import { Effect } from 'effect';
import type { ImagePart } from '#/shared/ai/claude-request.ts';
import type { GarmentImage } from '#/shared/data/garment.ts';
import type { MediaStore } from '#/shared/media/media-store.ts';
import {
  largeWidth,
  tileWidth,
  type VariantWidth,
} from '#/shared/media/media-variants.ts';
import { ProposalGenerationError } from '../errors/rota-errors.ts';

const imageConcurrency = 4;
const imageDeadline = '20 seconds';
const preparationDeadline = '45 seconds';

type CandidateImage = {
  readonly garmentId: string;
  readonly image: GarmentImage | undefined;
};

/**
 * The stored copy Claude sees: 640 pixels wide for a portrait or square picture
 * and 1280 for a landscape photo, so a garment shows at a similar size either
 * way.
 */
export const proposalWidth = (image: GarmentImage): VariantWidth =>
  image.width > image.height ? largeWidth : tileWidth;

/** Missing files remain optional; a stalled or failed store must not silently degrade the model's input. */
export const proposalImages = (
  media: Pick<MediaStore['Service'], 'variant'>,
  shown: ReadonlyArray<CandidateImage>,
) =>
  Effect.forEach(
    [
      ...new Map(
        shown.map((candidate) => [candidate.garmentId, candidate]),
      ).values(),
    ],
    ({ garmentId, image }) =>
      Effect.gen(function* () {
        if (image === undefined) {
          return [garmentId, undefined] as const;
        }
        const served = yield* media
          .variant(image.key, proposalWidth(image))
          .pipe(
            Effect.mapError(
              (cause) => new ProposalGenerationError(false, cause),
            ),
            Effect.timeoutOrElse({
              duration: imageDeadline,
              orElse: () =>
                Effect.fail(
                  new ProposalGenerationError(
                    true,
                    'Image read deadline exceeded.',
                  ),
                ),
            }),
          );
        return [
          garmentId,
          served === undefined
            ? undefined
            : ({
                mimeType: served.mime,
                data: served.bytes,
              } satisfies ImagePart),
        ] as const;
      }),
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
    Effect.timeoutOrElse({
      duration: preparationDeadline,
      orElse: () =>
        Effect.fail(
          new ProposalGenerationError(
            true,
            'Image preparation deadline exceeded.',
          ),
        ),
    }),
  );
