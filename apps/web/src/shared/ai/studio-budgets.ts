import { Duration } from 'effect';

export const studioQueueTimeout = Duration.minutes(10);
export const studioRenderTimeout = Duration.minutes(10);
// Leave two minutes for preparation and storage outside the scheduler.
export const studioJobTimeout = Duration.sum(
  Duration.sum(studioQueueTimeout, studioRenderTimeout),
  Duration.minutes(2),
);
export const studioPollTimeout = Duration.sum(
  studioJobTimeout,
  Duration.minutes(1),
);
