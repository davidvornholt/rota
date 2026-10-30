import { Layer } from 'effect';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';

export const historyRuntime = featureRuntime('history', () => Layer.empty);
