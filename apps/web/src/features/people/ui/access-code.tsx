import { useId, useState } from 'react';
import {
  fieldClass,
  linkButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';

export const AccessCode = ({
  code,
  onHide,
}: {
  readonly code: string;
  readonly onHide: () => void;
}) => {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return (
    <section
      aria-label="Access code"
      className="mt-6 border border-rule-strong p-5"
    >
      <h2 className="text-lg">Share this code directly</h2>
      <p className="mt-2 text-sm">
        Ask them to open Rota, choose “Set up or recover access”, and paste this
        code. It expires in 24 hours and works once. Recovery replaces all their
        existing passkeys and signs out their other sessions.
      </p>
      <label className="mt-4 block" htmlFor={id}>
        Access code
        <input className={fieldClass} id={id} readOnly={true} value={code} />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <button
          className={signalButtonClass}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setCopyFailed(false);
            } catch {
              setCopied(false);
              setCopyFailed(true);
            }
          }}
          type="button"
        >
          Copy code
        </button>
        <button className={linkButtonClass} onClick={onHide} type="button">
          Hide code
        </button>
      </div>
      {copied ? (
        <p className="mt-3 text-sm" role="status">
          Code copied.
        </p>
      ) : null}
      {copyFailed ? (
        <Notice className="mt-3" live={true}>
          Select the code above and copy it manually.
        </Notice>
      ) : null}
    </section>
  );
};
