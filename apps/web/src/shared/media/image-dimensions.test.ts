import { describe, expect, it } from 'bun:test';

import { imageDimensions } from './image-dimensions.ts';

const pngSignature = '\u0089PNG\r\n\u001a\n';
const pngHeaderChunkLength = 13;
const pngHeaderChunkType = 'IHDR';
const uint32Bytes = 4;
const uint16Bytes = 2;

const encodeText = (text: string) =>
  Array.from(text, (character) => character.charCodeAt(0));

const uint32 = (value: number) => {
  const view = new DataView(new ArrayBuffer(uint32Bytes));
  view.setUint32(0, value);
  return Array.from(new Uint8Array(view.buffer));
};

const uint16 = (value: number) => {
  const view = new DataView(new ArrayBuffer(uint16Bytes));
  view.setUint16(0, value);
  return Array.from(new Uint8Array(view.buffer));
};

const png = (width: number, height: number) =>
  new Uint8Array([
    ...encodeText(pngSignature),
    ...uint32(pngHeaderChunkLength),
    ...encodeText(pngHeaderChunkType),
    ...uint32(width),
    ...uint32(height),
  ]);

const jpegMarkerPrefix = 0xff;
const jpegStartOfImage = 0xd8;
const jpegApp0 = 0xe0;
const jpegBaselineFrame = 0xc0;
const app0Length = 4;
const frameSegmentLength = 11;
const samplePrecision = 8;
const componentCount = 3;

/** SOI, an APP0 segment to skip, then a baseline frame header carrying the size. */
const jpeg = (width: number, height: number) =>
  new Uint8Array([
    jpegMarkerPrefix,
    jpegStartOfImage,
    jpegMarkerPrefix,
    jpegApp0,
    ...uint16(app0Length),
    ...encodeText('JF'),
    jpegMarkerPrefix,
    jpegBaselineFrame,
    ...uint16(frameSegmentLength),
    samplePrecision,
    ...uint16(height),
    ...uint16(width),
    componentCount,
    ...encodeText('\u0001\u0002\u0003'),
  ]);

const studioWidth = 1200;
const studioHeight = 1600;
const photoWidth = 2048;
const photoHeight = 1536;

describe('image dimensions', () => {
  it('reads a PNG header', () => {
    expect(imageDimensions(png(studioWidth, studioHeight))).toEqual({
      width: studioWidth,
      height: studioHeight,
    });
  });

  it('walks JPEG segments to the frame header', () => {
    expect(imageDimensions(jpeg(photoWidth, photoHeight))).toEqual({
      width: photoWidth,
      height: photoHeight,
    });
  });

  it('answers nothing for bytes that are neither', () => {
    expect(
      imageDimensions(new Uint8Array(encodeText('GIF89a'))),
    ).toBeUndefined();
    expect(imageDimensions(new Uint8Array())).toBeUndefined();
    expect(
      imageDimensions(
        new Uint8Array([jpegMarkerPrefix, jpegStartOfImage, 0, 0]),
      ),
    ).toBeUndefined();
  });
});
