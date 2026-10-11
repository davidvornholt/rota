import { describe, expect, it } from 'bun:test';
import { type Intake, intakeOf, type Transfer } from './photo-intake.ts';

const file = (name: string, type: string) => new File(['x'], name, { type });

const transfer = (
  files: ReadonlyArray<File>,
  data: Readonly<Record<string, string>> = {},
): Transfer => ({ files, getData: (format) => data[format] ?? '' });

const photo = file('shirt.jpg', 'image/jpeg');
const screenshot = file('pasted.png', 'image/png');
const notes = file('notes.pdf', 'application/pdf');

describe('intakeOf', () => {
  it('takes every picture and counts what it leaves out', () => {
    expect(intakeOf(transfer([photo, notes, screenshot]))).toEqual({
      kind: 'pictures',
      files: [photo, screenshot],
      skipped: 1,
    });
  });

  it('prefers the picture over text that came with it', () => {
    expect(
      intakeOf(
        transfer([screenshot], { 'text/plain': 'https://shop.test/shirt' }),
      ),
    ).toEqual({ kind: 'pictures', files: [screenshot], skipped: 0 });
  });

  it('says only pictures belong when no file is one', () => {
    expect(intakeOf(transfer([notes]))).toEqual({
      kind: 'refused',
      message:
        'Only pictures can be added to the wardrobe. Paste or drop a photo of the garment.',
    });
  });

  it('asks for the image itself when given a link to one', () => {
    const linkRefusal: Intake = {
      kind: 'refused',
      message:
        'That is a link to a picture, not the picture itself. Copy the image, then paste it here.',
    };
    expect(
      intakeOf(transfer([], { 'text/plain': ' https://shop.test/shirt.jpg ' })),
    ).toEqual(linkRefusal);
    expect(
      intakeOf(
        transfer([], {
          'text/uri-list': 'https://shop.test/shirt.jpg\nhttps://shop.test/b',
        }),
      ),
    ).toEqual(linkRefusal);
  });

  it('leaves other text alone', () => {
    expect(intakeOf(transfer([], { 'text/plain': 'Navy wool coat' }))).toEqual({
      kind: 'nothing',
    });
    expect(
      intakeOf(transfer([], { 'text/plain': 'see https://shop.test/shirt' })),
    ).toEqual({ kind: 'nothing' });
    expect(intakeOf(transfer([]))).toEqual({ kind: 'nothing' });
  });
});
