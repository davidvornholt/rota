import { useState } from 'react';
import {
  checkClass,
  fieldClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import type { PlanningController } from './use-planning.ts';
export const DayPreferences = ({
  controller,
}: {
  readonly controller: PlanningController;
}) => {
  const { view, busy } = controller;
  const [note, setNote] = useState(view.day.occasion ?? '');
  const tomorrow = view.day.today > view.actualToday;
  return (
    <>
      <label className="inline-flex min-h-11 items-center gap-3 text-sm">
        <input
          className={checkClass}
          type="checkbox"
          checked={view.cleanTop}
          disabled={busy}
          onChange={(event) => {
            controller
              .change({ action: 'clean-top', value: event.target.checked })
              .catch(() => undefined);
          }}
        />
        Clean top {tomorrow ? 'tomorrow' : 'today'}
      </label>
      <details>
        <summary className="cursor-pointer py-2 text-ink-muted text-sm">
          {view.day.occasion ? `Note: ${view.day.occasion}` : 'Add an occasion'}
        </summary>
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            controller
              .change({ action: 'note', text: note })
              .catch(() => undefined);
          }}
        >
          <label className="text-sm">
            Plans for the day
            <textarea
              className={[fieldClass, 'mt-2'].join(' ')}
              maxLength={280}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button className={linkButtonClass} disabled={busy} type="submit">
            Save note
          </button>
        </form>
      </details>
    </>
  );
};
