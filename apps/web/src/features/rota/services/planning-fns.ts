import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  decodePlanningAction,
  decodePlanningDate,
} from '../schemas/planning-input.ts';
import { dateClock } from './planning-rules.ts';
import { changePlanning, planningView } from './planning-service.ts';
import { rotaRuntime } from './rota-runtime.ts';

export const planningFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodePlanningDate(input))
  .handler(({ data }) =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const clock = yield* readWardrobeClock();
        return yield* planningView(
          yield* dateClock(clock, data.date ?? clock.today),
        );
      }),
    ),
  );
export const changePlanningFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodePlanningAction(input))
  .handler(({ data }) =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const clock = yield* dateClock(yield* readWardrobeClock(), data.date);
        return yield* changePlanning(clock, data.change);
      }),
    ),
  );
