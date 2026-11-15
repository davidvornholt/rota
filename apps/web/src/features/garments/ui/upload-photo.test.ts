import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { uploadIdFieldName } from '../upload-contract.ts';

// The browser draws and re-encodes the photo; the test only needs it passed on.
const downscale = await import('./downscale-image.ts');
mock.module('./downscale-image.ts', () => ({
  ...downscale,
  downscaleForUpload: (file: File) => Promise.resolve(file),
}));
const { uploadPhoto } = await import('./upload-photo.ts');

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const photo = new File(['x'], 'shirt.jpg', { type: 'image/jpeg' });
const accepted = 202;

describe('uploadPhoto', () => {
  it('sends the same upload id again when a retry follows a lost answer', async () => {
    const sentIds: Array<FormDataEntryValue | null> = [];
    let calls = 0;
    globalThis.fetch = ((_url: unknown, init: { body: FormData }) => {
      sentIds.push(init.body.get(uploadIdFieldName));
      calls += 1;
      return calls === 1
        ? Promise.reject(new TypeError('The connection was lost.'))
        : Promise.resolve(
            new Response(JSON.stringify({ ids: ['garment-1'] }), {
              status: accepted,
            }),
          );
    }) as typeof fetch;

    const first = await Effect.runPromise(
      uploadPhoto(photo, 'upload-a').pipe(Effect.result),
    );
    expect(first._tag === 'Failure' && first.failure.retryable).toBe(true);
    const retry = await Effect.runPromise(uploadPhoto(photo, 'upload-a'));

    expect(retry).toBe('garment-1');
    expect(sentIds).toEqual(['upload-a', 'upload-a']);
  });
});
