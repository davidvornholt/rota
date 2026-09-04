import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import {
  type GarmentView,
  toGarmentView,
  wearFactsByGarment,
} from '#/shared/data/garment-view.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  decodeAcceptGarmentInput,
  decodeGarmentId,
  decodeImageChoiceInput,
  decodeUpdateGarmentInput,
  type GarmentEdit,
} from '../schemas/garment-input.ts';
import { garmentsRuntime } from './garments-runtime.ts';
import { IngestService } from './ingest.ts';

export type WardrobeView = {
  readonly today: LocalDate;
  /** Garments still being read or waiting for the one-tap accept. */
  readonly queue: ReadonlyArray<GarmentView>;
  readonly active: ReadonlyArray<GarmentView>;
  readonly retired: ReadonlyArray<GarmentView>;
};

// A function, not a module-level Effect: the browser imports this module for
// its RPC stubs, and a top-level Effect would drag the server runtime along.
const garmentViews = () =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const wearLog = yield* WearLogRepository;
    const media = yield* MediaStore;
    const clock = yield* readWardrobeClock();
    const [rows, log] = yield* Effect.all([garments.list(), wearLog.history()]);
    const facts = wearFactsByGarment(log, clock.today);
    return {
      today: clock.today,
      views: rows.map((row) =>
        toGarmentView({
          garment: row,
          facts: facts.get(row.id),
          categoryBudgets: clock.settings.categoryBudgets,
          today: clock.today,
          urlFor: media.urlFor,
        }),
      ),
    };
  });

const garmentView = (id: string) =>
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

export const wardrobeFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler(
    (): Promise<WardrobeView> =>
      garmentsRuntime.run(
        Effect.map(garmentViews(), ({ today, views }) => ({
          today,
          queue: views.filter(
            (view) => view.status === 'processing' || view.status === 'review',
          ),
          active: views.filter((view) => view.status === 'active'),
          retired: views.filter((view) => view.status === 'retired'),
        })),
      ),
  );

export const garmentFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(garmentView(data.id)),
  );

const attributesOf = (edit: GarmentEdit) => ({
  ...edit,
  seasons: edit.seasons,
});

export const acceptGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeAcceptGarmentInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const garments = yield* GarmentRepository;
          yield* garments.update(data.id, attributesOf(data.edit));
          yield* garments.setImageChoice(data.id, data.imageChoice);
          yield* garments.setStatus(data.id, 'active');
          return yield* garmentView(data.id);
        }),
      ),
  );

export const updateGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeUpdateGarmentInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const garments = yield* GarmentRepository;
          yield* garments.update(data.id, attributesOf(data.edit));
          return yield* garmentView(data.id);
        }),
      ),
  );

export const setImageChoiceFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeImageChoiceInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const garments = yield* GarmentRepository;
          yield* garments.setImageChoice(data.id, data.imageChoice);
          return yield* garmentView(data.id);
        }),
      ),
  );

const setStatus = (id: string, status: 'active' | 'retired') =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    yield* garments.byId(id);
    yield* garments.setStatus(id, status);
    return yield* garmentView(id);
  });

// Written out twice rather than made by a helper: the compiler only finds a
// server function's handler when the `createServerFn` chain is in plain sight.
export const retireGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(setStatus(data.id, 'retired')),
  );

export const restoreGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(setStatus(data.id, 'active')),
  );

export const deleteGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(
    ({ data }): Promise<void> =>
      garmentsRuntime.run(
        Effect.flatMap(GarmentRepository, (garments) =>
          garments.remove(data.id),
        ),
      ),
  );

/** Starts the pipeline again from the photo; the answer does not wait for it. */
export const reprocessGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(({ data }): Promise<void> => {
    garmentsRuntime.fork(
      Effect.flatMap(IngestService, (ingest) => ingest.process(data.id)),
    );
    return Promise.resolve();
  });

export const retryStudioFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentId(input))
  .handler(({ data }): Promise<void> => {
    garmentsRuntime.fork(
      Effect.flatMap(IngestService, (ingest) => ingest.retryStudio(data.id)),
    );
    return Promise.resolve();
  });
