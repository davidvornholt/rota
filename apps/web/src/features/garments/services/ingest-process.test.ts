import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Claude } from '#/shared/ai/claude.ts';
import { StudioRenderer } from '#/shared/ai/studio-renderer.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { IngestService } from './ingest.ts';

const processWith = (status: string) => {
  const calls: Array<string> = [];
  const fail = (name: string) => () => {
    calls.push(name);
    throw new Error(`${name} must not be called`);
  };
  const run = IngestService.make.pipe(
    Effect.flatMap((ingest) => ingest.process('garment-1')),
    // The reading runs in the background, so give it time to reach a fake.
    Effect.andThen(Effect.sleep('50 millis')),
    Effect.provideService(GarmentRepository, {
      byId: () => Effect.succeed({ id: 'garment-1', status }),
      // The fakes cannot read a photo, so any reading ends here.
      markProcessingError: () => Effect.sync(() => calls.push('reading')),
    } as never),
    Effect.provideService(Claude, { structured: fail('claude') } as never),
    Effect.provideService(MediaStore, { read: fail('media') } as never),
    Effect.provideService(StudioRenderer, { render: fail('studio') } as never),
  );
  return Effect.runPromise(run).then(() => calls);
};

describe('IngestService.process', () => {
  it('leaves a garment that is no longer processing alone', async () => {
    // A retried upload finds the garment the first try opened, which was read
    // and accepted while the retry stored its photo.
    const answers = await Promise.all(
      ['active', 'review', 'retired'].map(processWith),
    );
    expect(answers).toEqual([[], [], []]);
  });
});
