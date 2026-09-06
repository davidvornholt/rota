import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OccasionNote } from '#/features/rota/ui/occasion-note.tsx';
import { ConfirmButton } from '#/shared/ui/confirm-button.tsx';

export const IconActionsFixture = () => {
  const [occasion, setOccasion] = useState('Dinner with friends');
  const [deleted, setDeleted] = useState(false);
  return (
    <main className="mx-auto grid max-w-3xl gap-8 p-6">
      <h1 className="text-2xl">Today</h1>
      <OccasionNote
        occasion={occasion}
        onSave={setOccasion}
        pending={false}
        remakes={false}
      />
      <section aria-label="Garment actions" className="flex items-center gap-3">
        <p>{deleted ? 'Garment deleted' : 'Blue Oxford shirt'}</p>
        {deleted ? null : (
          <ConfirmButton
            label="Delete garment"
            confirmLabel="Delete for good"
            onConfirm={() => setDeleted(true)}
          />
        )}
      </section>
    </main>
  );
};

const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(<IconActionsFixture />);
}
