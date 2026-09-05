import { Effect } from 'effect';
import type { GarmentEdit } from '#/features/garments/schemas/garment-input.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';

let current: GarmentView;
export const setFixtureGarment = (value: GarmentView) => {
  current = value;
};
export const fixtureGarment = () => current;

export const acceptGarmentFn = ({ data }: { readonly data: unknown }) =>
  Effect.runPromise(
    Effect.sync(() => {
      const accepted = document.querySelector('output');
      if (accepted !== null) {
        accepted.textContent = JSON.stringify(data);
      }
    }),
  );
export const deleteGarmentFn = () => Effect.runPromise(Effect.void);
export const garmentFn = () => Effect.runPromise(Effect.sync(() => current));
export const retryStudioFn = ({
  data,
}: {
  readonly data: { readonly edit: GarmentEdit; readonly instructions: string };
}) =>
  Effect.runPromise(
    Effect.sync(() => {
      const output = document.querySelector('[aria-label="Render request"]');
      if (output !== null) {
        output.textContent = JSON.stringify(data);
      }
      const renderId = crypto.randomUUID();
      current = {
        ...current,
        ...data.edit,
        processingError: null,
        studioRenderId: renderId,
        studioRenderCompletedId: null,
      };
      return current;
    }),
  );
export const updateGarmentFn = () => garmentFn();
export const setImageChoiceFn = () => garmentFn();
export const retireGarmentFn = () => garmentFn();
export const restoreGarmentFn = () => garmentFn();
