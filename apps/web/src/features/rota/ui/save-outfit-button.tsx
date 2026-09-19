import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { fieldClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { changePlanningFn } from '../services/planning-fns.ts';
import { completeOutfit } from './draft-status.ts';

export const SaveOutfitButton = ({
  entries,
  today,
}: {
  readonly entries: ReadonlyArray<OutfitEntry>;
  readonly today: LocalDate;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const save = useMutation({
    mutationFn: () =>
      changePlanningFn({
        data: {
          date: today,
          change: {
            action: 'save-outfit',
            id,
            name,
            entries,
          },
        },
        fetch: serverFunctionFetch,
      }),
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <IconButton
        icon="bookmark"
        label="Save as a reusable outfit"
        tooltip={
          completeOutfit(entries)
            ? 'Save as a reusable outfit'
            : 'Choose a top and bottom to save an outfit'
        }
        disabled={!completeOutfit(entries)}
        onClick={() => {
          save.reset();
          setId(crypto.randomUUID());
          setOpen(true);
        }}
      />
      {save.isSuccess ? (
        <span className="text-ink-muted text-sm" role="status">
          Saved to your outfits.
        </span>
      ) : null}
      {open ? (
        <Dialog
          open={true}
          title="Save an outfit"
          onClose={() => setOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label className="block text-sm">
              Outfit name
              <input
                className={[fieldClass, 'mt-2'].join(' ')}
                maxLength={80}
                required={true}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {save.isError ? (
              <Notice className="mt-4" live={true}>
                {save.error.message}
              </Notice>
            ) : null}
            <button
              className={[signalButtonClass, 'mt-5'].join(' ')}
              disabled={save.isPending}
              type="submit"
            >
              {save.isPending ? 'Saving …' : 'Save outfit'}
            </button>
          </form>
        </Dialog>
      ) : null}
    </>
  );
};
