/**
 * Where image bytes live. Development keeps them in a directory; production
 * puts them in an S3-compatible bucket (Cloudflare R2). Either way a key is the
 * SHA-256 of the bytes plus an extension, so the same image stored twice is one
 * object and a key never names different bytes later.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Effect } from 'effect';

import { type MediaStoreConfig, mediaStoreConfig } from '#/shared/env.ts';
import { MediaStoreError } from './errors/media-errors.ts';

export type StoredMedia = {
  readonly key: string;
  readonly bytes: number;
};

const extensionByMime: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const isStorableMime = (mime: string): boolean =>
  mime in extensionByMime;

const keyPattern = /^[a-f0-9]{64}\.(?<extension>jpg|png|webp)$/u;
const missingTrailingSlash = /\/?$/u;
const trailingSlash = /\/$/u;

export const isMediaKey = (key: string): boolean => keyPattern.test(key);

export const mimeOfKey = (key: string): string | undefined =>
  Object.entries(extensionByMime).find(([, extension]) =>
    key.endsWith(`.${extension}`),
  )?.[0];

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
  };
};

const backendFor = (config: MediaStoreConfig): Backend =>
  config.MEDIA_STORE === 'local'
    ? localBackend(config.MEDIA_LOCAL_DIR)
    : s3Backend(config);

export class MediaStore extends Effect.Service<MediaStore>()(
  'shared/MediaStore',
  {
    sync: () => {
      const backend = backendFor(mediaStoreConfig);
      const publicBase = mediaStoreConfig.MEDIA_PUBLIC_BASE_URL;

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

      /**
       * Where the browser fetches an image: the bucket's own domain when one is
       * configured, otherwise the app's authenticated media route.
       */
      const urlFor = (key: string): string =>
        publicBase === undefined
          ? `/api/media/${key}`
          : `${publicBase.replace(trailingSlash, '')}/${key}`;

      return { put, get, urlFor };
    },
  },
) {}
