import { lstat } from 'node:fs/promises';
import process from 'node:process';
import { NotFound } from '@rota/api/errors';
import type { Garment } from '@rota/api/wardrobe';
import { Effect, FileSystem, Option, Path } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';
import {
  PictureNotSaved,
  UnexpectedResponse,
} from '../../shared/errors/errors.ts';
import {
  explainHttpFailure,
  notSignedIn,
  Rota,
} from '../../shared/rota-api.ts';
import { xdgDirectory } from '../../shared/xdg.ts';

/** The widths the media route renders; a missing width asks for the stored original. */
export const pictureWidths = ['320', '640', '1280', 'original'] as const;
export type PictureWidth = (typeof pictureWidths)[number];

/** Which of a garment's pictures to fetch. */
export type PictureKind = 'picture' | 'photo' | 'studio';

/**
 * A media key is the SHA-256 of the bytes plus an extension, so it names the
 * same picture forever and is safe as a file name. Anything else would let a
 * server choose where the file lands.
 */
const mediaKeyPattern = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/u;

const picturesDirectory = Effect.gen(function* () {
  const path = yield* Path.Path;
  const cacheHome = yield* xdgDirectory('XDG_CACHE_HOME', '.cache');
  return path.join(cacheHome, 'rota', 'pictures');
});

const notSaved = (file: string) => (error: { readonly message: string }) =>
  new PictureNotSaved({ message: `Could not save ${file}: ${error.message}` });

const isMissing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const entryAt = (target: string) =>
  Effect.tryPromise({ try: () => lstat(target), catch: (error) => error }).pipe(
    Effect.map(Option.some),
    Effect.catchIf(isMissing, () => Effect.succeedNone),
    Effect.mapError(
      (error) =>
        new PictureNotSaved({
          message: `Could not use ${target}: ${error instanceof Error ? error.message : String(error)}`,
        }),
    ),
  );

/**
 * Refuses a cache directory that is a link or another user's, since whoever
 * controls it decides where a picture is read from or written to. Tells
 * whether the directory exists.
 */
const ownDirectory = (target: string) =>
  Effect.gen(function* () {
    const entry = yield* entryAt(target);
    if (Option.isNone(entry)) {
      return false;
    }
    if (!entry.value.isDirectory() || entry.value.uid !== process.getuid?.()) {
      return yield* new PictureNotSaved({
        message: `${target} is not a plain directory of yours. Remove it, then try again.`,
      });
    }
    return true;
  });

const download = (source: URL) =>
  Effect.gen(function* () {
    const { origin, token } = yield* Rota;
    const http = yield* HttpClient.HttpClient;
    const response = yield* http
      .execute(
        HttpClientRequest.get(source).pipe(
          HttpClientRequest.bearerToken(token),
        ),
      )
      .pipe(Effect.mapError(explainHttpFailure(origin)));
    return yield* HttpClientResponse.matchStatus(response, {
      '2xx': (found) =>
        found.arrayBuffer.pipe(Effect.mapError(explainHttpFailure(origin))),
      // The media route sends a signed-out visitor to the sign-in page.
      '3xx': () => Effect.fail(notSignedIn(origin)),
      404: () =>
        Effect.fail(
          new NotFound({ message: 'Rota no longer has this picture.' }),
        ),
      orElse: () =>
        Effect.fail(
          new UnexpectedResponse({
            message: `${origin} did not send the picture (HTTP ${response.status}).`,
          }),
        ),
    });
  });

/**
 * Saves one stored picture into the cache and returns its absolute path. A
 * picture already in the cache is reused, since its key never changes.
 */
const cachePicture = (url: string, width: PictureWidth) =>
  Effect.gen(function* () {
    const { origin } = yield* Rota;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const source = new URL(url, origin);
    const key = decodeURIComponent(source.pathname.split('/').at(-1) ?? '');
    if (source.origin !== origin || !mediaKeyPattern.test(key)) {
      return yield* new UnexpectedResponse({
        message: `${origin} named a picture this rota cannot fetch: ${url}`,
      });
    }
    const directory = yield* picturesDirectory;
    const directories = [path.dirname(directory), directory];
    const file = path.join(
      directory,
      width === 'original' ? key : `${key}.w${width}.webp`,
    );
    const existing = yield* Effect.forEach(directories, ownDirectory);
    if (existing.every(Boolean)) {
      const cached = yield* entryAt(file);
      if (Option.isSome(cached) && cached.value.isFile()) {
        return file;
      }
    }
    if (width !== 'original') {
      source.searchParams.set('w', width);
    }
    const bytes = yield* download(source);
    yield* fs
      .makeDirectory(directory, { recursive: true, mode: 0o700 })
      .pipe(Effect.mapError(notSaved(file)));
    // Checked again, since a link may have taken a directory's place while the
    // picture downloaded.
    yield* Effect.forEach(directories, ownDirectory);
    // Written as a new file beside the final name and renamed, so a broken
    // download never poses as a cached picture, and a link at either name is
    // replaced rather than followed.
    const draft = `${file}.${crypto.randomUUID()}.tmp`;
    yield* Effect.gen(function* () {
      yield* fs.writeFile(draft, new Uint8Array(bytes), { flag: 'wx' });
      yield* fs.rename(draft, file);
    }).pipe(Effect.mapError(notSaved(file)));
    return file;
  });

/** Saves the chosen picture of a garment, or reports that it has none. */
export const garmentPicture = (
  garment: Garment,
  kind: PictureKind,
  width: PictureWidth,
) =>
  Effect.gen(function* () {
    const picture = garment[kind];
    return {
      id: garment.id,
      name: garment.name,
      path: picture === null ? null : yield* cachePicture(picture.url, width),
    };
  });
