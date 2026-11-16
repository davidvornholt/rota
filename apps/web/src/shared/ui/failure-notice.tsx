import { staleEditMessage } from '#/shared/data/errors/stale-edit.ts';
import { linkButtonClass } from './classes.ts';
import { Notice } from './notice.tsx';

/**
 * Why a save did not go through. A save refused because another one came first
 * also gets the way out: reload, to see what is saved now.
 */
export const FailureNotice = ({ message }: { readonly message: string }) => (
  <Notice live={true}>
    {message}
    {message === staleEditMessage ? (
      <button
        className={`${linkButtonClass} ml-3`}
        onClick={() => globalThis.location.reload()}
        type="button"
      >
        Reload
      </button>
    ) : null}
  </Notice>
);
