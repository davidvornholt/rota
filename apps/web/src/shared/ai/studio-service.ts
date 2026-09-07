import { Effect } from 'effect';
import { StudioRenderError } from './errors/ai-errors.ts';
import {
  attempts,
  requestEdit,
  type StudioConnection,
  type StudioRenderInput,
} from './studio-request.ts';
import {
  makeStudioScheduler,
  type ReportStudioProgress,
} from './studio-scheduler.ts';

export const makeStudioRenderer = (connection: StudioConnection) =>
  Effect.gen(function* () {
    const scheduler = yield* makeStudioScheduler;
    const render = (
      inputEffect: Effect.Effect<StudioRenderInput, StudioRenderError>,
      report: ReportStudioProgress,
    ) =>
      Effect.gen(function* () {
        // Prepare only after acquiring a slot, then reuse the photo across retries.
        const prepared = yield* Effect.cached(
          inputEffect.pipe(
            // Another slot may receive a rate limit while this photo is loading.
            Effect.tap(() => scheduler.beforeRequest(report)),
            Effect.map((input) => {
              const [transparent, opaque] = attempts(input);
              if (transparent === undefined || opaque === undefined) {
                return Effect.die('Studio render attempts are missing.');
              }
              // Keep the fallback in the same slot and rendering budget. Rate-limit
              // retries after a refusal must continue with the opaque request.
              let attempt = transparent;
              const request = Effect.suspend(() =>
                requestEdit(connection, input, attempt),
              ).pipe(
                Effect.catchTag('TransparencyRefusal', () => {
                  attempt = opaque;
                  return scheduler
                    .beforeRequest(report)
                    .pipe(
                      Effect.andThen(requestEdit(connection, input, opaque)),
                    );
                }),
                Effect.catchTag('TransparencyRefusal', () =>
                  Effect.fail(
                    new StudioRenderError({
                      message:
                        'The image service refused the studio picture. Try a different photo.',
                      cause: undefined,
                    }),
                  ),
                ),
              );
              return request;
            }),
          ),
        );
        return yield* scheduler.schedule(Effect.flatten(prepared), report);
      });
    return { render };
  });
