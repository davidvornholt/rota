import { linkButtonClass, quietButtonClass } from '#/shared/ui/classes.ts';
import type { Person } from '../services/people-fns.ts';

export const PersonAccess = ({
  person,
  pending,
  onRecover,
  onToggle,
  onCancel,
}: {
  readonly person: Person;
  readonly pending: boolean;
  readonly onRecover: () => void;
  readonly onToggle: () => void;
  readonly onCancel: () => void;
}) =>
  person.admin ? null : (
    <details className="min-w-0">
      <summary className="min-h-11 cursor-pointer py-3 text-ink text-sm underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
        Manage access
      </summary>
      <div className="mt-3 flex flex-col items-start gap-3 border-rule border-l pl-4">
        {person.enabled ? (
          <button
            className={quietButtonClass}
            disabled={pending}
            onClick={onRecover}
            type="button"
          >
            {person.registered ? 'Issue recovery code' : 'Replace invitation'}
          </button>
        ) : null}
        <button
          className={person.enabled ? linkButtonClass : quietButtonClass}
          disabled={pending}
          onClick={onToggle}
          type="button"
        >
          {person.enabled ? 'Suspend access' : 'Restore access'}
        </button>
        {person.codeExpiresAt ? (
          <button
            className={linkButtonClass}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Cancel code
          </button>
        ) : null}
      </div>
    </details>
  );
