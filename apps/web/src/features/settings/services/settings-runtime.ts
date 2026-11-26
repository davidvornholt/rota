import { Layer } from 'effect';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';

/** The settings feature's runtime, shared by its server functions and its CLI API. */
export const settingsRuntime = featureRuntime('settings', () => Layer.empty);
