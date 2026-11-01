import { Effect } from 'effect';

import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { GarmentLifecycleError } from '../errors/garment-errors.ts';
import { garmentView } from './garment-views.ts';

export const setRetired = (id: string, retired: boolean) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const garment = yield* garments.byId(id);
    const status = retired ? 'retired' : 'active';
    if (garment.status !== status) {
      if (garment.status !== 'active' && garment.status !== 'retired') {
        return yield* new GarmentLifecycleError(
          'This garment is still being added. Accept it into the wardrobe or delete it.',
        );
      }
      yield* garments.setStatus(id, status);
    }
    return yield* garmentView(id);
  });

export const deleteGarment = (id: string) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    yield* garments.byId(id);
    const wearLog = yield* WearLogRepository;
    const history = yield* wearLog.history();
    if (history.some((entry) => entry.garmentId === id)) {
      return yield* new GarmentLifecycleError(
        'This garment has been worn, so it can only be retired, which keeps its history.',
      );
    }
    yield* garments.remove(id);
  });
