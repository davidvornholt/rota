import { describe, expect, it, mock } from 'bun:test';
import { Deferred, Effect, Fiber, TestClock, TestContext } from 'effect';
import { StudioRenderError } from '#/shared/ai/errors/ai-errors.ts';
import type { Garment } from '#/shared/data/garment.ts';
import { makeStudioWork, renderStudio } from './studio-render-job.ts';

const image = { key: 'existing', mime: 'image/png', width: 300, height: 400 };
const garment = (status: Garment['status'], hasStudio: boolean): Garment => ({
  id: 'shirt',
  status,
  name: 'Shirt',
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
  seasons: [],
  notes: '',
  price: null,
  purchasedOn: null,
  imageChoice: 'original',
  processingError: null,
  studioError: null,
  retiredAt: null,
  createdAt: new Date(),
  images: { original: image, ...(hasStudio ? { studio: image } : {}) },
});
const unavailable = new StudioRenderError({
  message: 'Image service is busy. Try again later.',
  cause: 'provider detail',
});

type StoredMedia = { readonly key: string; readonly bytes: number };

const setup = (
  row: Garment,
  putEffect: Effect.Effect<StoredMedia> = Effect.succeed({
    key: 'new',
    bytes: 1,
  }),
) => {
  let studioError: string | null = 'Previous error';
  const setStudioError = mock((_id: string, message: string | null) =>
    Effect.sync(() => {
      studioError = message;
    }),
  );
  const attachImage = mock(() => Effect.void);
  const setImageChoice = mock(() => Effect.void);
  const put = mock(() => putEffect);
  const work = makeStudioWork({ setStudioError });
  const render = (
    response: Effect.Effect<
      {
        readonly bytes: Uint8Array;
        readonly mime: 'image/png';
        readonly transparent: boolean;
      },
      StudioRenderError
    >,
  ) =>
    work(
      row.id,
      renderStudio(
        {
          garments: { attachImage, setImageChoice },
          media: { put },
          studio: { render: () => response },
        },
        {
          garment: row,
          description: 'A shirt',
          photoEffect: Effect.succeed({
            bytes: new Uint8Array([1]),
            mime: 'image/png',
          }),
          report: () => Effect.void,
        },
      ),
    );
  return {
    render,
    error: () => studioError,
    attachImage,
    setImageChoice,
    put,
    setStudioError,
  };
};

describe('studio render persistence', () => {
  it.each(['review', 'active', 'retired'] as const)(
    'preserves the %s garment and existing pictures when generation fails',
    async (status) => {
      const row = garment(status, true);
      const original = structuredClone(row);
      const job = setup(row);
      await Effect.runPromise(job.render(Effect.fail(unavailable)));
      expect(job.error()).toBe(unavailable.message);
      expect(job.attachImage).not.toHaveBeenCalled();
      expect(job.setImageChoice).not.toHaveBeenCalled();
      expect(job.put).not.toHaveBeenCalled();
      expect(row).toEqual(original);
      expect(job.setStudioError).toHaveBeenNthCalledWith(1, row.id, null);
    },
  );

  it('clears an earlier failure and preserves the photo choice when replacing an existing studio image', async () => {
    const row = garment('active', true);
    const job = setup(row);
    await Effect.runPromise(
      job.render(
        Effect.succeed({
          bytes: new Uint8Array([1]),
          mime: 'image/png',
          transparent: true,
        }),
      ),
    );
    expect(job.error()).toBeNull();
    expect(job.attachImage).toHaveBeenCalledTimes(1);
    expect(job.setImageChoice).not.toHaveBeenCalled();
    expect(row.status).toBe('active');
  });

  it('times out storage and records a failure instead of leaving the job active', async () => {
    const row = garment('active', true);
    const job = setup(row, Effect.never);
    await Effect.runPromise(
      Effect.gen(function* () {
        const storageStarted = yield* Deferred.make<void>();
        job.put.mockImplementation(() =>
          Deferred.succeed(storageStarted, undefined).pipe(
            Effect.andThen(Effect.never),
          ),
        );
        const fiber = yield* Effect.fork(
          job.render(
            Effect.succeed({
              bytes: new Uint8Array([1]),
              mime: 'image/png',
              transparent: true,
            }),
          ),
        );
        yield* Deferred.await(storageStarted);
        expect(job.put).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust('10 minutes');
        yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
    expect(job.error()).toBe(
      'The studio picture took too long. Try again later.',
    );
    expect(job.attachImage).not.toHaveBeenCalled();
    expect(job.setStudioError).toHaveBeenNthCalledWith(2, row.id, job.error());
  });
});
