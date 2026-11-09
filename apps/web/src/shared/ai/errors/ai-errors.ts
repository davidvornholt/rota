import { Schema } from 'effect';

/**
 * A failed Claude request. `configuration` means the API rejected Rota's key or
 * its permissions, which another attempt cannot fix.
 */
export class ClaudeError extends Schema.TaggedError<ClaudeError>()(
  'ClaudeError',
  {
    reason: Schema.Literals(['configuration', 'request', 'timeout', 'answer']),
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

/**
 * The image service failed in a way that usually passes on its own: a 500,
 * 502, 503 or 504, or a connection that broke before any answer arrived.
 */
export class StudioTransientFailure extends Schema.TaggedError<StudioTransientFailure>()(
  'StudioTransientFailure',
  {
    message: Schema.String,
    retryAfter: Schema.NullOr(Schema.String),
    retryAfterSeconds: Schema.NullOr(Schema.String),
    cause: Schema.Defect(),
  },
) {}

/** An image request got no answer because the connection failed, not because Rota cancelled it. */
export class ImageConnectionFailed extends Schema.TaggedError<ImageConnectionFailed>()(
  'ImageConnectionFailed',
  { cause: Schema.Defect() },
) {}

/** An outfit collage could not be made; the message is what the collage shows. */
export class CollageError extends Schema.TaggedError<CollageError>()(
  'CollageError',
  { message: Schema.String, cause: Schema.Defect() },
) {}
