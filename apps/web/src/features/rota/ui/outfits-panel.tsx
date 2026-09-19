import { useState } from 'react';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import type { SavedOutfit } from '#/shared/data/outfit.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import {
  fieldClass,
  linkButtonClass,
  quietButtonClass,
  signalButtonClass,
} from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import { GarmentFigure } from '#/shared/ui/garment-figure.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import { OutfitEditor } from './outfit-editor.tsx';
import type { PlanningController } from './use-planning.ts';

const Preview = ({
  outfit,
  wardrobe,
}: {
  readonly outfit: SavedOutfit;
  readonly wardrobe: ReadonlyArray<GarmentView>;
}) => (
  <div className="grid grid-cols-2 gap-2">
    {outfit.entries
      .filter((entry) => entry.slot === 'top' || entry.slot === 'bottom')
      .map((entry) => {
        const garment = wardrobe.find((item) => item.id === entry.garmentId);
        return (
          <GarmentFigure
            alt=""
            colors={garment?.colors ?? []}
            image={garment?.image}
            key={entry.slot}
            name={garment?.name ?? 'Unavailable piece'}
          />
        );
      })}
  </div>
);

const SavedOutfitCard = ({
  outfit,
  controller,
  deleting,
  setDeleting,
  setEditing,
  onClose,
  act,
}: {
  readonly outfit: SavedOutfit;
  readonly controller: PlanningController;
  readonly deleting: string | null;
  readonly setDeleting: (id: string | null) => void;
  readonly setEditing: (outfit: SavedOutfit) => void;
  readonly onClose: () => void;
  readonly act: (work: Promise<unknown>, done: () => void) => Promise<void>;
}) => {
  const { view, busy } = controller;
  return (
    <li key={outfit.id}>
      <Preview outfit={outfit} wardrobe={view.wardrobe} />
      <h3 className="type-display mt-2 text-2xl">{outfit.name}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <button
          className={signalButtonClass}
          disabled={busy}
          onClick={() => {
            controller.chooseOutfit(outfit);
            onClose();
          }}
          type="button"
        >
          {view.day.today > view.actualToday || view.day.worn !== null
            ? 'Choose for tomorrow'
            : 'Choose for today'}
        </button>
        <button
          className={linkButtonClass}
          disabled={busy}
          onClick={() => setEditing(outfit)}
          type="button"
          aria-label={`Edit ${outfit.name}`}
        >
          Edit
        </button>
        <button
          className={linkButtonClass}
          disabled={busy}
          onClick={() => setDeleting(outfit.id)}
          type="button"
          aria-label={`Delete ${outfit.name}`}
        >
          Delete
        </button>
      </div>
      {deleting === outfit.id ? (
        <div className="mt-2 flex items-center gap-4">
          <span className="text-sm">Delete this saved outfit?</span>
          <button
            className={linkButtonClass}
            disabled={busy}
            type="button"
            onClick={() => {
              act(
                controller.change({
                  action: 'delete-outfit',
                  id: outfit.id,
                }),
                () => setDeleting(null),
              ).catch(() => undefined);
            }}
          >
            Delete outfit
          </button>
          <button
            className={linkButtonClass}
            type="button"
            onClick={() => setDeleting(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </li>
  );
};

export const OutfitsPanel = ({
  controller,
  saveCurrent,
  onClose,
}: {
  readonly controller: PlanningController;
  readonly saveCurrent: boolean;
  readonly onClose: () => void;
}) => {
  const { view, busy } = controller;
  const [editing, setEditing] = useState<SavedOutfit | null>(() =>
    saveCurrent
      ? { id: crypto.randomUUID(), name: '', entries: controller.entries }
      : null,
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const act = async (work: Promise<unknown>, done: () => void) => {
    setError('');
    try {
      await work;
      done();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save. Try again.',
      );
    }
  };
  const entries = (next: ReadonlyArray<OutfitEntry>) =>
    setEditing((current) =>
      current === null ? null : { ...current, entries: next },
    );
  return (
    <Dialog
      open={true}
      title={editing === null ? 'Saved outfits' : 'Save an outfit'}
      onClose={busy ? () => undefined : onClose}
      size="wide"
    >
      {error === '' ? null : <Notice live={true}>{error}</Notice>}
      {editing === null ? (
        <>
          <button
            className={quietButtonClass}
            type="button"
            onClick={() =>
              setEditing({ id: crypto.randomUUID(), name: '', entries: [] })
            }
          >
            Create outfit
          </button>
          {view.outfits.length === 0 ? (
            <p className="mt-5 text-ink-muted">
              Save combinations you like, then wear them any day.
            </p>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2">
              {view.outfits.map((outfit) => (
                <SavedOutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  controller={controller}
                  deleting={deleting}
                  setDeleting={setDeleting}
                  setEditing={setEditing}
                  onClose={onClose}
                  act={act}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            act(
              controller.change({ action: 'save-outfit', ...editing }),
              () => {
                setEditing(null);
                if (saveCurrent) {
                  onClose();
                }
              },
            ).catch(() => undefined);
          }}
        >
          <label className="block text-sm">
            Outfit name
            <input
              className={[fieldClass, 'mt-2 mb-6'].join(' ')}
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
              maxLength={80}
              required={true}
            />
          </label>
          <OutfitEditor
            entries={editing.entries}
            wardrobe={view.wardrobe}
            onChange={entries}
            pinned={[]}
            onPin={null}
            disabled={busy}
          />
          <div className="mt-6 flex gap-4">
            <button className={signalButtonClass} disabled={busy} type="submit">
              {busy ? 'Saving …' : 'Save outfit'}
            </button>
            <button
              className={linkButtonClass}
              disabled={busy}
              onClick={() => setEditing(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
