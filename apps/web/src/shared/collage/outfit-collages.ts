import { Effect } from 'effect';
import type { CollageRenderer } from '#/shared/ai/collage-renderer.ts';
import {
  type CollageImage,
  collageFailure,
  collageSize,
} from '#/shared/ai/collage-request.ts';
import { CollageError } from '#/shared/ai/errors/ai-errors.ts';
import { studioPersistenceTimeout } from '#/shared/ai/studio-budgets.ts';
import type { StudioProgress } from '#/shared/ai/studio-progress.ts';
import type { ReportStudioProgress } from '#/shared/ai/studio-scheduler.ts';
import type { CollageRepository } from '#/shared/data/collage-repository.ts';
import type { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { Slot } from '#/shared/data/garment-types.ts';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import type { MediaStore } from '#/shared/media/media-store.ts';
import { mediaSrcSet } from '#/shared/media/media-variants.ts';
import {
  type CollagePiece,
  collagePieces,
  piecesKey,
} from './collage-pieces.ts';
import { collagePrompt } from './collage-prompt.ts';
import type { CollagePicture, CollageState } from './collage-state.ts';

const pictureMime = 'image/png';

const failed = (cause: unknown) =>
  new CollageError({ message: collageFailure, cause });

type CollageDependencies = {
  readonly garments: Pick<GarmentRepository['Service'], 'list'>;
  readonly collages: Pick<
    CollageRepository['Service'],
    'find' | 'saveReady' | 'saveFailed'
  >;
  readonly media: Pick<MediaStore['Service'], 'get' | 'put' | 'urlFor'>;
  readonly renderer: Pick<CollageRenderer['Service'], 'render'>;
};

const pictureOf = (
  urlFor: CollageDependencies['media']['urlFor'],
  stored: {
    readonly key: string;
    readonly width: number;
    readonly height: number;
  },
): CollagePicture => ({
  url: urlFor(stored.key),
  srcSet: mediaSrcSet((width) => urlFor(stored.key, width), stored.width),
  width: stored.width,
  height: stored.height,
});

/** Renders the pieces and stores the picture, or stores the failure; never fails itself. */
const makeCollage = (
  { collages, media, renderer }: CollageDependencies,
  key: string,
  pieces: ReadonlyArray<CollagePiece>,
  report: ReportStudioProgress,
) => {
  const loadImage = (piece: CollagePiece) =>
    media.get(piece.image.key).pipe(
      Effect.mapError(failed),
      Effect.flatMap(
        (bytes): Effect.Effect<CollageImage, CollageError> =>
          bytes === undefined
            ? Effect.fail(failed(`Picture ${piece.image.key} is missing.`))
            : Effect.succeed({ bytes, mime: piece.image.mime }),
      ),
    );
  return Effect.gen(function* () {
    const bytes = yield* renderer.render(
      Effect.forEach(pieces, loadImage).pipe(
        Effect.map((images) => ({ prompt: collagePrompt(pieces), images })),
      ),
      report,
    );
    yield* Effect.gen(function* () {
      const stored = yield* media.put(bytes, pictureMime);
      yield* collages.saveReady(key, {
        key: stored.key,
        ...(imageDimensions(bytes) ?? collageSize),
      });
    }).pipe(
      Effect.timeoutOrElse({
        duration: studioPersistenceTimeout,
        orElse: () => Effect.fail(failed('Saving timed out.')),
      }),
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning('Outfit collage failed.', cause).pipe(
        Effect.andThen(collages.saveFailed(key, collageFailure)),
        Effect.catchCause((saveCause) =>
          Effect.logWarning(
            'Could not record the outfit collage failure.',
            saveCause,
          ),
        ),
      ),
    ),
  );
};

/**
 * Makes and keeps one flat-lay picture per combination of garment pictures.
 * The first request for a combination starts the image model in the
 * background and answers `pending`; the page asks again until the picture is
 * stored. A failure is stored too, so a page does not pay for a new attempt
 * on every visit; `retry` asks for one.
 */
export const makeOutfitCollages = (dependencies: CollageDependencies) => {
  const { garments, collages, media } = dependencies;
  const active = new Map<string, StudioProgress>();

  /** Starts the job unless one for the same pieces is running; the check and the claim happen together. */
  const start = (key: string, pieces: ReadonlyArray<CollagePiece>) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        if (active.has(key)) {
          return;
        }
        active.set(key, { status: 'preparing' });
        const report: ReportStudioProgress = (progress) =>
          Effect.sync(() => {
            active.set(key, progress);
          });
        yield* makeCollage(dependencies, key, pieces, report).pipe(
          restore,
          Effect.ensuring(
            Effect.sync(() => {
              active.delete(key);
            }),
          ),
          Effect.forkDetach,
        );
      }),
    );

  const pending = (key: string): CollageState => ({
    status: 'pending',
    progress: active.get(key) ?? { status: 'preparing' },
  });

  const state = (
    entries: ReadonlyArray<{
      readonly slot: Slot;
      readonly garmentId: string;
    }>,
    retry: boolean,
  ) =>
    Effect.gen(function* () {
      const pieces = collagePieces(entries, yield* garments.list());
      if (pieces.length === 0) {
        return { status: 'empty' } satisfies CollageState;
      }
      const key = piecesKey(pieces);
      if (active.has(key)) {
        return pending(key);
      }
      const stored = yield* collages.find(key);
      if (stored?.status === 'ready') {
        return {
          status: 'ready',
          picture: pictureOf(media.urlFor, stored),
        } satisfies CollageState;
      }
      if (stored?.status === 'failed' && !retry) {
        return {
          status: 'failed',
          message: stored.message,
        } satisfies CollageState;
      }
      yield* start(key, pieces);
      return pending(key);
    });

  return { state };
};
