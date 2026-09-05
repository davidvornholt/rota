import { Effect } from 'effect';
import type { StudioProgress } from '#/shared/ai/studio-progress.ts';
import type { ReportStudioProgress } from '#/shared/ai/studio-scheduler.ts';

/** Owned by the garments runtime; a job includes extraction, rendering, and storage. */
export const makeStudioJobs = () => {
  const active = new Map<string, StudioProgress>();
  const start = (
    id: string,
    work: (report: ReportStudioProgress) => Effect.Effect<void>,
  ) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        if (active.has(id)) {
          return false;
        }
        active.set(id, { status: 'queued' });
        const report: ReportStudioProgress = (progress) =>
          Effect.sync(() => {
            active.set(id, progress);
          });
        yield* work(report).pipe(
          restore,
          Effect.ensuring(
            Effect.sync(() => {
              active.delete(id);
            }),
          ),
          Effect.forkDaemon,
        );
        return true;
      }),
    );
  return { start, progress: () => new Map(active) };
};
