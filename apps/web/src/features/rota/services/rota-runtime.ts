import { Effect, Layer } from 'effect';
import { asIdentity, type Identity } from '#/shared/auth/identity.ts';
import { ensureOwner } from '#/shared/auth/session.ts';
import { pool } from '#/shared/db/pool.ts';

import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ForecastService } from './forecast-service.ts';
import { ProposalService } from './proposal-service.ts';
import { SuggestionJobs } from './suggestion-jobs.ts';
import { TodayService } from './today-service.ts';

/** The rota feature's runtime, in its own server-only module. */
export const rotaRuntime = featureRuntime('rota', () =>
  TodayService.Default.pipe(
    Layer.provideMerge(ProposalService.Default),
    Layer.provideMerge(ForecastService.Default),
    Layer.merge(SuggestionJobs.Default),
  ),
);

/** The scheduler's entry: called by the server process through the tick route, never by a browser. */
const tickOne = (): Promise<'skipped' | 'decided' | 'proposed' | 'failed'> =>
  rotaRuntime.run(
    Effect.gen(function* () {
      const clock = yield* readWardrobeClock();
      const today = yield* TodayService;
      return yield* today.tick(clock);
    }),
  );

export const runScheduledTick = async () => {
  await ensureOwner();
  const result =
    await pool.query<Identity>(`select id, user_id as "userId", name, admin from member
    where enabled and (admin or exists (select 1 from passkey where user_id = member.user_id))`);
  const outcomes: Array<string> = [];
  for (const identity of result.rows) {
    // biome-ignore lint/performance/noAwaitInLoops: Serialize wardrobes to avoid a scheduled burst of paid API requests.
    outcomes.push(await asIdentity(identity, tickOne).catch(() => 'failed'));
  }
  return outcomes;
};
