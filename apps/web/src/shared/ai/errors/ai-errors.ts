import { Schema } from 'effect';

export class BedrockError extends Schema.TaggedError<BedrockError>()(
  'BedrockError',
  {
    reason: Schema.Literals(['request', 'timeout', 'answer']),
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class StudioRenderError extends Schema.TaggedError<StudioRenderError>()(
  'StudioRenderError',
  { message: Schema.String, cause: Schema.Defect() },
) {}

/** The deployment turned the transparency parameter down; the render is asked for again without it. */
export class TransparencyRefusal extends Schema.TaggedError<TransparencyRefusal>()(
  'TransparencyRefusal',
  { body: Schema.String },
) {}

export class StudioRateLimit extends Schema.TaggedError<StudioRateLimit>()(
  'StudioRateLimit',
  {
    message: Schema.String,
    retryAfter: Schema.NullOr(Schema.String),
    retryAfterSeconds: Schema.NullOr(Schema.String),
    cause: Schema.Defect(),
  },
) {}
