import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Fiber } from 'effect';
import { MediaStoreError } from '#/shared/media/errors/media-errors.ts';
import { makeCopyWarmup } from './copy-warmup.ts';

const batchSize = 20;
const storedPictures = 45;
const lastBatch = storedPictures - 2 * batchSize;

const keys = Array.from(
  { length: storedPictures },
  (_, index) => `key-${index}`,
);

describe('picture copy warm-up', () => {
  it('works through stored pictures in bounded batches and does not repeat finished ones', async () => {
    const warmed: Array<string> = [];
    const warmup = makeCopyWarmup({
      storedKeys: Effect.succeed(keys),
      warm: (key) => Effect.sync(() => warmed.push(key)),
    });
    const batches = [
      await Effect.runPromise(warmup),
      await Effect.runPromise(warmup),
      await Effect.runPromise(warmup),
      await Effect.runPromise(warmup),
    ];
    expect(batches).toEqual([batchSize, batchSize, lastBatch, 0]);
    expect(warmed).toEqual(keys);
  });

  it('tries a failed picture again on the next call', async () => {
    let failing = true;
    const warmup = makeCopyWarmup({
      storedKeys: Effect.succeed(['flaky']),
      warm: () =>
        failing
          ? Effect.fail(
              new MediaStoreError({ message: 'Bucket down.', cause: null }),
            )
          : Effect.void,
    });
    expect(await Effect.runPromise(warmup)).toBe(1);
    failing = false;
    expect(await Effect.runPromise(warmup)).toBe(1);
    expect(await Effect.runPromise(warmup)).toBe(0);
  });

  it('skips a call while the previous one is still running', async () => {
    const gate = await Effect.runPromise(Deferred.make<void>());
    const warmup = makeCopyWarmup({
      storedKeys: Effect.succeed(['slow']),
      warm: () => Deferred.await(gate),
    });
    const first = Effect.runFork(warmup);
    await Effect.runPromise(Effect.yieldNow());
    expect(await Effect.runPromise(warmup)).toBe(0);
    await Effect.runPromise(Deferred.succeed(gate, undefined));
    expect(await Effect.runPromise(Fiber.join(first))).toBe(1);
  });

  it('answers zero when the stored pictures cannot be listed', async () => {
    const warmup = makeCopyWarmup({
      storedKeys: Effect.fail(new Error('Database down.')),
      warm: () => Effect.void,
    });
    expect(await Effect.runPromise(warmup)).toBe(0);
  });
});
