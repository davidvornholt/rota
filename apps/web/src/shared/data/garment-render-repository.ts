import type { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';

import { notFound, writeError } from './errors/data-errors.ts';
import type { GarmentImage } from './garment.ts';
import type { ImageChoice } from './garment-types.ts';

const writeGarment = writeError('The garment');

export type StoredImage = GarmentImage & { readonly bytes: number };

const RenderIdFromRow = Schema.Struct({
  studioRenderId: Schema.propertySignature(Schema.UUID).pipe(
    Schema.fromKey('studio_render_id'),
  ),
});
const decodeRenderIds = Schema.decodeUnknown(Schema.Array(RenderIdFromRow));

const beginStudioRender = (
  sql: SqlClient.SqlClient,
  id: string,
  renderId: string,
) =>
  sql`
    update garment
    set studio_render_id = ${renderId},
        processing_error = null,
        updated_at = now()
    where id = ${id}
    returning studio_render_id
  `.pipe(
    Effect.flatMap(decodeRenderIds),
    Effect.mapError(writeGarment),
    Effect.flatMap((rows) => {
      const [row] = rows;
      return row === undefined
        ? Effect.fail(notFound('The garment'))
        : Effect.succeed(row.studioRenderId);
    }),
  );

const claimInitialStudioRender = (
  sql: SqlClient.SqlClient,
  id: string,
  renderId: string,
) =>
  sql`
    update garment
    set studio_render_id = ${renderId},
        processing_error = null,
        updated_at = now()
    where id = ${id}
      and studio_render_id is null
      and studio_render_completed_id is null
    returning studio_render_id
  `.pipe(
    Effect.flatMap(decodeRenderIds),
    Effect.mapError(writeGarment),
    Effect.map((rows) => rows[0]?.studioRenderId),
  );

type AttachStudioImageInput = {
  readonly garmentId: string;
  readonly renderId: string;
  readonly image: StoredImage;
  readonly selectStudio: boolean;
  readonly expectedChoice: ImageChoice;
};

const attachStudioImage = (
  sql: SqlClient.SqlClient,
  {
    garmentId,
    renderId,
    image,
    selectStudio,
    expectedChoice,
  }: AttachStudioImageInput,
) =>
  sql`
    with current as (
      select id
      from garment
      where id = ${garmentId} and studio_render_id = ${renderId}
      for update
    ), stored as (
      insert into garment_image (garment_id, kind, storage_key, mime, width, height, bytes)
      select current.id, 'studio', ${image.key}, ${image.mime}, ${image.width}, ${image.height}, ${image.bytes}
      from current
      on conflict (garment_id, kind) do update
        set storage_key = excluded.storage_key, mime = excluded.mime,
            width = excluded.width, height = excluded.height,
            bytes = excluded.bytes, created_at = now()
      returning garment_id
    )
    update garment
    set studio_render_completed_id = ${renderId},
        image_choice = case
          when ${selectStudio} and image_choice = ${expectedChoice}
            then 'studio'::garment_image_choice
          else image_choice
        end,
        updated_at = now()
    from stored
    where garment.id = stored.garment_id
    returning garment.id
  `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

const markStudioRenderError = (
  sql: SqlClient.SqlClient,
  id: string,
  renderId: string,
  message: string,
) =>
  sql`
    update garment
    set processing_error = ${message}, status = 'review', updated_at = now()
    where id = ${id} and studio_render_id = ${renderId}
  `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

export const makeGarmentRenderRepository = (sql: SqlClient.SqlClient) => ({
  beginStudioRender: (id: string, renderId: string) =>
    beginStudioRender(sql, id, renderId),
  claimInitialStudioRender: (id: string, renderId: string) =>
    claimInitialStudioRender(sql, id, renderId),
  attachStudioImage: (input: AttachStudioImageInput) =>
    attachStudioImage(sql, input),
  markStudioRenderError: (id: string, renderId: string, message: string) =>
    markStudioRenderError(sql, id, renderId, message),
});
