import { expect, it } from 'bun:test';
import { jsonAnswer } from './json-answer.ts';

it.each([
  [
    'a bare JSON answer',
    ' {"rotationClockwise":90}\n',
    '{"rotationClockwise":90}',
  ],
  [
    'reasoning followed by JSON',
    'The neckline is at the left side of the image. The schema says a neckline at the left needs a 90° clockwise rotation.\n\n{"rotationClockwise":90}',
    '{"rotationClockwise":90}',
  ],
  [
    'a fenced json block',
    'Here is the answer:\n```json\n{"rotationClockwise":180}\n```\nThe waistband was at the bottom.',
    '{"rotationClockwise":180}',
  ],
  [
    'a bare fence',
    '```\n{"rotationClockwise":270}\n```',
    '{"rotationClockwise":270}',
  ],
  [
    'a stray brace before the JSON',
    'The collar {or what looks like one is at the top.\n{"rotationClockwise":0}',
    '{"rotationClockwise":0}',
  ],
  [
    'a nested object after an earlier object',
    'Draft: {"a":1}. Final: {"outer":{"inner":[1,2]},"text":"a } and a {"}',
    '{"outer":{"inner":[1,2]},"text":"a } and a {"}',
  ],
  [
    'a fence without JSON before JSON in prose',
    '```\nnot json\n```\n{"rotationClockwise":90}',
    '{"rotationClockwise":90}',
  ],
])('finds the JSON in %s', (_case, text, expected) => {
  expect(jsonAnswer(text)).toBe(expected);
});

it('returns the trimmed text when it holds no JSON object', () => {
  expect(jsonAnswer('  The garment {is upright.  ')).toBe(
    'The garment {is upright.',
  );
});
