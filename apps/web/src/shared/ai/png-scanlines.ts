const pngBitsPerByte = 8;
const pngFilterByteLength = 1;
const maximumPngFilter = 4;
const noInterlace = 0;
const grayscaleColorType = 0;
const trueColorColorType = 2;
const indexedColorType = 3;
const grayscaleAlphaColorType = 4;
const trueColorAlphaColorType = 6;
const grayscaleChannels = 1;
const trueColorChannels = 3;
const grayscaleAlphaChannels = 2;
const trueColorAlphaChannels = 4;
const oneBitDepth = 1;
const twoBitDepth = 2;
const fourBitDepth = 4;
const eightBitDepth = 8;
const sixteenBitDepth = 16;
const adam7FirstPass = 0;
const adam7SecondPassXStart = 4;
const adam7ThirdPassYStart = 4;
const adam7FourthPassXStart = 2;
const adam7FifthPassYStart = 2;
const adam7SixthPassXStart = 1;
const adam7StepOne = 1;
const adam7StepTwo = 2;
const adam7StepFour = 4;
const adam7StepEight = 8;
const nextByte = 1;

export type PngScanlineHeader = {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly interlaceMethod: number;
};

type PngPass = {
  readonly xStart: number;
  readonly yStart: number;
  readonly xStep: number;
  readonly yStep: number;
};

type PngScanlineDimensions = {
  readonly width: number;
  readonly height: number;
};

const adam7Passes: ReadonlyArray<PngPass> = [
  {
    xStart: adam7FirstPass,
    yStart: adam7FirstPass,
    xStep: adam7StepEight,
    yStep: adam7StepEight,
  },
  {
    xStart: adam7SecondPassXStart,
    yStart: adam7FirstPass,
    xStep: adam7StepEight,
    yStep: adam7StepEight,
  },
  {
    xStart: adam7FirstPass,
    yStart: adam7ThirdPassYStart,
    xStep: adam7StepFour,
    yStep: adam7StepEight,
  },
  {
    xStart: adam7FourthPassXStart,
    yStart: adam7FirstPass,
    xStep: adam7StepFour,
    yStep: adam7StepFour,
  },
  {
    xStart: adam7FirstPass,
    yStart: adam7FifthPassYStart,
    xStep: adam7StepTwo,
    yStep: adam7StepFour,
  },
  {
    xStart: adam7SixthPassXStart,
    yStart: adam7FirstPass,
    xStep: adam7StepTwo,
    yStep: adam7StepTwo,
  },
  {
    xStart: adam7FirstPass,
    yStart: adam7FirstPass + adam7SixthPassXStart,
    xStep: adam7StepOne,
    yStep: adam7StepTwo,
  },
];

const channelsByColorType = new Map([
  [grayscaleColorType, grayscaleChannels],
  [trueColorColorType, trueColorChannels],
  [indexedColorType, grayscaleChannels],
  [grayscaleAlphaColorType, grayscaleAlphaChannels],
  [trueColorAlphaColorType, trueColorAlphaChannels],
]);

const bitDepthsByColorType = new Map([
  [
    grayscaleColorType,
    new Set([
      oneBitDepth,
      twoBitDepth,
      fourBitDepth,
      eightBitDepth,
      sixteenBitDepth,
    ]),
  ],
  [trueColorColorType, new Set([eightBitDepth, sixteenBitDepth])],
  [
    indexedColorType,
    new Set([oneBitDepth, twoBitDepth, fourBitDepth, eightBitDepth]),
  ],
  [grayscaleAlphaColorType, new Set([eightBitDepth, sixteenBitDepth])],
  [trueColorAlphaColorType, new Set([eightBitDepth, sixteenBitDepth])],
]);

export const isValidPngScanlineHeader = (
  header: PngScanlineHeader,
): boolean => {
  const channels = channelsByColorType.get(header.colorType);
  const bitDepths = bitDepthsByColorType.get(header.colorType);
  return (
    header.width > 0 &&
    header.height > 0 &&
    channels !== undefined &&
    bitDepths?.has(header.bitDepth) === true &&
    header.interlaceMethod >= noInterlace &&
    header.interlaceMethod <= adam7StepOne
  );
};

const passExtent = (size: number, start: number, step: number): number =>
  size <= start ? 0 : Math.floor((size - start - 1) / step) + 1;

const scanlineLength = (width: number, bitsPerPixel: number): number =>
  pngFilterByteLength + Math.ceil((width * bitsPerPixel) / pngBitsPerByte);

const validatePassScanlines = (
  data: Uint8Array,
  offset: number,
  { width, height }: PngScanlineDimensions,
  bitsPerPixel: number,
): number | undefined => {
  if (width === 0 || height === 0) {
    return offset;
  }
  const rowLength = scanlineLength(width, bitsPerPixel);
  const remaining = data.byteLength - offset;
  if (rowLength > remaining || height > Math.floor(remaining / rowLength)) {
    return;
  }
  const passLength = rowLength * height;
  for (let row = 0; row < height; row += nextByte) {
    const filter = data[offset + row * rowLength];
    if (filter === undefined || filter > maximumPngFilter) {
      return;
    }
  }
  return offset + passLength;
};

/** Checks that the inflated PNG bytes contain every scanline the header describes. */
export const validatePngScanlines = (
  data: Uint8Array,
  header: PngScanlineHeader,
): boolean => {
  const channels = channelsByColorType.get(header.colorType);
  if (channels === undefined) {
    return false;
  }
  const bitsPerPixel = channels * header.bitDepth;
  const passes =
    header.interlaceMethod === noInterlace
      ? [
          {
            xStart: adam7FirstPass,
            yStart: adam7FirstPass,
            xStep: adam7StepOne,
            yStep: adam7StepOne,
          },
        ]
      : adam7Passes;
  let offset = 0;
  for (const pass of passes) {
    const width = passExtent(header.width, pass.xStart, pass.xStep);
    const height = passExtent(header.height, pass.yStart, pass.yStep);
    const nextOffset = validatePassScanlines(
      data,
      offset,
      { width, height },
      bitsPerPixel,
    );
    if (nextOffset === undefined) {
      return false;
    }
    offset = nextOffset;
  }
  return offset === data.byteLength;
};
