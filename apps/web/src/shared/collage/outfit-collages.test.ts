import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import type { CollageInput } from '#/shared/ai/collage-request.ts';
import { collageFailure } from '#/shared/ai/collage-request.ts';
import { CollageError } from '#/shared/ai/errors/ai-errors.ts';
import type { StoredCollage } from '#/shared/data/collage-repository.ts';
import { DataWriteError } from '#/shared/data/errors/data-errors.ts';
import type { Garment } from '#/shared/data/garment.ts';
import { mediaUrl } from '#/shared/media/media-variants.ts';
import { makeOutfitCollages } from './outfit-collages.ts';

const picture = (key: string) => ({
  key,
  mime: 'image/png',
  width: 300,
  height: 400,
});

const garment = (
  id: string,
  name: string,
  images: Garment['images'],
): Garment => ({
  id,
  status: 'active',
  name,
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  warmth: 2,
  rainOk: false,
  formality: 2,
  wearBudget: null,
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'studio',
  processingError: null,
  washedOn: null,
  washedAfterWear: false,
  laundryStartedOn: null,
  laundryReadyOn: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date(),
  images,
});

const wardrobe = [
  garment('shirt', 'Blue Oxford shirt', {
    original: picture('shirt-photo.jpg'),
    studio: picture('shirt-studio.png'),
  }),
  garment('chinos', 'Sand chinos', { original: picture('chinos-photo.jpg') }),
  garment('tee', 'Grey tee', {}),
];

const outfit = [
  {
    slot: 'top',
    garmentId: 'shirt',
    imageUrl: mediaUrl('shirt-studio.png'),
  },
  {
    slot: 'bottom',
    garmentId: 'chinos',
    imageUrl: mediaUrl('chinos-photo.jpg'),
  },
] as const;

const renderTime = '1 minute';

const setup = (
  outcomes: ReadonlyArray<'picture' | 'failure'> = ['picture'],
  options: {
    readonly stored?: Map<string, StoredCollage>;
    readonly failedWrites?: 'claim' | 'outcome';
  } = {},
) => {
  const stored = options.stored ?? new Map<string, StoredCollage>();
  const inputs: Array<CollageInput> = [];
  const writeFailure = new DataWriteError({
    message: 'The database write failed.',
    cause: 'Injected database failure.',
  });
  const collages = makeOutfitCollages({
    garments: { list: () => Effect.succeed(wardrobe) },
    collages: {
      find: (pieces) => Effect.sync(() => stored.get(pieces)),
      claimAttempt: (pieces, message, retry) =>
        Effect.gen(function* () {
          yield* Effect.yieldNow;
          if (options.failedWrites === 'claim') {
            return yield* writeFailure;
          }
          const existing = stored.get(pieces);
          if (existing?.status === 'ready' || (existing && !retry)) {
            return false;
          }
          stored.set(pieces, { status: 'failed', message });
          return true;
        }),
      saveReady: (pieces, saved) =>
        options.failedWrites === 'outcome'
          ? Effect.fail(writeFailure)
          : Effect.sync(() => {
              stored.set(pieces, { status: 'ready', ...saved });
            }),
      saveFailed: (pieces, message) =>
        options.failedWrites === 'outcome'
          ? Effect.fail(writeFailure)
          : Effect.sync(() => {
              if (stored.get(pieces)?.status !== 'ready') {
                stored.set(pieces, { status: 'failed', message });
              }
            }),
    },
    media: {
      get: (key) => Effect.succeed(new TextEncoder().encode(key)),
      put: (bytes) =>
        Effect.succeed({ key: 'collage.png', bytes: bytes.length }),
      urlFor: mediaUrl,
    },
    renderer: {
      render: (load) =>
        Effect.gen(function* () {
          const input = yield* load;
          const outcome = outcomes[inputs.length] ?? 'picture';
          inputs.push(input);
          yield* Effect.sleep(renderTime);
          if (outcome === 'failure') {
            return yield* new CollageError({
              message: collageFailure,
              cause: 'Foundry answered 500.',
            });
          }
          return new Uint8Array([1, 2, 3]);
        }),
    },
  });
  return { collages, stored, inputs };
};

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

describe('outfit collages', () => {
  it('makes one picture per combination, answers pending meanwhile, then the stored picture', async () => {
    const { collages, inputs, stored } = setup();
    const anotherRuntime = setup(['picture'], { stored });
    await run(
      Effect.gen(function* () {
        expect(
          yield* Effect.all(
            [
              collages.state(outfit, false),
              collages.state(outfit, true),
              anotherRuntime.collages.state(outfit, false),
            ],
            { concurrency: 'unbounded' },
          ),
        ).toEqual([
          { status: 'pending', progress: { status: 'preparing' } },
          { status: 'pending', progress: { status: 'preparing' } },
          { status: 'failed', message: collageFailure },
        ]);
        expect((yield* collages.state(outfit, false)).status).toBe('pending');
        yield* TestClock.adjust(renderTime);
        expect(yield* collages.state(outfit, false)).toEqual({
          status: 'ready',
          picture: {
            url: '/api/media/collage.png',
            srcSet:
              '/api/media/collage.png?w=320 320w, /api/media/collage.png?w=640 640w, /api/media/collage.png?w=1280 1088w',
            width: 1088,
            height: 1360,
          },
        });
      }),
    );
    expect(inputs).toHaveLength(1);
    expect(anotherRuntime.inputs).toHaveLength(0);
    expect(inputs[0]?.prompt).toContain(
      'image 1: Sand chinos, the bottom; image 2: Blue Oxford shirt, the top',
    );
    expect(
      inputs[0]?.images.map((image) => new TextDecoder().decode(image.bytes)),
    ).toEqual(['chinos-photo.jpg', 'shirt-studio.png']);
    expect([...stored.keys()]).toEqual([
      'bottom:chinos-photo.jpg top:shirt-studio.png',
    ]);
  });

  it('answers a stored failure without paying again, and tries again when asked', async () => {
    const { collages, inputs } = setup(['failure', 'picture']);
    await run(
      Effect.gen(function* () {
        yield* collages.state(outfit, false);
        yield* TestClock.adjust(renderTime);
        expect(yield* collages.state(outfit, false)).toEqual({
          status: 'failed',
          message: collageFailure,
        });
        expect(inputs).toHaveLength(1);
        expect((yield* collages.state(outfit, true)).status).toBe('pending');
        yield* TestClock.adjust(renderTime);
        expect((yield* collages.state(outfit, false)).status).toBe('ready');
      }),
    );
    expect(inputs).toHaveLength(2);
  });

  it('has nothing to make when no garment of the outfit has a picture', async () => {
    const { collages, inputs } = setup();
    expect(await run(collages.state([], false))).toEqual({ status: 'empty' });
    expect(inputs).toHaveLength(0);
  });

  it.each(['outcome write failure', 'process restart'] as const)(
    'requires an explicit retry after %s',
    async (scenario) => {
      const { collages, inputs, stored } = setup(['picture'], {
        failedWrites:
          scenario === 'outcome write failure' ? 'outcome' : undefined,
      });
      await run(
        Effect.gen(function* () {
          yield* collages.state(outfit, false);
          yield* TestClock.adjust(
            scenario === 'outcome write failure' ? renderTime : '1 second',
          );
          expect(inputs).toHaveLength(1);
          expect([...stored.values()]).toEqual([
            { status: 'failed', message: collageFailure },
          ]);
          const restarted = setup(['picture'], { stored });
          expect(yield* restarted.collages.state(outfit, false)).toEqual({
            status: 'failed',
            message: collageFailure,
          });
          expect(restarted.inputs).toHaveLength(0);
          expect((yield* collages.state(outfit, false)).status).toBe(
            scenario === 'outcome write failure' ? 'failed' : 'pending',
          );
          yield* TestClock.adjust(renderTime);
          expect(inputs).toHaveLength(1);
          expect(restarted.inputs).toHaveLength(0);
        }),
      );
    },
  );

  it('does not render when the durable attempt claim fails', async () => {
    const { collages, inputs, stored } = setup(['picture'], {
      failedWrites: 'claim',
    });
    await run(
      Effect.gen(function* () {
        for (const retry of [false, true]) {
          const result = yield* Effect.result(collages.state(outfit, retry));
          expect(result._tag).toBe('Failure');
        }
        yield* TestClock.adjust(renderTime);
      }),
    );
    expect(inputs).toHaveLength(0);
    expect(stored.size).toBe(0);
  });
});
