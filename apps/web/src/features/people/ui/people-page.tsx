import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import {
  fieldClass,
  frameClass,
  linkButtonClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import {
  accessFn,
  cancelCodeFn,
  inviteFn,
  type Person,
  peopleFn,
  recoverFn,
} from '../services/people-fns.ts';
import { UsagePanel } from './usage-panel.tsx';

export const PeoplePage = () => {
  const formId = useId();
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['people'], queryFn: () => peopleFn() });
  const [name, setName] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const action = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => {
      await operation();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
  return (
    <div className={frameClass}>
      <p className="type-eyebrow">Administration</p>
      <h1 className="type-display mt-3 text-5xl">People</h1>
      <p className="mt-4 text-ink-muted">
        Manage access, look through wardrobes, and follow API usage.
      </p>
      <form
        className="mt-8 flex max-w-lg flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          action.mutate(async () => {
            const result = await inviteFn({ data: { name } });
            setIssuedCode(result.code);
            setName('');
          });
        }}
      >
        <label className="flex-1" htmlFor={`${formId}-invite-name`}>
          Name
          <input
            className={fieldClass}
            id={`${formId}-invite-name`}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required={true}
            value={name}
          />
        </label>
        <button
          className={signalButtonClass}
          disabled={action.isPending}
          type="submit"
        >
          Create invitation
        </button>
      </form>
      {issuedCode ? (
        <section
          aria-label="Access code"
          className="mt-6 border border-rule-strong p-5"
        >
          <h2 className="text-lg">Share this code directly</h2>
          <p className="mt-2 text-sm">
            Ask them to open Rota, choose “Set up or recover access”, and paste
            this code. It expires in 24 hours and works once. Recovery replaces
            all their existing passkeys and signs out their other sessions.
          </p>
          <label className="mt-4 block" htmlFor={`${formId}-issued-code`}>
            Access code
            <input
              className={fieldClass}
              id={`${formId}-issued-code`}
              readOnly={true}
              value={issuedCode}
            />
          </label>
          <button
            className={linkButtonClass}
            onClick={() => setIssuedCode(null)}
            type="button"
          >
            Hide code
          </button>
        </section>
      ) : null}
      {action.isError ? (
        <Notice className="mt-4" live={true}>
          {action.error.message}
        </Notice>
      ) : null}
      {people.isError ? (
        <Notice className="mt-4">
          People could not be loaded. Refresh to try again.
        </Notice>
      ) : null}
      <ul className="mt-8 divide-y divide-rule border-rule border-y">
        {people.data?.map((person) => (
          <li
            className="flex flex-wrap items-center justify-between gap-4 py-5"
            key={person.id}
          >
            <div>
              <h2 className="text-xl">{person.name}</h2>
              <p className="mt-1 text-ink-muted text-sm">
                {personStatus(person)}· Last active:{' '}
                {person.lastActiveAt
                  ? new Date(person.lastActiveAt).toLocaleDateString()
                  : 'Not yet'}
              </p>
              {person.codeExpiresAt ? (
                <p className="text-ink-muted text-sm">
                  Code expires{' '}
                  {new Date(person.codeExpiresAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className={linkButtonClass}
                params={{ memberId: person.id }}
                to="/people/$memberId"
              >
                View wardrobe
              </Link>
              {person.admin ? null : (
                <>
                  <button
                    className={quietButtonClass}
                    disabled={action.isPending || !person.enabled}
                    onClick={() =>
                      action.mutate(async () => {
                        const result = await recoverFn({
                          data: { memberId: person.id },
                        });
                        setIssuedCode(result.code);
                      })
                    }
                    type="button"
                  >
                    Issue recovery code
                  </button>
                  <button
                    className={quietButtonClass}
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(() =>
                        accessFn({
                          data: { id: person.id, enabled: !person.enabled },
                        }),
                      )
                    }
                    type="button"
                  >
                    {person.enabled ? 'Suspend access' : 'Restore access'}
                  </button>
                </>
              )}
              {person.codeExpiresAt ? (
                <button
                  className={linkButtonClass}
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(async () => {
                      await cancelCodeFn({ data: { id: person.id } });
                      setIssuedCode(null);
                    })
                  }
                  type="button"
                >
                  Cancel code
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <UsagePanel />
    </div>
  );
};

const personStatus = (person: Person) => {
  if (person.admin) {
    return 'Administrator';
  }
  if (!person.enabled) {
    return 'Suspended';
  }
  return person.registered ? 'Active' : 'Awaiting setup';
};
