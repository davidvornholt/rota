import { Effect } from 'effect';
import sharp from 'sharp';
import type { PromptPart } from './bedrock-request.ts';
import { BedrockError } from './errors/ai-errors.ts';

const manyImageThreshold = 20;
const manyImageLongEdge = 2000;
const imageConcurrency = 2;

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
  return parts.filter((part) => 'image' in part).length <= manyImageThreshold
    ? Effect.succeed(parts)
    : Effect.forEach(
        parts,
        (part): Effect.Effect<PromptPart, BedrockError> =>
          'text' in part
            ? Effect.succeed(part)
            : Effect.tryPromise({
                try: () =>
                  sharp(part.image.data)
                    .resize(manyImageLongEdge, manyImageLongEdge, {
                      fit: 'inside',
                      withoutEnlargement: true,
                    })
                    .toBuffer()
                    .then((data) => ({
                      image: { mimeType: part.image.mimeType, data },
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
};
