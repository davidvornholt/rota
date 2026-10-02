import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp from 'sharp';
import { MediaStoreError } from './errors/media-errors.ts';
import { makeMediaCopies } from './media-copies.ts';
import {
  largeWidth,
  smallWidth,
  tileWidth,
  variantKey,
  variantWidths,
} from './media-variants.ts';

const hashLength = 64;
const key = `${'b'.repeat(hashLength)}.png`;
const renderWidth = 1200;
const renderHeight = 1600;
const rgb = 3;
const simultaneousRequests = 5;
const allowedResizes = 2;

const photo = async () =>
  new Uint8Array(
    await sharp({
      create: {
        width: renderWidth,
        height: renderHeight,
        channels: rgb,
        background: { r: 36, g: 54, b: 75 },
      },
    })
      .png()
      .toBuffer(),
  );

const memoryStorage = (initial: Record<string, Uint8Array>) => {
  const objects = new Map(Object.entries(initial));
  const reads: Array<string> = [];
  const kept: Array<string> = [];
  return {
    objects,
    reads,
    kept,
    storage: {
      get: (name: string) =>
        Effect.sync(() => {
          reads.push(name);
          return objects.get(name);
        }),
      has: (name: string) => Effect.sync(() => objects.has(name)),
      keep: (name: string, data: Uint8Array) =>
        Effect.sync(() => {
          kept.push(name);
          objects.set(name, data);
        }),
    },
  };
};

const copies = (storage: Parameters<typeof makeMediaCopies>[0]) =>
  Effect.runPromise(makeMediaCopies(storage));

describe('media copies', () => {
  it('makes a copy on first request and serves the kept copy afterwards', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    const { variant } = await copies(memory.storage);
    const first = await Effect.runPromise(variant(key, tileWidth));
    const second = await Effect.runPromise(variant(key, tileWidth));
    expect(first).toMatchObject({ mime: 'image/webp', lasting: true });
    expect(await sharp(first?.bytes).metadata()).toMatchObject({
      format: 'webp',
      width: tileWidth,
    });
    expect(second).toEqual(first);
    expect(memory.kept).toEqual([variantKey(key, tileWidth)]);
    expect(memory.reads).toEqual([
      variantKey(key, tileWidth),
      key,
      variantKey(key, tileWidth),
    ]);
  });

  it('answers nothing when the original is missing', async () => {
    const memory = memoryStorage({});
    const { variant } = await copies(memory.storage);
    expect(await Effect.runPromise(variant(key, smallWidth))).toBeUndefined();
    expect(memory.kept).toEqual([]);
  });

  it('serves the original as it is, uncacheable, when it cannot be resized', async () => {
    const unreadable = new TextEncoder().encode('not an image');
    const memory = memoryStorage({ [key]: unreadable });
    const { variant } = await copies(memory.storage);
    expect(await Effect.runPromise(variant(key, smallWidth))).toEqual({
      bytes: unreadable,
      mime: 'image/png',
      lasting: false,
    });
    expect(memory.kept).toEqual([]);
  });

  it('still serves a copy it could not keep', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    const { variant } = await copies({
      ...memory.storage,
      keep: () =>
        Effect.fail(
          new MediaStoreError({ message: 'Bucket down.', cause: null }),
        ),
    });
    expect(await Effect.runPromise(variant(key, smallWidth))).toMatchObject({
      mime: 'image/webp',
      lasting: true,
    });
  });

  it('resizes at most two originals at once', async () => {
    const source = await photo();
    let active = 0;
    let busiest = 0;
    const { variant } = await copies({
      get: (name: string) =>
        name.endsWith('.webp')
          ? Effect.succeed(undefined)
          : Effect.gen(function* () {
              active += 1;
              busiest = Math.max(busiest, active);
              yield* Effect.sleep('5 millis');
              active -= 1;
              return source;
            }),
      has: () => Effect.succeed(false),
      keep: () => Effect.void,
    });
    const served = await Effect.runPromise(
      Effect.all(
        Array.from({ length: simultaneousRequests }, () =>
          variant(key, smallWidth),
        ),
        { concurrency: 'unbounded' },
      ),
    );
    expect(served).toHaveLength(simultaneousRequests);
    expect(busiest).toBe(allowedResizes);
  });
});

describe('warming media copies', () => {
  it('warms every missing copy from one read of the original', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    memory.objects.set(variantKey(key, tileWidth), new Uint8Array([1]));
    const { warm } = await copies(memory.storage);
    await Effect.runPromise(warm(key));
    expect(memory.reads).toEqual([key]);
    expect(memory.kept).toEqual([
      variantKey(key, smallWidth),
      variantKey(key, largeWidth),
    ]);
    const large = memory.objects.get(variantKey(key, largeWidth));
    expect(await sharp(large).metadata()).toMatchObject({
      format: 'webp',
      width: renderWidth,
    });
  });

  it('does not read an original whose copies all exist', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    for (const width of variantWidths) {
      memory.objects.set(variantKey(key, width), new Uint8Array([1]));
    }
    const { warm } = await copies(memory.storage);
    await Effect.runPromise(warm(key));
    expect(memory.reads).toEqual([]);
    expect(memory.kept).toEqual([]);
  });

  it('leaves an unreadable original without copies', async () => {
    const memory = memoryStorage({
      [key]: new TextEncoder().encode('not an image'),
    });
    const { warm } = await copies(memory.storage);
    await Effect.runPromise(warm(key));
    expect(memory.kept).toEqual([]);
  });
});
