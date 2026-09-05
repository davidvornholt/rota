const pngCrcBytes = 4;
const crcPolynomial = 0xed_b8_83_20;
const crcInitial = 0xff_ff_ff_ff;
const crcFinalXor = 0xff_ff_ff_ff;
const crcBitsPerByte = 8;
const binaryRadix = 2;
const crcLowBit = 1;
const crcTableLength = 256;
const nextByte = 1;

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

/** Computes the PNG CRC for a chunk type and data range. */
export const pngCrc32 = (
  view: DataView,
  start: number,
  end: number,
): number => {
  let crc = crcInitial;
  for (let index = start; index < end; index += nextByte) {
    const tableIndex = xor32(crc % crcTableLength, view.getUint8(index));
    crc = xor32(Math.floor(crc / crcTableLength), crcTable[tableIndex] ?? 0);
  }
  return xor32(crc, crcFinalXor);
};
