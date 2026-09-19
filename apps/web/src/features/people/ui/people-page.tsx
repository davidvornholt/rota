import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import {
  fieldClass,
  frameClass,
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
import { AccessCode, type IssuedCode } from './access-code.tsx';
import { PersonAccess } from './person-access.tsx';
import { UsagePanel } from './usage-panel.tsx';

export const PeoplePage = () => {
  const formId = useId();
  const queryClient = useQueryClient();
  const people = useQuery({ queryKey: ['people'], queryFn: () => peopleFn() });
  const [name, setName] = useState('');
  const [issuedCode, setIssuedCode] = useState<IssuedCode | null>(null);
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
            setIssuedCode({
              code: result.code,
              name: name.trim(),
              recovery: false,
            });
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
          className={issuedCode ? quietButtonClass : signalButtonClass}
          disabled={action.isPending}
          type="submit"
        >
          Create invitation
        </button>
      </form>
      {issuedCode ? (
        <AccessCode
          value={issuedCode}
          key={issuedCode.code}
          onHide={() => setIssuedCode(null)}
        />
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
                {personStatus(person)} · Last active:{' '}
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
            <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
              <Link
                className={quietButtonClass}
                params={{ memberId: person.id }}
                to="/people/$memberId"
              >
                View wardrobe
              </Link>
              <PersonAccess
                person={person}
                pending={action.isPending}
                onRecover={() =>
                  action.mutate(async () => {
                    const result = await recoverFn({
                      data: { memberId: person.id },
                    });
                    setIssuedCode({
                      code: result.code,
                      name: person.name,
                      recovery: person.registered,
                    });
                  })
                }
                onToggle={() =>
                  action.mutate(() =>
                    accessFn({
                      data: { id: person.id, enabled: !person.enabled },
                    }),
                  )
                }
                onCancel={() =>
                  action.mutate(async () => {
                    await cancelCodeFn({ data: { id: person.id } });
                    setIssuedCode(null);
                  })
                }
              />
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
