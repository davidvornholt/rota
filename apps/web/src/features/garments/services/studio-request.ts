import { Data, Duration, Effect } from 'effect';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { garmentFn, retryStudioFn } from './garments-fns.ts';
import {
  isCompletedStudioRender,
  isCurrentStudioRender,
} from './studio-render-state.ts';

class StudioRequestError extends Data.TaggedError('StudioRequestError')<{
  readonly message: string;
}> {}

const request = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (error) =>
      new StudioRequestError({
        message:
          error instanceof Error
            ? error.message
            : 'The studio request failed. Try again.',
      }),
  });

const superseded = new StudioRequestError({
  message: 'The garment changed while rendering. Start a new studio render.',
});

// Keep the render in the server's background runtime so individual requests
// finish within the HTTP idle timeout.
export const requestStudioRender = (data: {
  readonly id: string;
  readonly edit: GarmentEdit;
  readonly instructions: string;
}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const before = yield* request(() => retryStudioFn({ data }));
      const renderId = before.studioRenderId;
      if (renderId === null) {
        return yield* new StudioRequestError({
          message: 'The studio render could not be started. Try again.',
        });
      }
      return yield* Effect.gen(function* () {
        yield* Effect.sleep(Duration.seconds(2));
        const next = yield* request(() => garmentFn({ data: { id: data.id } }));
        if (next.processingError !== null) {
          return yield* new StudioRequestError({
            message: `Your changes were saved, but the studio render failed: ${next.processingError}`,
          });
        }
        if (!isCurrentStudioRender(next, renderId)) {
          return yield* superseded;
        }
        return next;
      }).pipe(
        Effect.repeat({
          until: (next: GarmentView) => isCompletedStudioRender(next, renderId),
        }),
        Effect.timeoutFail({
          duration: Duration.minutes(10),
          onTimeout: () =>
            new StudioRequestError({
              message:
                'The studio picture is taking longer than expected. Refresh to check its progress.',
            }),
        }),
      );
    }),
  );
