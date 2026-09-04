import { Data } from 'effect';

export class WeatherError extends Data.TaggedError('WeatherError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}
