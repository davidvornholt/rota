import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { GarmentEdit } from '#/features/garments/schemas/garment-input.ts';
import { GarmentForm } from '#/features/garments/ui/garment-form.tsx';

const sample: GarmentEdit = {
  name: 'Blue Oxford shirt',
  category: 'shirt',
  subcategory: 'Oxford shirt',
  slots: ['top'],
  warmth: 2,
  rainOk: true,
  formality: 2,
  wearBudget: null,
  colors: [{ hex: '#336699' }],
  pattern: '',
  material: 'Cotton',
  fit: '',
  sleeve: '',
  brand: '',
  seasons: ['spring', 'autumn'],
  notes: '',
  price: null,
  purchasedOn: null,
};

export const GarmentFormFixture = () => {
  const [value, setValue] = useState(sample);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl">Review garment</h1>
      <GarmentForm
        categoryBudget={2}
        compact={new URLSearchParams(location.search).has('compact')}
        onChange={setValue}
        value={value}
      />
    </main>
  );
};

const root = document.querySelector('#root');
if (root !== null) {
  createRoot(root).render(<GarmentFormFixture />);
}
