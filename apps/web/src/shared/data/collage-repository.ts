import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { readError, writeError } from './errors/data-errors.ts';

/** A saved collage, or a durable marker for an unfinished or failed attempt. */
export type StoredCollage =
  | {
      readonly status: 'ready';
      readonly key: string;
      readonly width: number;
      readonly height: number;
    }
  | { readonly status: 'failed'; readonly message: string };

const CollageRow = Schema.Struct({
  key: Schema.NullOr(Schema.String),
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  error: Schema.NullOr(Schema.String),
});

const decodeRows = Schema.decodeUnknownEffect(Schema.Array(CollageRow));

const read = readError('The outfit picture');
const write = writeError('The outfit picture');

const storedCollage = (
  row: Schema.Schema.Type<typeof CollageRow>,
): StoredCollage | undefined => {
  if (row.key !== null && row.width !== null && row.height !== null) {
    return {
      status: 'ready',
      key: row.key,
      width: row.width,
      height: row.height,
    };
  }
  return row.error === null
    ? undefined
    : { status: 'failed', message: row.error };
};

export class CollageRepository extends Context.Service<CollageRepository>()(
  'shared/CollageRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      /** `pieces` is the key `piecesKey` gives the outfit's garments and their pictures. */
      const find = (pieces: string) =>
        sql`
          select storage_key as "key", width, height, error from outfit_collage
          where owner_id = ${owner.id} and pieces = ${pieces}
        `.pipe(
          Effect.flatMap(decodeRows),
          Effect.map((rows) =>
            rows[0] === undefined ? undefined : storedCollage(rows[0]),
          ),
          Effect.mapError(read),
        );

      const saveReady = (
        pieces: string,
        picture: {
          readonly key: string;
          readonly width: number;
          readonly height: number;
        },
      ) =>
        sql`
          insert into outfit_collage (owner_id, pieces, storage_key, width, height, error)
          values (${owner.id}, ${pieces}, ${picture.key}, ${picture.width}, ${picture.height}, null)
          on conflict (owner_id, pieces) do update
            set storage_key = excluded.storage_key, width = excluded.width,
                height = excluded.height, error = null, updated_at = now()
        `.pipe(Effect.asVoid, Effect.mapError(write));

      /** Record the attempt before dispatch; only an explicit retry can claim an existing failure. */
      const claimAttempt = (pieces: string, message: string, retry: boolean) =>
        sql`
          insert into outfit_collage (owner_id, pieces, error)
          values (${owner.id}, ${pieces}, ${message})
          on conflict (owner_id, pieces) do update
            set error = excluded.error, updated_at = now()
            where ${retry} and outfit_collage.storage_key is null
          returning pieces
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError(write),
        );

      /** A failure never replaces a picture that was made in the meantime. */
      const saveFailed = (pieces: string, message: string) =>
        sql`
          insert into outfit_collage (owner_id, pieces, error)
          values (${owner.id}, ${pieces}, ${message})
          on conflict (owner_id, pieces) do update
            set error = excluded.error, updated_at = now()
            where outfit_collage.storage_key is null
        `.pipe(Effect.asVoid, Effect.mapError(write));

      return { find, claimAttempt, saveReady, saveFailed };
    }),
  },
) {
  static readonly layer = Layer.effect(
    CollageRepository,
    CollageRepository.make,
  );
}
