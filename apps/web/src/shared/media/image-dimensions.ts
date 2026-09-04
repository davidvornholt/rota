export type ImageDimensions = {
  readonly width: number;
  readonly height: number;
};

/** The eight bytes every PNG file opens with: a high-bit byte, "PNG", CR LF, SUB, LF. */
const highBitByte = 0x89;
const carriageReturn = 0x0d;
const lineFeed = 0x0a;
const substitute = 0x1a;
const pngSignature = [
  highBitByte,
  ...Array.from('PNG', (character) => character.charCodeAt(0)),
  carriageReturn,
  lineFeed,
  substitute,
  lineFeed,
];
const pngWidthOffset = 16;
const pngHeightOffset = 20;
const uint32Bytes = 4;

const readPng = (view: DataView): ImageDimensions | undefined => {
  if (view.byteLength < pngHeightOffset + uint32Bytes) {
    return undefined;
  }
  const signed = pngSignature.every(
    (byte, index) => view.getUint8(index) === byte,
  );
  return signed
    ? {
        width: view.getUint32(pngWidthOffset),
        height: view.getUint32(pngHeightOffset),
      }
    : undefined;
};

const jpegMarkerPrefix = 0xff;
const jpegStartOfImage = 0xd8;
const firstStartOfFrame = 0xc0;
const lastStartOfFrame = 0xcf;
/** Markers inside the SOF range that are not frames. */
const defineHuffmanTable = 0xc4;
const jpegExtension = 0xc8;
const defineArithmeticCoding = 0xcc;
const markerBytes = 2;
const frameHeightOffset = 5;
const frameWidthOffset = 7;
const smallestFrameHeader = 9;

const isStartOfFrame = (marker: number): boolean =>
  marker >= firstStartOfFrame &&
  marker <= lastStartOfFrame &&
  marker !== defineHuffmanTable &&
  marker !== jpegExtension &&
  marker !== defineArithmeticCoding;

/** Walks the JPEG segment chain to the first start-of-frame, which carries the size. */
const readJpeg = (view: DataView): ImageDimensions | undefined => {
  if (
    view.byteLength < markerBytes + markerBytes ||
    view.getUint8(0) !== jpegMarkerPrefix ||
    view.getUint8(1) !== jpegStartOfImage
  ) {
    return undefined;
  }
  let offset = markerBytes;
  while (offset + smallestFrameHeader < view.byteLength) {
    if (view.getUint8(offset) !== jpegMarkerPrefix) {
      return undefined;
    }
    const marker = view.getUint8(offset + 1);
    if (isStartOfFrame(marker)) {
      return {
        height: view.getUint16(offset + frameHeightOffset),
        width: view.getUint16(offset + frameWidthOffset),
      };
    }
    offset += markerBytes + view.getUint16(offset + markerBytes);
  }
  return undefined;
};

/**
 * The pixel size of a PNG or JPEG from its header bytes. Nothing decodes the
 * image: the pipeline needs the size to lay the frame out, not the pixels.
 */
export const imageDimensions = (
  bytes: Uint8Array,
): ImageDimensions | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return readPng(view) ?? readJpeg(view);
};
