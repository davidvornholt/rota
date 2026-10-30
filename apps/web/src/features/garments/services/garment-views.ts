import { Effect } from 'effect';

import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import {
  toGarmentView,
  wearFactsByGarment,
} from '#/shared/data/garment-view.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { IngestService } from './ingest.ts';

// Functions, not module-level Effects: the browser imports the server
// functions that use these for their RPC stubs, and a top-level Effect would
// drag the server runtime along.

/** Every garment of the wardrobe as the app shows it. */
export const garmentViews = () =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const wearLog = yield* WearLogRepository;
    const media = yield* MediaStore;
    const clock = yield* readWardrobeClock();
    const ingest = yield* IngestService;
    const studioProgress = ingest.studioProgress();
    const [rows, log] = yield* Effect.all([garments.list(), wearLog.history()]);
    const facts = wearFactsByGarment(log, clock.today);
    return {
      today: clock.today,
      views: rows.map((row) =>
        toGarmentView({
          garment: row,
          facts: facts.get(row.id),
          categoryBudgets: clock.settings.categoryBudgets,
          laundryDays: clock.settings.laundryDays,
          today: clock.today,
          urlFor: media.urlFor,
          studioProgress: studioProgress.get(row.id),
        }),
      ),
    };
  });

export const garmentView = (id: string) =>
  Effect.gen(function* () {
    const { views } = yield* garmentViews();
    const view = views.find((candidate) => candidate.id === id);
    if (view === undefined) {
      // byId fails with the typed not-found the browser can hear.
      yield* Effect.flatMap(GarmentRepository, (garments) => garments.byId(id));
      return yield* Effect.die('The garment vanished between two reads.');
    }
    return view;
  });
