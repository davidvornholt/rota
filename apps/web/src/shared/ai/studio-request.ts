import { Duration, Effect, Schema } from 'effect';
import { imageDimensions } from '#/shared/media/image-dimensions.ts';
import {
  StudioRateLimit,
  StudioRenderError,
  TransparencyRefusal,
} from './errors/ai-errors.ts';

export type StudioRender = {
  readonly bytes: Uint8Array;
  readonly mime: 'image/png';
  readonly transparent: boolean;
};

export type StudioRenderInput = {
  readonly photo: Uint8Array;
  readonly mime: string;
  /** A short description of the garment, so the model knows what to keep. */
  readonly description: string;
};

/** 3:4 portrait; both edges multiples of 16, as GPT-Image-2 requires. */
export const studioRenderSize = { width: 1200, height: 1600 } as const;

/** The paper colour the studio ground takes when transparency is refused. */
const paperHex = '#FAFAFB';

const requestTimeoutMinutes = 4;
const requestTimeout = Duration.minutes(requestTimeoutMinutes);
const badRequest = 400;
const tooManyRequests = 429;
const trailingSlash = /\/$/u;
const errorBodyLimit = 500;
const transparencyTransparencyRefusal = /background|transparen/iu;
const base64Pattern =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/u;
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
const minimumImageDimension = 0;
const minimumImageDataLength = 0;
const crcPolynomial = 0xed_b8_83_20;
const crcInitial = 0xff_ff_ff_ff;
const crcFinalXor = 0xff_ff_ff_ff;
const crcBitsPerByte = 8;
const binaryRadix = 2;
const crcLowBit = 1;
const crcTableLength = 256;
const nextByte = 1;

const pngChunkType = (view: DataView, offset: number): string =>
  String.fromCharCode(
    ...Array.from({ length: pngChunkTypeLength }, (_, index) =>
      view.getUint8(offset + pngChunkTypeOffset + index),
    ),
  );

const xorByte = (left: number, right: number): number => {
  let result = 0;
  let leftPart = left;
  let rightPart = right;
  let place = nextByte;
  for (let bit = 0; bit < crcBitsPerByte; bit += nextByte) {
    if (leftPart % binaryRadix !== rightPart % binaryRadix) {
      result += place;
    }
    leftPart = Math.floor(leftPart / binaryRadix);
    rightPart = Math.floor(rightPart / binaryRadix);
    place *= binaryRadix;
  }
  return result;
};

const makeXorByteRow = (firstByte: number): Array<number> =>
  Array.from({ length: crcTableLength }, (_, secondByte) =>
    xorByte(firstByte, secondByte),
  );

const xorByteTable = Array.from({ length: crcTableLength }, (_, firstByte) =>
  makeXorByteRow(firstByte),
);

const xor32 = (left: number, right: number): number => {
  let result = 0;
  let leftPart = left;
  let rightPart = right;
  let place = nextByte;
  for (let byte = 0; byte < pngCrcBytes; byte += nextByte) {
    const leftByte = leftPart % crcTableLength;
    const rightByte = rightPart % crcTableLength;
    result += (xorByteTable[leftByte]?.[rightByte] ?? 0) * place;
    leftPart = Math.floor(leftPart / crcTableLength);
    rightPart = Math.floor(rightPart / crcTableLength);
    place *= crcTableLength;
  }
  return result;
};

const crcTable = Array.from({ length: crcTableLength }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < crcBitsPerByte; bit += nextByte) {
    const lowBit = crc % binaryRadix;
    crc = Math.floor(crc / binaryRadix);
    if (lowBit === crcLowBit) {
      crc = xor32(crc, crcPolynomial);
    }
  }
  return crc;
});

const crc32 = (view: DataView, start: number, end: number): number => {
  let crc = crcInitial;
  for (let index = start; index < end; index += nextByte) {
    const tableIndex = xor32(crc % crcTableLength, view.getUint8(index));
    crc = xor32(Math.floor(crc / crcTableLength), crcTable[tableIndex] ?? 0);
  }
  return xor32(crc, crcFinalXor);
};

const isValidPngChunk = (
  view: DataView,
  offset: number,
  end: number,
): boolean =>
  crc32(view, offset + pngChunkTypeOffset, end - pngCrcBytes) ===
  view.getUint32(end - pngCrcBytes);

const isPngSignature = (view: DataView): boolean =>
  pngSignature.every((byte, index) => view.getUint8(index) === byte);

const isPngHeaderChunk = (
  type: string,
  offset: number,
  length: number,
): boolean =>
  type === pngHeaderChunk &&
  offset === pngSignature.length &&
  length === pngHeaderChunkLength;

const isPngDataChunk = (type: string, length: number): boolean =>
  type === pngDataChunk && length > minimumImageDataLength;

const isDecodablePngData = async (
  chunks: ReadonlyArray<Uint8Array>,
): Promise<boolean> => {
  try {
    const stream = new Blob(chunks.map((chunk) => chunk as BlobPart)).stream();
    const decompressed = await new Response(
      stream.pipeThrough(new DecompressionStream('deflate')),
    ).arrayBuffer();
    return decompressed.byteLength > minimumImageDimension;
  } catch {
    return false;
  }
};

/** Provider output is only successful once its PNG chunk stream reaches IEND. */
const isCompletePng = async (bytes: Uint8Array): Promise<boolean> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < pngSignature.length + pngChunkOverhead) {
    return false;
  }
  if (!isPngSignature(view)) {
    return false;
  }
  let offset = pngSignature.length;
  let hasHeader = false;
  let hasData = false;
  let hasEnd = false;
  const dataChunks: Array<Uint8Array> = [];
  while (offset + pngChunkOverhead <= view.byteLength) {
    const length = view.getUint32(offset);
    const end = offset + pngChunkOverhead + length;
    if (end > view.byteLength) {
      return false;
    }
    if (!isValidPngChunk(view, offset, end)) {
      return false;
    }
    const type = pngChunkType(view, offset);
    if (isPngHeaderChunk(type, offset, length)) {
      hasHeader = true;
    }
    if (isPngDataChunk(type, length)) {
      hasData = true;
      dataChunks.push(
        bytes.subarray(offset + pngDataOffset, end - pngCrcBytes),
      );
    }
    if (type === pngEndChunk) {
      hasEnd = length === 0 && end === view.byteLength;
      break;
    }
    offset = end;
  }
  return (
    hasHeader && hasData && hasEnd && (await isDecodablePngData(dataChunks))
  );
};

const decodeImage = async (
  encoded: string | undefined,
): Promise<Uint8Array | undefined> => {
  if (
    encoded === undefined ||
    encoded.length === 0 ||
    !base64Pattern.test(encoded)
  ) {
    return;
  }
  const bytes = new Uint8Array(Buffer.from(encoded, 'base64'));
  const dimensions = imageDimensions(bytes);
  if (!(await isCompletePng(bytes)) || dimensions === undefined) {
    return;
  }
  if (
    dimensions.width <= minimumImageDimension ||
    dimensions.height <= minimumImageDimension
  ) {
    return;
  }
  return bytes;
};

const basePrompt = (description: string) =>
  [
    `A studio product photograph of exactly this garment: ${description}.`,
    'Lay it perfectly flat and neatly arranged, front view, centred, filling most of the frame with even margins.',
    'Orient the garment naturally upright in the portrait frame, regardless of the source photo orientation; rotate sideways or upside-down garments into this position.',
    'For tops and dresses, place the neckline at the top and the hem at the bottom; for trousers, shorts and skirts, place the waistband at the top and the leg openings or hem at the bottom.',
    'Preserve natural proportions, even when an upright garment is wider than it is tall; do not rotate it sideways to fill the frame.',
    "Smooth incidental wrinkles and storage folds for a neatly steamed appearance. Preserve intentional pleats, gathers, pressed creases, natural fabric texture, and the garment's shape.",
    'Soft, even studio lighting; no harsh shadows.',
    'Keep the original colour, pattern, texture, seams, buttons and proportions exactly as they are in the photo.',
    'No people, no mannequin, no hanger, no props, no text, no watermark.',
  ].join(' ');

type Attempt = {
  readonly transparent: boolean;
  readonly prompt: string;
};

export const attempts = (description: string): ReadonlyArray<Attempt> => [
  {
    transparent: true,
    prompt: `${basePrompt(description)} Fully transparent background.`,
  },
  {
    transparent: false,
    prompt: `${basePrompt(description)} Seamless, plain, perfectly uniform background in the colour ${paperHex}, edge to edge, with no gradient and no vignette.`,
  },
];

export type StudioConnection = {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly deployment: string;
};

/** The edit answer: one base64 image per requested picture, renamed off the wire. */
const EditResponse = Schema.Struct({
  data: Schema.optional(
    Schema.Array(
      Schema.Struct({
        image: Schema.optional(Schema.String).pipe(Schema.fromKey('b64_json')),
      }),
    ),
  ),
});
const decodeEditResponse = Schema.decodeUnknownSync(EditResponse);

const isTransparencyRefusal = (status: number, body: string): boolean =>
  status === badRequest && transparencyTransparencyRefusal.test(body);

export const requestEdit = (
  connection: StudioConnection,
  input: StudioRenderInput,
  attempt: Attempt,
): Effect.Effect<
  StudioRender,
  StudioRenderError | TransparencyRefusal | StudioRateLimit
> =>
  Effect.tryPromise({
    try: async (signal) => {
      const form = new FormData();
      form.append('model', connection.deployment);
      form.append('prompt', attempt.prompt);
      form.append(
        'image',
        new Blob([input.photo as BlobPart], { type: input.mime }),
        input.mime === 'image/png' ? 'garment.png' : 'garment.jpg',
      );
      form.append('n', '1');
      form.append(
        'size',
        `${studioRenderSize.width}x${studioRenderSize.height}`,
      );
      form.append('quality', 'high');
      form.append('input_fidelity', 'high');
      form.append('output_format', 'png');
      if (attempt.transparent) {
        form.append('background', 'transparent');
      }
      const response = await fetch(
        `${connection.endpoint.replace(trailingSlash, '')}/openai/v1/images/edits?api-version=preview`,
        {
          method: 'POST',
          signal,
          headers: { 'api-key': connection.apiKey },
          body: form,
        },
      );
      const body = await response.text();
      if (response.status === tooManyRequests) {
        return new StudioRateLimit({
          message:
            'The image service is busy. Try the studio picture again later.',
          retryAfter: response.headers.get('retry-after-ms'),
          retryAfterSeconds: response.headers.get('retry-after'),
          cause: body.slice(0, errorBodyLimit),
        });
      }
      if (!response.ok) {
        if (
          attempt.transparent &&
          isTransparencyRefusal(response.status, body)
        ) {
          return new TransparencyRefusal({ body });
        }
        return new StudioRenderError({
          message: 'The studio picture could not be made. Try again later.',
          cause: `Foundry answered ${response.status}: ${body.slice(0, errorBodyLimit)}`,
        });
      }
      const parsed = decodeEditResponse(JSON.parse(body));
      const bytes = await decodeImage(parsed.data?.[0]?.image);
      if (bytes === undefined) {
        return new StudioRenderError({
          message:
            'The image service returned an unreadable picture. Try again.',
          cause: undefined,
        });
      }
      return {
        bytes,
        mime: 'image/png' as const,
        transparent: attempt.transparent,
      };
    },
    catch: (cause) =>
      new StudioRenderError({
        message: 'The studio picture could not be made. Try again later.',
        cause,
      }),
  }).pipe(
    Effect.flatMap((result) =>
      result instanceof TransparencyRefusal ||
      result instanceof StudioRateLimit ||
      result instanceof StudioRenderError
        ? Effect.fail(result)
        : Effect.succeed(result),
    ),
    Effect.timeoutFail({
      duration: requestTimeout,
      onTimeout: () =>
        new StudioRenderError({
          message: 'The studio render timed out.',
          cause: undefined,
        }),
    }),
  );
