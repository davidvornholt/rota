import { Effect } from 'effect';
import type { ImagePart } from '#/shared/ai/gemini-request.ts';
import type { GarmentImage } from '#/shared/data/garment.ts';
import type { MediaStore } from '#/shared/media/media-store.ts';
import { ProposalGenerationError } from '../errors/rota-errors.ts';

const imageConcurrency = 4;
const imageDeadline = '20 seconds';
const preparationDeadline = '45 seconds';

type CandidateImage = {
  readonly garmentId: string;
  readonly image: GarmentImage | undefined;
};

/** Missing files remain optional; a stalled or failed store must not silently degrade the model's input. */
export const proposalImages = (
  media: Pick<MediaStore, 'get'>,
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
        const bytes = yield* media.get(image.key).pipe(
          Effect.mapError((cause) => new ProposalGenerationError(false, cause)),
          Effect.timeoutFail({
            duration: imageDeadline,
            onTimeout: () =>
              new ProposalGenerationError(
                true,
                'Image read deadline exceeded.',
              ),
          }),
        );
        return [
          garmentId,
          bytes === undefined
            ? undefined
            : ({
                mimeType: image.mime,
                data: bytes,
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
    Effect.timeoutFail({
      duration: preparationDeadline,
      onTimeout: () =>
        new ProposalGenerationError(
          true,
          'Image preparation deadline exceeded.',
        ),
    }),
  );
