import { expect, it } from 'bun:test';
import { structuredOutputProblems } from '#/shared/ai/structured-output-test-support.ts';
import { extractionJsonSchema } from './extraction.ts';
import { photoOrientationJsonSchema } from './photo-orientation.ts';

it.each([
  ['garment analysis', extractionJsonSchema],
  ['photo orientation', photoOrientationJsonSchema],
])('the %s schema keeps to the structured-output subset', (_name, schema) => {
  expect(structuredOutputProblems(schema)).toEqual([]);
});
