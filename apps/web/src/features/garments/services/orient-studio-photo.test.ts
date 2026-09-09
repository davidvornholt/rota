import { expect, it, mock } from 'bun:test';
import { Effect, Schema } from 'effect';
import sharp from 'sharp';
import { GeminiError } from '#/shared/ai/errors/ai-errors.ts';
import type { GenerateJsonInput } from '#/shared/ai/gemini-request.ts';
import { ExtractionSchema } from '../schemas/extraction.ts';
import { orientStudioPhoto } from './orient-studio-photo.ts';

const width = 2;
const height = 1;
const channels = 3;
const channelMaximum = 255;
const pixels = new Uint8Array([channelMaximum, 0, 0, 0, 0, channelMaximum]);

it('analyzes the original on regeneration and applies the reported rotation', async () => {
  const photo = {
    bytes: await sharp(pixels, { raw: { width, height, channels } })
      .png()
      .toBuffer(),
    mime: 'image/png',
  };
  const analyzed = mock(() => undefined);
  const generateJson = <A, I>(input: GenerateJsonInput<A, I>) => {
    analyzed();
    expect(input.parts[0]).toEqual({
      image: { mimeType: photo.mime, data: photo.bytes },
    });
    return Schema.decodeUnknown(input.schema)({ rotationClockwise: 180 }).pipe(
      Effect.mapError(
        (cause) =>
          new GeminiError({
            reason: 'answer',
            message: 'Invalid orientation.',
            cause,
          }),
      ),
    );
  };
  const result = await Effect.runPromise(
    orientStudioPhoto({ generateJson }, photo),
  );
  expect(analyzed).toHaveBeenCalledTimes(1);
  expect(new Uint8Array(await sharp(result.bytes).raw().toBuffer())).toEqual(
    new Uint8Array([0, 0, channelMaximum, channelMaximum, 0, 0]),
  );
});

it('propagates analyzer failures without silently rendering an unprepared photo', async () => {
  const failure = new GeminiError({
    reason: 'answer',
    message: 'Analysis failed.',
    cause: undefined,
  });
  const result = await Effect.runPromise(
    orientStudioPhoto(
      { generateJson: () => Effect.fail(failure) },
      { bytes: pixels, mime: 'image/png' },
    ).pipe(Effect.either),
  );
  expect(result).toMatchObject({ _tag: 'Left', left: failure });
});

it('requires the same rotation contract during initial garment analysis', () => {
  const schema = ExtractionSchema.pipe(Schema.pick('rotationClockwise'));
  expect(Schema.is(schema)({ rotationClockwise: 180 })).toBe(true);
  expect(Schema.is(schema)({ rotationClockwise: 45 })).toBe(false);
  expect(Schema.is(schema)({})).toBe(false);
});
