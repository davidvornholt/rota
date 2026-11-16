import { describe, expect, it } from 'bun:test';
import { createSubmissionIds } from './submission-ids.ts';

const counter = () => {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
};

describe('createSubmissionIds', () => {
  it('keeps the ID while the values stay the same', () => {
    const ids = createSubmissionIds(counter());
    expect(ids.idFor({ name: 'Anna' })).toBe('id-1');
    expect(ids.idFor({ name: 'Anna' })).toBe('id-1');
  });

  it('chooses a new ID when a value changed', () => {
    const ids = createSubmissionIds(counter());
    expect(ids.idFor({ name: 'Anna' })).toBe('id-1');
    expect(ids.idFor({ name: 'Anne' })).toBe('id-2');
  });

  it('does not go back to an earlier ID after a change and a change back', () => {
    const ids = createSubmissionIds(counter());
    ids.idFor({ name: 'Anna' });
    ids.idFor({ name: 'Anne' });
    expect(ids.idFor({ name: 'Anna' })).toBe('id-3');
  });

  it('chooses a new ID for identical values after a success', () => {
    const ids = createSubmissionIds(counter());
    expect(ids.idFor({ name: 'Anna' })).toBe('id-1');
    ids.settle();
    expect(ids.idFor({ name: 'Anna' })).toBe('id-2');
  });
});
