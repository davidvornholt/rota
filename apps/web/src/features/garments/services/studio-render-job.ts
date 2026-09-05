import { Effect } from 'effect';
import { StudioRenderError } from '#/shared/ai/errors/ai-errors.ts';
import type { StudioRenderer } from '#/shared/ai/studio-renderer.ts';
import type { ReportStudioProgress } from '#/shared/ai/studio-scheduler.ts';
import type { Garment } from '#/shared/data/garment.ts';
import type { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import type { MediaStore } from '#/shared/media/media-store.ts';

type StudioDependencies = {
  readonly garments: Pick<GarmentRepository, 'attachImage' | 'setImageChoice'>;
  readonly media: Pick<MediaStore, 'put'>;
  readonly studio: Pick<StudioRenderer, 'render'>;
};

type RenderJobInput<E> = {
  readonly garment: Garment;
  readonly description: string;
  readonly photoEffect: Effect.Effect<
    { readonly bytes: Uint8Array; readonly mime: string },
    E
  >;
  readonly report: ReportStudioProgress;
};

/** GPT-Image-2 renders the flat lay; the result is stored and attached. */
export const renderStudio = <E>(
  deps: StudioDependencies,
  { garment, description, photoEffect, report }: RenderJobInput<E>,
) =>
  Effect.gen(function* () {
    const photo = yield* photoEffect;
    const render = yield* deps.studio.render(
      {
        photo: photo.bytes,
        mime: photo.mime,
        description,
      },
      report,
    );
    const stored = yield* deps.media.put(render.bytes, render.mime);
    const dimensions = imageDimensions(render.bytes);
    yield* deps.garments.attachImage(garment.id, 'studio', {
      key: stored.key,
      mime: render.mime,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      bytes: stored.bytes,
    });
    // A garment that showed its photo only because no render existed now shows
    // the render; a photo the wearer chose over an earlier render stays.
    if (garment.images.studio === undefined) {
      yield* deps.garments.setImageChoice(garment.id, 'studio');
    }
  });

export const makeStudioWork =
  (garments: Pick<GarmentRepository, 'setStudioError'>) =>
  <E>(id: string, render: Effect.Effect<void, E>) =>
    garments.setStudioError(id, null).pipe(
      Effect.andThen(render),
      Effect.catchAll((error) =>
        Effect.logWarning(
          `Studio render failed for garment ${id}.`,
          error,
        ).pipe(
          Effect.andThen(
            garments.setStudioError(
              id,
              error instanceof StudioRenderError
                ? error.message
                : 'The studio picture could not be saved. Try again later.',
            ),
          ),
        ),
      ),
      Effect.catchAllCause((cause) =>
        Effect.logWarning('Could not finish the studio job.', cause).pipe(
          Effect.andThen(
            garments.setStudioError(
              id,
              'The studio picture could not be saved. Try again later.',
            ),
          ),
          Effect.catchAll(() => Effect.void),
        ),
      ),
    );
