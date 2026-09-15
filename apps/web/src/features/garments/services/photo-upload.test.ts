import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { notFound } from '#/shared/data/errors/data-errors.ts';
import type { Garment } from '#/shared/data/garment.ts';
import { replaceOriginalPhoto } from './photo-upload.ts';

const pngSignature = '\u0089PNG\r\n\u001a\n';
const pngHeaderChunkLength = 13;
const uint32Bytes = 4;

const encodeText = (text: string) =>
  Array.from(text, (character) => character.charCodeAt(0));
const uint32 = (value: number) => {
  const view = new DataView(new ArrayBuffer(uint32Bytes));
  view.setUint32(0, value);
  return Array.from(new Uint8Array(view.buffer));
};
const width = 300;
const height = 400;
const png = new Uint8Array([
  ...encodeText(pngSignature),
  ...uint32(pngHeaderChunkLength),
  ...encodeText('IHDR'),
  ...uint32(width),
  ...uint32(height),
]);
const photo = { bytes: png, mime: 'image/png' };
const garment = { id: 'shirt', images: {} } as unknown as Garment;
const conflict = 409;

const setup = (existing = true) => {
  const attachImage = mock(() => Effect.void);
  const setImageChoice = mock(() => Effect.void);
  const put = mock(() => Effect.succeed({ key: 'new-key', bytes: 3 }));
  const byId = mock(() =>
    existing ? Effect.succeed(garment) : Effect.fail(notFound('The garment')),
  );
  return {
    deps: { garments: { byId, attachImage, setImageChoice }, media: { put } },
    attachImage,
    setImageChoice,
    put,
  };
};

describe('replaceOriginalPhoto', () => {
  it('stores the photo as the original and shows it at once', async () => {
    const { deps, attachImage, setImageChoice } = setup();
    await Effect.runPromise(replaceOriginalPhoto(deps, false, 'shirt', photo));
    expect(attachImage).toHaveBeenCalledWith('shirt', 'original', {
      key: 'new-key',
      mime: 'image/png',
      width,
      height,
      bytes: 3,
    });
    expect(setImageChoice).toHaveBeenCalledWith('shirt', 'original');
  });

  it('refuses while a studio picture is rendering and stores nothing', async () => {
    const { deps, put, attachImage } = setup();
    const error = await Effect.runPromise(
      Effect.flip(replaceOriginalPhoto(deps, true, 'shirt', photo)),
    );
    expect(error._tag).toBe('UploadError');
    expect(error).toMatchObject({ httpStatus: conflict });
    expect(put).not.toHaveBeenCalled();
    expect(attachImage).not.toHaveBeenCalled();
  });

  it('rejects a file that is not a photo before storing anything', async () => {
    const { deps, put } = setup();
    const error = await Effect.runPromise(
      Effect.flip(
        replaceOriginalPhoto(deps, false, 'shirt', {
          bytes: new Uint8Array(encodeText('hello')),
          mime: 'text/plain',
        }),
      ),
    );
    expect(error._tag).toBe('UploadError');
    expect(put).not.toHaveBeenCalled();
  });

  it('fails with not found for an unknown garment', async () => {
    const { deps, put } = setup(false);
    const error = await Effect.runPromise(
      Effect.flip(replaceOriginalPhoto(deps, false, 'ghost', photo)),
    );
    expect(error._tag).toBe('NotFoundError');
    expect(put).not.toHaveBeenCalled();
  });
});
