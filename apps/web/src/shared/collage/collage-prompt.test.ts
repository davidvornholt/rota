import { expect, it } from 'bun:test';
import { collagePrompt } from './collage-prompt.ts';

it('numbers each garment with its role and asks for nothing else', () => {
  const prompt = collagePrompt([
    { slot: 'bottom', name: 'Sand chinos' },
    { slot: 'top', name: 'Blue Oxford shirt' },
  ]);
  expect(prompt).toContain(
    '(image 1: Sand chinos, the bottom; image 2: Blue Oxford shirt, the top)',
  );
  expect(prompt).not.toContain('upper-body layers');
  expect(prompt).not.toContain('beside the clothes');
  expect(prompt).toEndWith(
    'Add nothing that is not in the input images: no other clothing, shoes, bags, belts, watches, jewellery, sunglasses, plants, props, hands, people, text or watermark.',
  );
});

it('layers the upper body as worn and places shoes and bag beside the clothes', () => {
  const prompt = collagePrompt([
    { slot: 'under', name: 'White tee' },
    { slot: 'over', name: 'Green knit jumper' },
    { slot: 'shoes', name: 'Brown loafers' },
    { slot: 'bag', name: 'Tan tote' },
  ]);
  expect(prompt).toContain(
    'the upper-body layers overlap as worn, from the base layer underneath to the outer layer on top,',
  );
  expect(prompt).toContain('Place the shoes and the bag beside the clothes.');
});

it('places a hat and a scarf as worn around a dress', () => {
  const prompt = collagePrompt([
    { slot: 'dress', name: 'Red summer dress' },
    { slot: 'scarf', name: 'Silk scarf' },
    { slot: 'hat', name: 'Straw hat' },
  ]);
  expect(prompt).toContain(
    '(image 1: Red summer dress, the dress; image 2: Silk scarf, the scarf; image 3: Straw hat, the hat)',
  );
  expect(prompt).not.toContain('upper-body layers');
  expect(prompt).toContain(
    'Drape the scarf across the neckline, as worn. Place the hat above the neckline, where it is worn.',
  );
  expect(prompt).not.toContain('beside the clothes');
});
