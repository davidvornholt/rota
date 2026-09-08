import { Duration } from 'effect';

export const studioRenderTimeout = Duration.minutes(10);
export const studioPersistenceTimeout = Duration.minutes(2);
const pollRequestTimeoutSeconds = 30;
export const studioPollRequestTimeout = Duration.seconds(
  pollRequestTimeoutSeconds,
);
