import { staleEditMessage } from '#/shared/data/errors/stale-edit.ts';
import { linkButtonClass } from './classes.ts';
import { Notice } from './notice.tsx';

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
