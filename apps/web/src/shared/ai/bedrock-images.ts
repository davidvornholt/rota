import { Effect } from 'effect';
import sharp from 'sharp';
import type { PromptPart } from './bedrock-request.ts';
import { BedrockError } from './errors/ai-errors.ts';

const manyImageThreshold = 20;
const maximumLongEdge = 2000;
const minimumLongEdge = 512;
const dimensionScale = 0.75;
const imageConcurrency = 2;
const bytesPerMiB = 1_048_576;
const imageBudgetMiB = 12;
const singleImageLimitMiB = 3.75;
const imageByteBudget = imageBudgetMiB * bytesPerMiB;
const singleImageByteLimit = singleImageLimitMiB * bytesPerMiB;
const jpegQuality = 85;

const fitsImageBudget = (parts: ReadonlyArray<PromptPart>): boolean => {
  let total = 0;
  for (const part of parts) {
    if ('image' in part) {
      if (part.image.data.byteLength > singleImageByteLimit) {
        return false;
      }
      total += part.image.data.byteLength;
    }
  }
  return total <= imageByteBudget;
};

/** Claude lowers the per-image dimension limit when a request contains more than 20 images. */
const supportedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);
export const prepareBedrockParts = (parts: ReadonlyArray<PromptPart>) => {
  const invalid = parts.find(
    (part) => 'image' in part && !supportedMimeTypes.has(part.image.mimeType),
  );
  if (invalid !== undefined && 'image' in invalid) {
    return Effect.fail(
      new BedrockError({
        reason: 'request',
        message: `Bedrock cannot read ${invalid.image.mimeType} images. Upload a PNG, JPEG, GIF, or WebP image.`,
        cause: undefined,
      }),
    );
  }
  if (
    parts.filter((part) => 'image' in part).length <= manyImageThreshold &&
    fitsImageBudget(parts)
  ) {
    return Effect.succeed(parts);
  }
  return Effect.gen(function* () {
    // Base64 expands image bytes by one third. Leave room for the prompt and
    // schema rather than sending full-size studio PNGs in a wardrobe request.
    for (
      let longEdge = maximumLongEdge;
      longEdge >= minimumLongEdge;
      longEdge = Math.floor(longEdge * dimensionScale)
    ) {
      const prepared = yield* Effect.forEach(
        parts,
        (part): Effect.Effect<PromptPart, BedrockError> =>
          'text' in part
            ? Effect.succeed(part)
            : Effect.tryPromise({
                try: () =>
                  sharp(part.image.data)
                    .resize(longEdge, longEdge, {
                      fit: 'inside',
                      withoutEnlargement: true,
                    })
                    .flatten({ background: '#fff' })
                    .jpeg({ quality: jpegQuality })
                    .toBuffer()
                    .then((data) => ({
                      image: { mimeType: 'image/jpeg', data },
                    })),
                catch: (cause) =>
                  new BedrockError({
                    reason: 'request',
                    message:
                      'A wardrobe image could not be prepared for Claude. Try uploading it again.',
                    cause,
                  }),
              }),
        { concurrency: imageConcurrency },
      );
      if (fitsImageBudget(prepared)) {
        return prepared;
      }
    }
    return yield* new BedrockError({
      reason: 'request',
      message: 'The wardrobe images exceed the Bedrock request size limit.',
      cause: undefined,
    });
  });
};
