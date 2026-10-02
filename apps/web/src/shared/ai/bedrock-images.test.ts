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

const randomImageBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  const maximumRandomChunk = 65_536;
  for (let start = 0; start < length; start += maximumRandomChunk) {
    crypto.getRandomValues(bytes.subarray(start, start + maximumRandomChunk));
  }
  return bytes;
};

const productionWardrobeImages = 37;
it.each([10, productionWardrobeImages])(
  'fits %i large PNG photos into the request budget without dropping candidates',
  async (imageCount) => {
    const width = 1024;
    const channels = 3;
    const data = await sharp(randomImageBytes(width * width * channels), {
      raw: { width, height: width, channels },
    })
      .png()
      .toBuffer();
    const parts: Array<PromptPart> = Array.from(
      { length: imageCount },
      (_, index) => [
        { text: `candidate-${index}` },
        { image: { mimeType: 'image/png', data } },
      ],
    ).flat();
    const prepared = await Effect.runPromise(prepareBedrockParts(parts));
    expect(prepared).toHaveLength(parts.length);
    expect(prepared.filter((part) => 'text' in part)).toEqual(
      parts.filter((part) => 'text' in part),
    );
    const images = prepared.flatMap((part) =>
      'image' in part ? [part.image] : [],
    );
    expect(images).toHaveLength(imageCount);
    expect(images.every((image) => image.mimeType === 'image/jpeg')).toBe(true);
    const metadata = await Promise.all(
      images.map((image) => sharp(image.data).metadata()),
    );
    expect(metadata.every((image) => (image.width ?? 0) <= width)).toBe(true);
    const imageBytes = images.reduce(
      (total, image) => total + image.data.byteLength,
      0,
    );
    const requestBudgetBytes = 12_582_912;
    expect(imageBytes).toBeLessThanOrEqual(requestBudgetBytes);
  },
);
