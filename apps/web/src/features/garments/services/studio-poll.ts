import { Data, Duration, Effect } from 'effect';
import { studioPollRequestTimeout } from '#/shared/ai/studio-budgets.ts';
import type { StudioState } from '#/shared/ai/studio-progress.ts';
import { isRendering } from '#/shared/data/garment-view.ts';

export class StudioRequestError extends Data.TaggedError('StudioRequestError')<{
  readonly message: string;
}> {}

export const studioRequest = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (error) =>
      new StudioRequestError({
        message:
          error instanceof Error
            ? error.message
            : 'The studio request failed. Try again.',
      }),
  }).pipe(
    Effect.timeoutFail({
      duration: studioPollRequestTimeout,
      onTimeout: () =>
        new StudioRequestError({
          message:
            'The studio status could not be checked. Refresh to check its progress.',
        }),
    }),
  );

export const pollStudioRender = <
  A extends {
    readonly studioError: string | null;
    readonly studioState: StudioState;
  },
>(
  read: () => Promise<A>,
) =>
  Effect.gen(function* () {
    yield* Effect.sleep(Duration.seconds(2));
    const next = yield* studioRequest(read);
    if (next.studioError !== null) {
      return yield* new StudioRequestError({
        message: `The studio render failed: ${next.studioError}`,
      });
    }
    return next;
  }).pipe(
    Effect.repeat({
      until: (next) => !isRendering(next),
    }),
  );
