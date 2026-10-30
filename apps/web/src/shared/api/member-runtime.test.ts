import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { notFound } from '#/shared/data/errors/data-errors.ts';
import { apiFailure } from './member-runtime.ts';

class Conflict extends Schema.TaggedError<Conflict>()('Conflict', {
  message: Schema.String,
  httpStatus: Schema.Number,
}) {}

describe('the failure an API client sees', () => {
  it('keeps the message of a not-found', () => {
    const failure = apiFailure(notFound('The outfit'));
    expect(failure._tag).toBe('NotFound');
    expect(failure.message).toBe('The outfit was not found.');
  });

  it('keeps the message of another client error', () => {
    const failure = apiFailure(
      new Conflict({ message: 'Choose today or tomorrow.', httpStatus: 409 }),
    );
    expect(failure._tag).toBe('Rejected');
    expect(failure.message).toBe('Choose today or tomorrow.');
  });

  it('hides a server failure behind a generic message', () => {
    for (const error of [
      new Error('connection refused at 10.0.0.4'),
      new Conflict({ message: 'Bedrock said no', httpStatus: 503 }),
    ]) {
      const failure = apiFailure(error);
      expect(failure._tag).toBe('ServerError');
      expect(failure.message).toBe('The request could not be completed.');
    }
  });
});
