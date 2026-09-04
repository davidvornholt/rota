import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import { IngestService } from './ingest.ts';

/**
 * The garments feature's runtime, in its own server-only module. The server
 * functions import it for their handlers, the upload and media routes for
 * theirs; nothing the browser keeps refers to it.
 */
export const garmentsRuntime = featureRuntime(
  'garments',
  () => IngestService.Default,
);
