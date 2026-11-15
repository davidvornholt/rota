// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';

const photo = {
  key: 'creation-check.png',
  mime: 'image/png',
  width: 1,
  height: 1,
  bytes: 67,
};

/** Fail the photo insert after the garment insert, as a dropped connection or a serialization failure would. */
export const verifyGarmentCreation = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const garments = yield* GarmentRepository;
  const before = (yield* garments.list()).length;
  yield* sql`create function fail_photo_write() returns trigger language plpgsql as $$
    begin raise exception 'Injected photo write failure' using errcode = '40001'; end;
  $$`;
  yield* sql`create trigger fail_photo_write before insert on garment_image
    for each row execute function fail_photo_write()`;
  const result = yield* Effect.result(garments.create(photo)).pipe(
    Effect.ensuring(
      sql`drop trigger fail_photo_write on garment_image`.pipe(
        Effect.andThen(sql`drop function fail_photo_write()`),
        Effect.orDie,
      ),
    ),
  );
  assert.equal(result._tag, 'Failure');
  assert.equal(
    (yield* garments.list()).length,
    before,
    'A garment whose photo could not be stored is not left behind as a blank processing card.',
  );
});
