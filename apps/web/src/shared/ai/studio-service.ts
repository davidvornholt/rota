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
    const render = (input: StudioRenderInput, report: ReportStudioProgress) =>
      Effect.suspend(() => {
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
              .pipe(Effect.andThen(requestEdit(connection, input, opaque)));
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
        return scheduler.schedule(request, report);
      });
    return { render };
  });
