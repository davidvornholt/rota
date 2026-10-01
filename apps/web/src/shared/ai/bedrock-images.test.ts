import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp from 'sharp';
import { prepareBedrockParts } from './bedrock-images.ts';
import type { PromptPart } from './bedrock-request.ts';

it('keeps normal image requests unchanged and resizes large wardrobes without losing image order', async () => {
  const data = await sharp({
    create: { width: 2048, height: 1024, channels: 3, background: '#0000ff' },
  })
    .jpeg()
    .toBuffer();
  const part = { image: { mimeType: 'image/jpeg', data } };
  const single = [{ text: 'B1' }, part];
  expect(await Effect.runPromise(prepareBedrockParts(single))).toBe(single);
  const parts: Array<PromptPart> = [
    { text: 'B1' },
    ...Array.from({ length: 21 }, () => part),
  ];
  const prepared = await Effect.runPromise(prepareBedrockParts(parts));
  expect(prepared).toHaveLength(parts.length);
  expect(prepared[0]).toEqual({ text: 'B1' });
  const [, first] = prepared;
  if (first === undefined || !('image' in first)) {
    throw new Error('Image missing');
  }
  expect(first.image.mimeType).toBe('image/jpeg');
  expect(await sharp(first.image.data).metadata()).toMatchObject({
    width: 2000,
    height: 1000,
  });
});
