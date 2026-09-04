import { Data } from 'effect';

export class GeminiError extends Data.TaggedError('GeminiError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class StudioRenderError extends Data.TaggedError('StudioRenderError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/** The deployment turned the transparency parameter down; the render is asked for again without it. */
export class TransparencyRefusal extends Data.TaggedError(
  'TransparencyRefusal',
)<{ readonly body: string }> {}
