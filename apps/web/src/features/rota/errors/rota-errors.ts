import { Data } from 'effect';

import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';

/** Every failure here carries a status so its message reaches the wearer. */

export class LocationMissingError extends Data.TaggedError(
  'LocationMissingError',
)<{ readonly message: string; readonly httpStatus: 409 }> {
  constructor() {
    super({
      message:
        'Pick the place you dress for in settings; the forecast decides what Rota proposes.',
      httpStatus: 409,
    });
  }
}

export class ForecastUnavailableError extends Data.TaggedError(
  'ForecastUnavailableError',
)<{
  readonly message: string;
  readonly httpStatus: 503;
  readonly cause: unknown;
}> {
  constructor(cause: unknown) {
    super({
      message:
        'The forecast could not be fetched and there is none stored for today. Try again in a few minutes.',
      httpStatus: 503,
      cause,
    });
  }
}

export class SlotEmptyError extends Data.TaggedError('SlotEmptyError')<{
  readonly message: string;
  readonly httpStatus: 409;
  readonly slot: Slot;
}> {
  constructor(slot: Slot) {
    super({
      message: `Nothing in the wardrobe can fill the ${slotLabel[slot].toLowerCase()} slot today. Add a garment for it, or bring one back from retired.`,
      httpStatus: 409,
      slot,
    });
  }
}

export class ProposalStateError extends Data.TaggedError('ProposalStateError')<{
  readonly message: string;
  readonly httpStatus: 409;
}> {
  constructor(message: string) {
    super({ message, httpStatus: 409 });
  }
}

export class ProposalAnswerError extends Data.TaggedError(
  'ProposalAnswerError',
)<{
  readonly message: string;
  readonly httpStatus: 424;
  readonly cause: unknown;
}> {
  constructor(cause: unknown) {
    super({
      message:
        "The model's answer could not be used. Ask for another suggestion.",
      httpStatus: 424,
      cause,
    });
  }
}
