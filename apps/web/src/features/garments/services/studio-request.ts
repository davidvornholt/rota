import { Data, Duration, Effect } from 'effect';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { garmentFn, retryStudioFn } from './garments-fns.ts';

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
      return yield* Effect.gen(function* () {
        yield* Effect.sleep(Duration.seconds(2));
        const next = yield* request(() => garmentFn({ data: { id: data.id } }));
        if (next.processingError !== null) {
          return yield* new StudioRequestError({
            message: `Your changes were saved, but the studio render failed: ${next.processingError}`,
          });
        }
        return next;
      }).pipe(
        Effect.repeat({
          until: (next) => next.studio?.url !== before.studio?.url,
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
