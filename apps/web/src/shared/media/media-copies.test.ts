import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp from 'sharp';
import { MediaStoreError } from './errors/media-errors.ts';
import { makeMediaCopies } from './media-copies.ts';
import { smallWidth, tileWidth, variantKey } from './media-variants.ts';

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
      keep: (name: string, data: Uint8Array) =>
        Effect.sync(() => {
          kept.push(name);
          objects.set(name, data);
        }),
    },
  };
};

describe('media copies', () => {
  it('makes a copy on first request and serves the kept copy afterwards', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    const [first, second] = await Effect.runPromise(
      Effect.gen(function* () {
        const variant = yield* makeMediaCopies(memory.storage);
        return [
          yield* variant(key, tileWidth),
          yield* variant(key, tileWidth),
        ] as const;
      }),
    );
    expect(first?.mime).toBe('image/webp');
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
    const served = await Effect.runPromise(
      Effect.flatMap(makeMediaCopies(memory.storage), (variant) =>
        variant(key, smallWidth),
      ),
    );
    expect(served).toBeUndefined();
    expect(memory.kept).toEqual([]);
  });

  it('serves the original as it is when it cannot be resized', async () => {
    const unreadable = new TextEncoder().encode('not an image');
    const memory = memoryStorage({ [key]: unreadable });
    const served = await Effect.runPromise(
      Effect.flatMap(makeMediaCopies(memory.storage), (variant) =>
        variant(key, smallWidth),
      ),
    );
    expect(served).toEqual({ bytes: unreadable, mime: 'image/png' });
    expect(memory.kept).toEqual([]);
  });

  it('still serves a copy it could not keep', async () => {
    const memory = memoryStorage({ [key]: await photo() });
    const served = await Effect.runPromise(
      Effect.flatMap(
        makeMediaCopies({
          get: memory.storage.get,
          keep: () =>
            Effect.fail(
              new MediaStoreError({ message: 'Bucket down.', cause: null }),
            ),
        }),
        (variant) => variant(key, smallWidth),
      ),
    );
    expect(served?.mime).toBe('image/webp');
  });

  it('resizes at most two originals at once', async () => {
    const source = await photo();
    let active = 0;
    let busiest = 0;
    const slowStorage = {
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
      keep: () => Effect.void,
    };
    const served = await Effect.runPromise(
      Effect.flatMap(makeMediaCopies(slowStorage), (variant) =>
        Effect.all(
          Array.from({ length: simultaneousRequests }, () =>
            variant(key, smallWidth),
          ),
          { concurrency: 'unbounded' },
        ),
      ),
    );
    expect(served).toHaveLength(simultaneousRequests);
    expect(busiest).toBe(allowedResizes);
  });
});
