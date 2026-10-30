import { Layer } from 'effect';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';

/** The history feature's runtime, in its own server-only module. */
export const historyRuntime = featureRuntime('history', () => Layer.empty);
