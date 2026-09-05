import { Effect } from 'effect';

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
export const reprocessGarmentFn = () => Effect.runPromise(Effect.void);
export const retryStudioFn = () => Effect.runPromise(Effect.void);
