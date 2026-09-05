import { pngCrc32 } from './png-crc.ts';
import {
  isValidPngScanlineHeader,
  type PngScanlineHeader,
  validatePngScanlines,
} from './png-scanlines.ts';

const pngHighBitByte = 137;
const capitalP = 80;
const capitalN = 78;
const capitalG = 71;
const carriageReturn = 13;
const lineFeed = 10;
const substitute = 26;
const pngSignature = [
  pngHighBitByte,
  capitalP,
  capitalN,
  capitalG,
  carriageReturn,
  lineFeed,
  substitute,
  lineFeed,
];
const pngChunkOverhead = 12;
const pngChunkTypeOffset = 4;
const pngChunkTypeLength = 4;
const pngDataOffset = 8;
const pngCrcBytes = 4;
const pngHeaderChunkLength = 13;
const pngHeaderChunk = 'IHDR';
const pngDataChunk = 'IDAT';
const pngEndChunk = 'IEND';
const minimumImageDataLength = 0;
const pngHeaderWidthOffset = 0;
const pngHeaderHeightOffset = 4;
const pngHeaderBitDepthOffset = 8;
const pngHeaderColorTypeOffset = 9;
const pngHeaderCompressionOffset = 10;
const pngHeaderFilterOffset = 11;
const pngHeaderInterlaceOffset = 12;
const noCompression = 0;
const noFilter = 0;

type PngHeader = PngScanlineHeader & {
  readonly compressionMethod: number;
  readonly filterMethod: number;
};

type PngChunk = {
  readonly offset: number;
  readonly length: number;
  readonly end: number;
  readonly type: string;
};

type PngState = {
  header: PngHeader | undefined;
  hasData: boolean;
  dataSequenceEnded: boolean;
  dataChunks: Array<Uint8Array>;
};

const pngChunkType = (view: DataView, offset: number): string =>
  String.fromCharCode(
    ...Array.from({ length: pngChunkTypeLength }, (_, index) =>
      view.getUint8(offset + pngChunkTypeOffset + index),
    ),
  );

const isValidPngChunk = (
  view: DataView,
  offset: number,
  end: number,
): boolean =>
  pngCrc32(view, offset + pngChunkTypeOffset, end - pngCrcBytes) ===
  view.getUint32(end - pngCrcBytes);

const isPngSignature = (view: DataView): boolean =>
  pngSignature.every((byte, index) => view.getUint8(index) === byte);

const readPngHeader = (
  view: DataView,
  offset: number,
  length: number,
): PngHeader | undefined => {
  if (
    offset !== pngSignature.length ||
    length !== pngHeaderChunkLength ||
    pngChunkType(view, offset) !== pngHeaderChunk
  ) {
    return;
  }
  const dataOffset = offset + pngDataOffset;
  return {
    width: view.getUint32(dataOffset + pngHeaderWidthOffset),
    height: view.getUint32(dataOffset + pngHeaderHeightOffset),
    bitDepth: view.getUint8(dataOffset + pngHeaderBitDepthOffset),
    colorType: view.getUint8(dataOffset + pngHeaderColorTypeOffset),
    compressionMethod: view.getUint8(dataOffset + pngHeaderCompressionOffset),
    filterMethod: view.getUint8(dataOffset + pngHeaderFilterOffset),
    interlaceMethod: view.getUint8(dataOffset + pngHeaderInterlaceOffset),
  };
};

const isValidPngHeader = (header: PngHeader): boolean =>
  isValidPngScanlineHeader(header) &&
  header.compressionMethod === noCompression &&
  header.filterMethod === noFilter;

const isDecodablePngData = async (
  chunks: ReadonlyArray<Uint8Array>,
  header: PngHeader,
): Promise<boolean> => {
  try {
    const stream = new Blob(chunks.map((chunk) => chunk as BlobPart)).stream();
    const decompressed = new Uint8Array(
      await new Response(
        stream.pipeThrough(new DecompressionStream('deflate')),
      ).arrayBuffer(),
    );
    return validatePngScanlines(decompressed, header);
  } catch {
    return false;
  }
};

const readPngChunk = (view: DataView, offset: number): PngChunk | undefined => {
  const length = view.getUint32(offset);
  const end = offset + pngChunkOverhead + length;
  if (end > view.byteLength || !isValidPngChunk(view, offset, end)) {
    return;
  }
  return {
    offset,
    length,
    end,
    type: pngChunkType(view, offset),
  };
};

const processPngChunk = (
  state: PngState,
  bytes: Uint8Array,
  view: DataView,
  chunk: PngChunk,
): boolean => {
  if (chunk.type === pngHeaderChunk) {
    if (state.header !== undefined) {
      return false;
    }
    state.header = readPngHeader(view, chunk.offset, chunk.length);
    if (state.header === undefined || !isValidPngHeader(state.header)) {
      return false;
    }
  }
  if (chunk.type === pngDataChunk) {
    if (
      state.header === undefined ||
      state.dataSequenceEnded ||
      chunk.length <= minimumImageDataLength
    ) {
      return false;
    }
    state.hasData = true;
    state.dataChunks.push(
      bytes.subarray(chunk.offset + pngDataOffset, chunk.end - pngCrcBytes),
    );
  } else if (state.hasData) {
    state.dataSequenceEnded = true;
  }
  return true;
};

const parsePngChunks = (
  bytes: Uint8Array,
  view: DataView,
): (PngState & { readonly hasEnd: boolean }) | undefined => {
  const state: PngState = {
    header: undefined,
    hasData: false,
    dataSequenceEnded: false,
    dataChunks: [],
  };
  let offset = pngSignature.length;
  while (offset + pngChunkOverhead <= view.byteLength) {
    const chunk = readPngChunk(view, offset);
    if (chunk === undefined || !processPngChunk(state, bytes, view, chunk)) {
      return;
    }
    if (chunk.type === pngEndChunk) {
      return {
        ...state,
        hasEnd: chunk.length === 0 && chunk.end === view.byteLength,
      };
    }
    offset = chunk.end;
  }
  return { ...state, hasEnd: false };
};

/** Validates the PNG structure and its decompressed scanline stream. */
export const isValidPng = async (bytes: Uint8Array): Promise<boolean> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < pngSignature.length + pngChunkOverhead) {
    return false;
  }
  if (!isPngSignature(view)) {
    return false;
  }
  const parsed = parsePngChunks(bytes, view);
  if (parsed === undefined || parsed.header === undefined || !parsed.hasData) {
    return false;
  }
  return (
    parsed.hasEnd &&
    (await isDecodablePngData(parsed.dataChunks, parsed.header))
  );
};
