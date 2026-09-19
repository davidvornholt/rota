import { useEffect, useId, useRef, useState } from 'react';
import { fieldClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';

export type IssuedCode = {
  readonly code: string;
  readonly name: string;
  readonly recovery: boolean;
};

export const AccessCode = ({
  value,
  onHide,
}: {
  readonly value: IssuedCode;
  readonly onHide: () => void;
}) => {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return (
    <section
      aria-label="Access code"
      className="mt-6 border border-rule-strong p-5"
    >
      <h2 className="text-lg" ref={headingRef} tabIndex={-1}>
        {value.recovery ? 'Recovery code' : 'Invitation'} for {value.name}
      </h2>
      <p className="mt-2 text-sm">
        Share this code directly. Ask them to open Rota, choose “Set up or
        recover access”, and paste this code. It expires in 24 hours and works
        once. Recovery replaces all their existing passkeys and signs out their
        other sessions.
      </p>
      <label className="mt-4 block" htmlFor={id}>
        Access code
        <input
          className={fieldClass}
          id={id}
          readOnly={true}
          value={value.code}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className={signalButtonClass}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value.code);
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
        <IconButton icon="close" label="Hide code" onClick={onHide} />
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
