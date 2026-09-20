import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';
import {
  decodePlanningAction,
  decodePlanningDate,
} from '../schemas/planning-input.ts';
import {
  decodeSuggestionStart,
  decodeSuggestionStatus,
} from '../schemas/suggestion-job.ts';
import { dateClock } from './planning-rules.ts';
import {
  changePlanning,
  planningView,
  suggestPlanning,
} from './planning-service.ts';
import { rotaRuntime } from './rota-runtime.ts';
import { SuggestionJobs } from './suggestion-jobs.ts';

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
  .validator((input: unknown) => {
    const data = decodePlanningAction(input);
    if (data.change.action === 'suggest') {
      throw new ProposalStateError('Start a background suggestion instead.');
    }
    return data;
  })
  .handler(({ data }) =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const clock = yield* dateClock(yield* readWardrobeClock(), data.date);
        return yield* changePlanning(clock, data.change);
      }),
    ),
  );

export const startSuggestionFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeSuggestionStart(input))
  .handler(({ data }) =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const jobs = yield* SuggestionJobs;
        const clock = yield* dateClock(yield* readWardrobeClock(), data.date);
        return yield* jobs.start(
          data.date,
          data.requestId,
          suggestPlanning(clock, data.entries),
        );
      }),
    ),
  );

export const suggestionStatusFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeSuggestionStatus(input))
  .handler(({ data }) =>
    rotaRuntime.run(
      Effect.gen(function* () {
        const jobs = yield* SuggestionJobs;
        return yield* jobs.status(data.date, data.requestId);
      }),
    ),
  );
