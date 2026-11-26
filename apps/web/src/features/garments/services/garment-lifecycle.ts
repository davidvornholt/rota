import type { GarmentChanges } from '@rota/api/api';
import { Effect } from 'effect';

import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { isRendering } from '#/shared/data/garment-view.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { GarmentLifecycleError } from '../errors/garment-errors.ts';
import { changedEdit, checkedEdit, storedFields } from './changed-edit.ts';
import { garmentView } from './garment-views.ts';

const stillReading =
  "Rota is still reading this garment's photo. Try again in a minute.";

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

/**
 * Saves a client's changes under the revision just read, so an edit from the
 * web app in between is never undone.
 */
export const editGarment = (id: string, changes: GarmentChanges) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const garment = yield* garments.byId(id);
    if (garment.status === 'processing') {
      // The reading would overwrite the change when it lands.
      return yield* new GarmentLifecycleError(stillReading);
    }
    const edit = yield* changedEdit(garment, changes);
    yield* garments.update(id, edit, garment.revision);
    return yield* garmentView(id);
  });

/**
 * Takes a garment out of review as it reads now, showing its studio picture
 * when there is one, as the review card's one-tap accept does.
 */
export const acceptGarment = (id: string) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const garment = yield* garments.byId(id);
    if (garment.status === 'processing') {
      return yield* new GarmentLifecycleError(stillReading);
    }
    if (garment.status !== 'review') {
      return yield* new GarmentLifecycleError(
        'This garment is already in the wardrobe.',
      );
    }
    yield* checkedEdit(storedFields(garment));
    const view = yield* garmentView(id);
    if (isRendering(view)) {
      // Accepting now would settle on the photo before the render arrives.
      return yield* new GarmentLifecycleError(
        'Its studio picture is still being made. Try again in a minute.',
      );
    }
    yield* garments.accept(
      id,
      view.studio === undefined ? 'original' : 'studio',
      garment.revision,
    );
    return yield* garmentView(id);
  });
