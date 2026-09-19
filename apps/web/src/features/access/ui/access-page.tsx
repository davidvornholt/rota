import { useMutation } from '@tanstack/react-query';
import { Link, useHydrated, useRouter } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import {
  fieldClass,
  frameClass,
  linkButtonClass,
  proseClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { Tally } from '#/shared/ui/tally.tsx';

export const SignInPage = ({
  oauthError,
}: {
  readonly oauthError?: string;
}) => {
  const router = useRouter();
  const hydrated = useHydrated();
  const signIn = useMutation({
    mutationFn: async () => {
      await authClient.signIn.passkey().then(rejectAuthError);
    },
    onSuccess: async () => {
      await router.invalidate();
      await router.navigate({ to: '/' });
    },
  });
  const github = useMutation({
    mutationFn: () =>
      authClient.signIn
        .social({
          provider: 'github',
          callbackURL: '/',
          errorCallbackURL: '/login',
        })
        .then(rejectAuthError),
  });
  return (
    <main className="flex min-h-svh flex-col justify-center bg-paper py-16">
      <div className={frameClass}>
        <div className="flex items-end gap-4">
          <h1 className="type-display text-7xl text-ink sm:text-8xl">Rota</h1>
          <span className="mb-3">
            <Tally day={3} of={4} />
          </span>
        </div>
        <p
          className={`${proseClass} mt-6 border-rule border-t pt-6 text-ink-muted text-lg`}
        >
          What to wear today, from a wardrobe that keeps its own rotation.
        </p>
        <button
          className={`${signalButtonClass} mt-10`}
          disabled={!hydrated || signIn.isPending || github.isPending}
          onClick={() => signIn.mutate()}
          type="button"
        >
          {signIn.isPending
            ? 'Waiting for your passkey …'
            : 'Sign in with a passkey'}
        </button>
        {signIn.isError || github.isError || oauthError ? (
          <Notice className="mt-6 max-w-prose" live={true}>
            Sign-in did not complete. Try again, use a passkey from another
            device, or ask David for a recovery code.
          </Notice>
        ) : null}
        <p className="mt-6">
          <Link className={linkButtonClass} to="/join">
            Set up or recover access
          </Link>
        </p>
        <p className="mt-4 max-w-prose text-ink-muted text-sm">
          On another device? Choose “Use another device” in the passkey prompt
          and scan the QR code with your phone.
        </p>
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer">Administrator sign-in</summary>
          <button
            className={linkButtonClass}
            disabled={!hydrated || github.isPending || signIn.isPending}
            onClick={() => github.mutate()}
            type="button"
          >
            Sign in with GitHub
          </button>
        </details>
      </div>
    </main>
  );
};

export const JoinPage = () => {
  const formId = useId();
  const router = useRouter();
  const hydrated = useHydrated();
  const [code, setCode] = useState('');
  const register = useMutation({
    mutationFn: async () => {
      // A pre-existing session must not silently register the code's passkey to another account.
      await authClient.signOut().then(rejectAuthError);
      await authClient.passkey
        .addPasskey({
          context: code.trim(),
          name: 'Rota passkey',
          createSession: true,
        })
        .then(rejectAuthError);
    },
    onSuccess: async () => {
      await router.invalidate();
      await router.navigate({ to: '/' });
    },
  });
  return (
    <main className="flex min-h-svh items-center py-16">
      <div className={frameClass}>
        <div className="max-w-xl">
          <Link className={linkButtonClass} to="/login">
            Back to sign in
          </Link>
          <h1 className="type-display mt-6 text-5xl">
            Your wardrobe starts here
          </h1>
          <p className="mt-5 text-ink-muted">
            Paste the invitation or recovery code David shared with you, then
            save a passkey on your device.
          </p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              register.mutate();
            }}
          >
            <label className="block" htmlFor={`${formId}-access-code`}>
              Invitation or recovery code
              <input
                autoComplete="off"
                className={fieldClass}
                id={`${formId}-access-code`}
                maxLength={100}
                onChange={(event) => setCode(event.target.value)}
                required={true}
                spellCheck={false}
                value={code}
              />
            </label>
            <button
              className={signalButtonClass}
              disabled={!hydrated || register.isPending}
              type="submit"
            >
              {register.isPending
                ? 'Waiting for your device …'
                : 'Save a passkey'}
            </button>
          </form>
          <p className="mt-5 text-ink-muted text-sm">
            Recovering access replaces your previous passkeys and signs out your
            other sessions. Your wardrobe stays intact.
          </p>
          {register.isError ? (
            <Notice className="mt-6" live={true}>
              Setup did not complete. Try again. If your code has expired or was
              already used, ask David for a new one.
            </Notice>
          ) : null}
        </div>
      </div>
    </main>
  );
};
