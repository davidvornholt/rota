import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  decodeAcceptGarmentInput,
  decodeGarmentCareInput,
  decodeGarmentId,
  decodeImageChoiceInput,
  decodeRetryStudioInput,
  decodeUpdateGarmentInput,
} from '../schemas/garment-input.ts';
import { garmentView, garmentViews } from './garment-views.ts';
import { garmentsRuntime } from './garments-runtime.ts';
import { IngestService } from './ingest.ts';

export type WardrobeView = {
  readonly today: LocalDate;
  /** Garments still being read or waiting for the one-tap accept. */
  readonly queue: ReadonlyArray<GarmentView>;
  readonly active: ReadonlyArray<GarmentView>;
  readonly retired: ReadonlyArray<GarmentView>;
};

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

export const acceptGarmentFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeAcceptGarmentInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const garments = yield* GarmentRepository;
          yield* garments.update(data.id, data.edit);
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
          yield* garments.update(data.id, data.edit);
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

export const retryStudioFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeRetryStudioInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const ingest = yield* IngestService;
          yield* ingest.retryStudio(data.id, data.edit, data.instructions);
          return yield* garmentView(data.id);
        }),
      ),
  );

export const setGarmentCareFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeGarmentCareInput(input))
  .handler(
    ({ data }): Promise<GarmentView> =>
      garmentsRuntime.run(
        Effect.gen(function* () {
          const garments = yield* GarmentRepository;
          const clock = yield* readWardrobeClock();
          yield* garments.setCare(
            [data.id],
            data.care,
            clock.actualToday,
            clock.settings.laundryDays,
          );
          return yield* garmentView(data.id);
        }),
      ),
  );
