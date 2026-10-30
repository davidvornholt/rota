import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import {
  fieldClass,
  frameClass,
  labelClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';

type Decision = 'approve' | 'deny';

const CodeForm = ({ onCode }: { readonly onCode: (code: string) => void }) => {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  return (
    <form
      className="mt-8 max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onCode(typed.trim().toUpperCase());
      }}
    >
      <label className={labelClass} htmlFor={inputId}>
        Code from the terminal
      </label>
      <input
        autoComplete="off"
        className={`${fieldClass} mt-2 font-mono uppercase tracking-widest`}
        id={inputId}
        onChange={(event) => setTyped(event.target.value)}
        value={typed}
      />
      <button
        className={`${signalButtonClass} mt-4`}
        disabled={typed.trim() === ''}
        type="submit"
      >
        Continue
      </button>
    </form>
  );
};

/**
 * Approves a `rota login` from a terminal. Opening the page claims the code
 * for the signed-in member, and approving it gives the CLI a session of its
 * own, which signing out of the CLI ends.
 */
export const DevicePage = ({ userCode }: { readonly userCode: string }) => {
  const [code, setCode] = useState(userCode);
  const request = useQuery({
    queryKey: ['device-code', code],
    enabled: code !== '',
    // Each check claims the code and counts against a small rate limit.
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await authClient.device({
        // biome-ignore lint/style/useNamingConvention: Better Auth's device endpoint takes the RFC 8628 parameter name.
        query: { user_code: code },
      });
      await rejectAuthError(response);
      return response.data;
    },
  });
  const decide = useMutation({
    mutationFn: (decision: Decision) =>
      (decision === 'approve'
        ? authClient.device.approve({ userCode: code })
        : authClient.device.deny({ userCode: code })
      ).then(rejectAuthError),
  });
  const decided = decide.variables === 'approve' ? 'approved' : 'denied';
  const status = decide.isSuccess ? decided : request.data?.status;
  return (
    <div className={frameClass}>
      <h1 className="type-display text-5xl">Sign in the CLI</h1>
      <p className="mt-5 max-w-prose text-ink-muted">
        The <code>rota</code> command line lets an agent on your computer read
        your wardrobe and plan outfits as you. Approve only a sign-in you just
        started with <code>rota login</code>, and check that the code matches
        the one in your terminal.
      </p>
      {code === '' ? <CodeForm onCode={setCode} /> : null}
      {request.isPending && code !== '' ? (
        <p className="mt-8" role="status">
          Checking the code …
        </p>
      ) : null}
      {request.isError ? (
        <Notice className="mt-8">
          This code is unknown or has expired. Run <code>rota login</code> again
          and open the new link.
        </Notice>
      ) : null}
      {status === 'pending' ? (
        <div className="mt-8">
          <p className="type-eyebrow">Code</p>
          <p className="mt-2 font-mono text-3xl tracking-widest">{code}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className={signalButtonClass}
              disabled={decide.isPending}
              onClick={() => decide.mutate('approve')}
              type="button"
            >
              Approve
            </button>
            <button
              className={quietButtonClass}
              disabled={decide.isPending}
              onClick={() => decide.mutate('deny')}
              type="button"
            >
              Deny
            </button>
          </div>
          {decide.isError ? (
            <Notice className="mt-6" live={true}>
              The sign-in could not be confirmed. Run <code>rota login</code>{' '}
              again and open the new link.
            </Notice>
          ) : null}
        </div>
      ) : null}
      {status === 'approved' ? (
        <p className="mt-8" role="status">
          The CLI is signed in. You can close this tab and go back to the
          terminal.
        </p>
      ) : null}
      {status === 'denied' ? (
        <p className="mt-8" role="status">
          You denied this sign-in, so the CLI stays signed out.
        </p>
      ) : null}
    </div>
  );
};
