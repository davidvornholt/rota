// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { SqlClient } from 'effect/sql';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';

const firstUpload = '6f1d0f56-2d3c-4b9e-8a64-0c2f6a1b7e01';
const secondUpload = '6f1d0f56-2d3c-4b9e-8a64-0c2f6a1b7e02';
const photo = {
  key: 'creation-check.png',
  mime: 'image/png',
  width: 1,
  height: 1,
  bytes: 67,
};

/**
 * Garment creation is atomic and idempotent per upload id. The first part
 * fails the photo insert after the garment insert, as a dropped connection or
 * a serialization failure would.
 */
export const verifyGarmentCreation = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const garments = yield* GarmentRepository;
  const before = (yield* garments.list()).length;
  yield* sql`create function fail_photo_write() returns trigger language plpgsql as $$
    begin raise exception 'Injected photo write failure' using errcode = '40001'; end;
  $$`;
  yield* sql`create trigger fail_photo_write before insert on garment_image
    for each row execute function fail_photo_write()`;
  const result = yield* Effect.result(garments.create(photo, firstUpload)).pipe(
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
  const first = yield* garments.create(photo, firstUpload);
  const retry = yield* garments.create(photo, firstUpload);
  assert.equal(first.status, 'processing');
  assert.deepEqual(
    retry,
    first,
    'Sending a photo again with its upload id answers with the garment the first try opened.',
  );
  const second = yield* garments.create(photo, secondUpload);
  assert.notEqual(
    second.id,
    first.id,
    'A second photo with its own upload id opens its own garment, even when it looks identical.',
  );
  assert.equal(
    (yield* garments.list()).length,
    before + 2,
    'Two upload ids open exactly two garments.',
  );
  const images = yield* sql`
    select count(*)::int as count from garment_image where garment_id = ${first.id}
  `;
  assert.equal(images[0]?.count, 1, 'A retry adds no second image row.');
});
