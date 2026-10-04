import { Schema } from 'effect';

export class WeatherError extends Schema.TaggedError<WeatherError>()(
  'WeatherError',
  { message: Schema.String, cause: Schema.Defect() },
) {}
