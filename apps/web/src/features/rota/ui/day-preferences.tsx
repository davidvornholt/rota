import { useState } from 'react';
import {
  checkClass,
  fieldClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import { useCleanTop } from './use-clean-top.ts';
import type { PlanningController } from './use-planning.ts';
export const DayPreferences = ({
  controller,
}: {
  readonly controller: PlanningController;
}) => {
  const { view, busy } = controller;
  const [note, setNote] = useState(view.day.occasion ?? '');
  const cleanTop = useCleanTop(controller);
  const tomorrow = view.day.today > view.actualToday;
  return (
    <>
      <label className="inline-flex min-h-11 items-center gap-3 text-sm">
        <input
          className={checkClass}
          type="checkbox"
          checked={cleanTop.value}
          disabled={busy && !cleanTop.saving}
          onChange={(event) => {
            cleanTop.set(event.target.checked);
          }}
        />
        Freshly washed top {tomorrow ? 'tomorrow' : 'today'}
      </label>

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          controller
            .change({ action: 'note', text: note })
            .catch(() => undefined);
        }}
      >
        <label className="text-sm">
          Plans for the day (optional)
          <textarea
            className={[fieldClass, 'mt-2'].join(' ')}
            rows={3}
            placeholder="Office, dinner out, or a quiet day at home…"
            maxLength={280}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {note === (view.day.occasion ?? '') ? null : (
          <button className={linkButtonClass} disabled={busy} type="submit">
            Save note
          </button>
        )}
      </form>
    </>
  );
};
