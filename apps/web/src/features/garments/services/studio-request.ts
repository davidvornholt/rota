import { Effect } from 'effect';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { garmentFn, retryStudioFn } from './garments-fns.ts';
import { pollStudioRender, studioRequest } from './studio-poll.ts';

// Keep the render in the server's background runtime so individual requests
// finish within the HTTP idle timeout. The edit is saved when the render
// starts, so `onSaved` hears the garment's new revision at once: a render that
// fails later still leaves the form saved, and its next save must send that
// revision.
export const requestStudioRender = (
  data: {
    readonly id: string;
    readonly revision: number;
    readonly edit: GarmentEdit;
    readonly instructions: string;
  },
  onSaved: (saved: GarmentView) => void,
) =>
  Effect.runPromise(
    studioRequest(() => retryStudioFn({ data })).pipe(
      Effect.tap((saved) => Effect.sync(() => onSaved(saved))),
      Effect.andThen(
        pollStudioRender(() => garmentFn({ data: { id: data.id } })),
      ),
    ),
  );
