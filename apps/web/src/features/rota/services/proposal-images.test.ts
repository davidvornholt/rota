import { describe, expect, it } from 'bun:test';
import { Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { MediaStoreError } from '#/shared/media/errors/media-errors.ts';
import { proposalImages, proposalWidth } from './proposal-images.ts';

const expectedConcurrency = 4;

const candidate = (garmentId: string) => ({
  garmentId,
  image: { key: garmentId, mime: 'image/png', width: 1024, height: 1024 },
});

it('uses the wider copy for a landscape photo so its garment is not shrunk further', () => {
  const image = { key: 'photo', mime: 'image/jpeg' };
  expect(proposalWidth({ ...image, width: 1200, height: 1600 })).toBe(640);
  expect(proposalWidth({ ...image, width: 1024, height: 1024 })).toBe(640);
  expect(proposalWidth({ ...image, width: 2048, height: 922 })).toBe(1280);
});

describe('proposal image preparation', () => {
  it('loads each garment once, preserving complete bytes and tolerating absent files', async () => {
    const calls: Array<string> = [];
    const bytes = new Uint8Array([1, 2]);
    const result = await Effect.runPromise(
      proposalImages(
        {
          variant: (key, width) =>
            Effect.sync(() => {
              calls.push(`${key}@${width}`);
              return key === 'missing'
                ? undefined
                : { bytes, mime: 'image/webp', lasting: true };
            }),
        },
        [
          candidate('shirt'),
          candidate('shirt'),
          candidate('missing'),
          { garmentId: 'no-image', image: undefined },
        ],
      ),
    );
    expect(calls).toEqual(['shirt@640', 'missing@640']);
    expect(result.size).toBe(1);
    expect(result.get('shirt')).toEqual({
      mimeType: 'image/webp',
      data: bytes,
    });
    expect(result.get('shirt')?.data).toBe(bytes);
  });

  it('fails before calling the model when storage fails instead of silently dropping pictures', async () => {
    const result = await Effect.runPromise(
      proposalImages(
        {
          variant: () =>
            Effect.fail(
              new MediaStoreError({ message: 'Unavailable', cause: undefined }),
            ),
        },
        [candidate('shirt')],
      ).pipe(Effect.result),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'ProposalGenerationError' },
    });
  });

  it('interrupts a stalled image read within twenty seconds', async () => {
    let interrupted = false;
    await Effect.runPromise(
      Effect.gen(function* () {
        const task = yield* proposalImages(
          {
            variant: () =>
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Effect.sync(() => {
                    interrupted = true;
                  }),
                ),
              ),
          },
          [candidate('shirt')],
        ).pipe(Effect.result, Effect.forkChild);
        yield* TestClock.adjust('20 seconds');
        expect(yield* Fiber.join(task)).toMatchObject({
          _tag: 'Failure',
          failure: {
            _tag: 'ProposalGenerationError',
            cause: 'Image read deadline exceeded.',
          },
        });
        expect(interrupted).toBe(true);
      }).pipe(Effect.provide(TestClock.layer())),
    );
  });

  it('bounds the whole preparation even when every individual read finishes in time', async () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      candidate(String(index)),
    );
    let active = 0;
    let peak = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        const task = yield* proposalImages(
          {
            variant: () =>
              Effect.acquireUseRelease(
                Effect.sync(() => {
                  active += 1;
                  peak = Math.max(peak, active);
                }),
                () =>
                  Effect.sleep('19 seconds').pipe(
                    Effect.as({
                      bytes: new Uint8Array([1]),
                      mime: 'image/webp',
                      lasting: true,
                    }),
                  ),
                () =>
                  Effect.sync(() => {
                    active -= 1;
                  }),
              ),
          },
          candidates,
        ).pipe(Effect.result, Effect.forkChild);
        yield* TestClock.adjust('45 seconds');
        expect(yield* Fiber.join(task)).toMatchObject({
          _tag: 'Failure',
          failure: {
            _tag: 'ProposalGenerationError',
            cause: 'Image preparation deadline exceeded.',
          },
        });
        expect(peak).toBe(expectedConcurrency);
        expect(active).toBe(0);
      }).pipe(Effect.provide(TestClock.layer())),
    );
  });
});
