import { Effect } from 'effect';
import type { GarmentEdit } from '../schemas/garment-input.ts';
import { garmentFn, retryStudioFn } from './garments-fns.ts';
import { pollStudioRender, studioRequest } from './studio-poll.ts';

// Keep the render in the server's background runtime so individual requests
// finish within the HTTP idle timeout.
export const requestStudioRender = (data: {
  readonly id: string;
  readonly edit: GarmentEdit;
  readonly instructions: string;
}) =>
  Effect.runPromise(
    studioRequest(() => retryStudioFn({ data })).pipe(
      Effect.andThen(
        pollStudioRender(() => garmentFn({ data: { id: data.id } })),
      ),
    ),
  );
