import { Effect, Layer } from 'effect';

import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ForecastService } from './forecast-service.ts';
import { ProposalService } from './proposal-service.ts';
import { TodayService } from './today-service.ts';

/** The rota feature's runtime, in its own server-only module. */
export const rotaRuntime = featureRuntime('rota', () =>
  TodayService.Default.pipe(
    Layer.provideMerge(ProposalService.Default),
    Layer.provideMerge(ForecastService.Default),
  ),
);

/** The scheduler's entry: called by the server process through the tick route, never by a browser. */
export const runScheduledTick = (): Promise<
  'skipped' | 'decided' | 'proposed' | 'failed'
> =>
  rotaRuntime.run(
    Effect.gen(function* () {
      const clock = yield* readWardrobeClock();
      const today = yield* TodayService;
      return yield* today.tick(clock);
    }),
  );
