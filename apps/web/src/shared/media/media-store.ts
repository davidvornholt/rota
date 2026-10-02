/**
 * Where image bytes live. Development keeps them in a directory; production
 * puts them in an S3-compatible bucket (Cloudflare R2). Either way a key is the
 * SHA-256 of the bytes plus an extension, so the same image stored twice is one
 * object and a key never names different bytes later. Smaller copies are
 * stored beside their original under a key derived from it.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { Effect } from 'effect';

import { type MediaStoreConfig, mediaStoreConfig } from '#/shared/env.ts';
import { MediaStoreError } from './errors/media-errors.ts';
import { makeMediaCopies } from './media-copies.ts';
import { extensionByMime } from './media-keys.ts';
import { mediaUrl, variantMime } from './media-variants.ts';

export type StoredMedia = {
  readonly key: string;
  readonly bytes: number;
};

const missingTrailingSlash = /\/?$/u;

const hexRadix = 16;
const hexDigitsPerByte = 2;

const keyFor = async (data: Uint8Array, mime: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(hexRadix).padStart(hexDigitsPerByte, '0'),
  ).join('');
  return `${hex}.${extensionByMime[mime] ?? 'bin'}`;
};

type Backend = {
  readonly write: (
    key: string,
    data: Uint8Array,
    mime: string,
  ) => Promise<void>;
  readonly read: (key: string) => Promise<Uint8Array | undefined>;
  readonly exists: (key: string) => Promise<boolean>;
};

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';

/** Node's file APIs rather than Bun's: the Vite dev server runs this code in Node. */
const localBackend = (directory: string): Backend => {
  const root = new URL(
    `${directory.replace(missingTrailingSlash, '/')}`,
    `file://${process.cwd()}/`,
  );
  const ready = mkdir(root, { recursive: true });
  return {
    write: async (key, data) => {
      await ready;
      await writeFile(new URL(key, root), data);
    },
    read: async (key) => {
      try {
        return new Uint8Array(await readFile(new URL(key, root)));
      } catch (error) {
        if (isMissingFile(error)) {
          return;
        }
        throw error;
      }
    },
    exists: async (key) => {
      try {
        await access(new URL(key, root));
        return true;
      } catch (error) {
        if (isMissingFile(error)) {
          return false;
        }
        throw error;
      }
    },
  };
};

const s3Backend = (
  config: MediaStoreConfig & { readonly MEDIA_STORE: 's3' },
): Backend => {
  if (typeof Bun === 'undefined') {
    throw new Error(
      'MEDIA_STORE=s3 needs the Bun runtime (the production server); development under the Vite dev server uses MEDIA_STORE=local.',
    );
  }
  const client = new Bun.S3Client({
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    bucket: config.S3_BUCKET,
    endpoint: config.S3_ENDPOINT,
  });
  return {
    write: async (key, data, mime) => {
      await client.write(key, data, { type: mime });
    },
    read: async (key) => {
      const file = client.file(key);
      return (await file.exists()) ? file.bytes() : undefined;
    },
    exists: (key) => client.file(key).exists(),
  };
};

const backendFor = (config: MediaStoreConfig): Backend =>
  config.MEDIA_STORE === 'local'
    ? localBackend(config.MEDIA_LOCAL_DIR)
    : s3Backend(config);

export class MediaStore extends Effect.Service<MediaStore>()(
  'shared/MediaStore',
  {
    effect: Effect.gen(function* () {
      const backend = backendFor(mediaStoreConfig);

      const put = (
        data: Uint8Array,
        mime: string,
      ): Effect.Effect<StoredMedia, MediaStoreError> =>
        Effect.tryPromise({
          try: async () => {
            const key = await keyFor(data, mime);
            await backend.write(key, data, mime);
            return { key, bytes: data.byteLength };
          },
          catch: (cause) =>
            new MediaStoreError({
              message: 'The image could not be stored.',
              cause,
            }),
        });

      const get = (
        key: string,
      ): Effect.Effect<Uint8Array | undefined, MediaStoreError> =>
        Effect.tryPromise({
          try: () => backend.read(key),
          catch: (cause) =>
            new MediaStoreError({
              message: 'The image could not be read.',
              cause,
            }),
        });

      const { variant, warm } = yield* makeMediaCopies({
        get,
        has: (key) =>
          Effect.tryPromise({
            try: () => backend.exists(key),
            catch: (cause) =>
              new MediaStoreError({
                message: 'The image store could not be checked.',
                cause,
              }),
          }),
        keep: (key, data) =>
          Effect.tryPromise({
            try: () => backend.write(key, data, variantMime),
            catch: (cause) =>
              new MediaStoreError({
                message: 'The resized image could not be stored.',
                cause,
              }),
          }),
      });

      /** Images always pass through the authenticated ownership check. */
      const urlFor = mediaUrl;

      return { put, get, variant, warm, urlFor };
    }),
  },
) {}
