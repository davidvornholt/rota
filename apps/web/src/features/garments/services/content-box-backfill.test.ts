import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import sharp from 'sharp';
import type { ContentBox } from '#/shared/media/content-box.ts';
import { MediaStoreError } from '#/shared/media/errors/media-errors.ts';
import { makeContentBoxBackfill } from './content-box-backfill.ts';

const batchSize = 20;
const unmeasuredRenders = 25;

const render = async () =>
  new Uint8Array(
    await sharp({
      create: {
        width: 120,
        height: 160,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: {
            create: {
              width: 60,
              height: 100,
              channels: 4,
              background: { r: 36, g: 54, b: 75, alpha: 1 },
            },
          },
          left: 30,
          top: 20,
        },
      ])
      .png()
      .toBuffer(),
  );

describe('studio render measurement backfill', () => {
  it('measures unmeasured renders in bounded batches and stores each box', async () => {
    const bytes = await render();
    const unmeasured = new Set(
      Array.from({ length: unmeasuredRenders }, (_, index) => `key-${index}`),
    );
    const stored = new Map<string, ContentBox>();
    const backfill = makeContentBoxBackfill({
      unmeasuredKeys: Effect.sync(() => [...unmeasured]),
      read: () => Effect.succeed(bytes),
      store: (key, box) =>
        Effect.sync(() => {
          stored.set(key, box);
          unmeasured.delete(key);
        }),
    });
    const batches = [
      await Effect.runPromise(backfill),
      await Effect.runPromise(backfill),
      await Effect.runPromise(backfill),
    ];
    expect(batches).toEqual([batchSize, unmeasuredRenders - batchSize, 0]);
    expect(stored.size).toBe(unmeasuredRenders);
    expect(stored.get('key-0')).toEqual({
      left: 30,
      top: 20,
      width: 60,
      height: 100,
    });
  });

  it('skips a render that cannot be measured or is missing, but retries a store failure', async () => {
    let storeDown = true;
    const stored: Array<string> = [];
    const bytes = await render();
    const backfill = makeContentBoxBackfill({
      unmeasuredKeys: Effect.sync(() =>
        ['broken', 'missing', 'flaky'].filter((key) => !stored.includes(key)),
      ),
      read: (key) => {
        if (key === 'missing') {
          return Effect.succeed(undefined);
        }
        if (key === 'flaky' && storeDown) {
          return Effect.fail(
            new MediaStoreError({ message: 'Bucket down.', cause: null }),
          );
        }
        return Effect.succeed(
          key === 'broken' ? new Uint8Array([1, 2, 3]) : bytes,
        );
      },
      store: (key) => Effect.sync(() => stored.push(key)),
    });
    expect(await Effect.runPromise(backfill)).toBe(3);
    storeDown = false;
    expect(await Effect.runPromise(backfill)).toBe(1);
    expect(await Effect.runPromise(backfill)).toBe(0);
    expect(stored).toEqual(['flaky']);
  });

  it('answers zero when the renders cannot be listed', async () => {
    const backfill = makeContentBoxBackfill({
      unmeasuredKeys: Effect.fail(new Error('Database down.')),
      read: () => Effect.succeed(undefined),
      store: () => Effect.void,
    });
    expect(await Effect.runPromise(backfill)).toBe(0);
  });
});
