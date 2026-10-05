import { Schema } from 'effect';

import { SlotSchema } from '#/shared/data/garment.ts';
import { type Slot, slotLabel } from '#/shared/data/garment-types.ts';

/** Every failure here carries a status so its message reaches the wearer. */
const conflict = 409;
const failedDependency = 424;
const serviceUnavailable = 503;

export class LocationMissingError extends Schema.TaggedError<LocationMissingError>()(
  'LocationMissingError',
  { message: Schema.String, httpStatus: Schema.Literal(conflict) },
) {
  constructor() {
    super({
      message:
        'Pick the place you dress for in settings; the forecast decides what Rota proposes.',
      httpStatus: conflict,
    });
  }
}

export class ForecastUnavailableError extends Schema.TaggedError<ForecastUnavailableError>()(
  'ForecastUnavailableError',
  {
    message: Schema.String,
    httpStatus: Schema.Literal(serviceUnavailable),
    cause: Schema.Defect(),
  },
) {
  constructor(cause: unknown) {
    super({
      message:
        'The forecast could not be fetched and there is none stored for today. Try again in a few minutes.',
      httpStatus: serviceUnavailable,
      cause,
    });
  }
}

export class SlotEmptyError extends Schema.TaggedError<SlotEmptyError>()(
  'SlotEmptyError',
  {
    message: Schema.String,
    httpStatus: Schema.Literal(conflict),
    slot: SlotSchema,
  },
) {
  constructor(slot: Slot) {
    super({
      message: `No available ${slotLabel[slot].toLowerCase()} fits this day. Check Laundry or choose a piece yourself.`,
      httpStatus: conflict,
      slot,
    });
  }
}

export class ProposalStateError extends Schema.TaggedError<ProposalStateError>()(
  'ProposalStateError',
  { message: Schema.String, httpStatus: Schema.Literal(conflict) },
) {
  constructor(message: string) {
    super({ message, httpStatus: conflict });
  }
}

export class ProposalAnswerError extends Schema.TaggedError<ProposalAnswerError>()(
  'ProposalAnswerError',
  {
    message: Schema.String,
    httpStatus: Schema.Literal(failedDependency),
    cause: Schema.Defect(),
  },
) {
  constructor(cause: unknown) {
    super({
      message:
        "The model's answer could not be used. Pick again to ask once more.",
      httpStatus: failedDependency,
      cause,
    });
  }
}

export class ProposalGenerationError extends Schema.TaggedError<ProposalGenerationError>()(
  'ProposalGenerationError',
  {
    message: Schema.String,
    httpStatus: Schema.Literal(failedDependency),
    cause: Schema.Defect(),
  },
) {
  constructor(timedOut: boolean, cause: unknown) {
    super({
      message: timedOut
        ? 'Choosing an outfit timed out. Please try again.'
        : 'Rota could not choose an outfit. Please try again.',
      httpStatus: failedDependency,
      cause,
    });
  }
}
