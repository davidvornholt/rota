import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '#/shared/auth/auth-client.ts';
import { rejectAuthError } from '#/shared/auth/auth-response.ts';
import { frameClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
export const PasskeysPage = () => {
  const queryClient = useQueryClient();
  const keys = useQuery({
    queryKey: ['passkeys'],
    queryFn: async () => {
      const response = await authClient.passkey.listUserPasskeys();
      await rejectAuthError(response);
      return response.data;
    },
  });
  const add = useMutation({
    mutationFn: () =>
      authClient.passkey
        .addPasskey({ name: 'Rota passkey' })
        .then(rejectAuthError),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  });
  return (
    <div className={frameClass}>
      <h1 className="type-display text-5xl">Your passkeys</h1>
      <p className="mt-5 max-w-prose text-ink-muted">
        Add a passkey on another device you own so you can sign in without your
        phone. Your device or password manager decides where to save it.
      </p>
      <button
        className={`${signalButtonClass} mt-8`}
        disabled={add.isPending}
        onClick={() => add.mutate()}
        type="button"
      >
        {add.isPending ? 'Waiting for your device …' : 'Add a passkey'}
      </button>
      {add.isError ? (
        <Notice className="mt-6" live={true}>
          The passkey could not be added. Sign out and sign in again, then retry
          within ten minutes.
        </Notice>
      ) : null}
      {add.isSuccess ? (
        <p className="mt-6" role="status">
          Passkey added.
        </p>
      ) : null}
      {keys.isError ? (
        <Notice className="mt-6">
          Passkeys could not be loaded. Refresh to try again.
        </Notice>
      ) : null}
      <ul className="mt-8 divide-y divide-rule border-rule border-y">
        {keys.data?.map((key) => (
          <li className="py-4" key={key.id}>
            {key.name || 'Passkey'}
            <span className="ml-3 text-ink-muted text-sm">
              {key.backedUp
                ? 'Backed up by your password manager'
                : 'Stored on your authenticator'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-ink-muted text-sm">
        Lost a device or all your passkeys? Ask David to issue a recovery code.
        Recovery replaces your old passkeys.
      </p>
    </div>
  );
};
