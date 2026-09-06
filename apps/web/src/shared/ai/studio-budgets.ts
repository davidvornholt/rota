import { Duration } from 'effect';

export const studioQueueTimeout = Duration.minutes(10);
export const studioRenderTimeout = Duration.minutes(10);
// Leave two minutes for preparation and storage outside the scheduler.
export const studioJobTimeout = Duration.sum(
  Duration.sum(studioQueueTimeout, studioRenderTimeout),
  Duration.minutes(2),
);
export const studioErrorTimeoutSeconds = 30;
export const studioErrorTimeout = Duration.seconds(studioErrorTimeoutSeconds);
// Poll past the job, the error clear that precedes it, and the write that records a failure.
export const studioPollTimeout = Duration.sum(
  Duration.sum(
    studioJobTimeout,
    Duration.sum(studioErrorTimeout, studioErrorTimeout),
  ),
  Duration.minutes(1),
);
