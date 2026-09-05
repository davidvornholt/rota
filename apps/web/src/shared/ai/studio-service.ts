import { Duration, Effect } from 'effect';
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

const overallTimeout = Duration.minutes(10);

export const makeStudioRenderer = (connection: StudioConnection) =>
  Effect.gen(function* () {
    const scheduler = yield* makeStudioScheduler;
    const render = (input: StudioRenderInput, report: ReportStudioProgress) => {
      const [transparent, opaque] = attempts(input);
      if (transparent === undefined || opaque === undefined) {
        return Effect.die('Studio render attempts are missing.');
      }
      return report({ status: 'queued' }).pipe(
        Effect.andThen(
          scheduler.schedule(
            requestEdit(connection, input, transparent),
            report,
          ),
        ),
        Effect.catchTag('TransparencyRefusal', () =>
          scheduler
            .schedule(requestEdit(connection, input, opaque), report)
            .pipe(
              Effect.catchTag('TransparencyRefusal', (error) =>
                Effect.fail(
                  new StudioRenderError({
                    message:
                      'The image service refused the studio picture. Try a different photo.',
                    cause: error,
                  }),
                ),
              ),
            ),
        ),
        Effect.timeoutFail({
          duration: overallTimeout,
          onTimeout: () =>
            new StudioRenderError({
              message: 'The studio picture took too long. Try again later.',
              cause: undefined,
            }),
        }),
      );
    };
    return { render };
  });
