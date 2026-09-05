import { SqlClient, type Statement } from '@effect/sql';
import { Effect, Schema } from 'effect';

import type { LocalDate } from '#/shared/time/local-date.ts';
import { notFound, readError, writeError } from './errors/data-errors.ts';
import { GarmentFromRow } from './garment.ts';
import {
  makeGarmentRenderRepository,
  type StoredImage,
} from './garment-render-repository.ts';
import type {
  GarmentColor,
  GarmentStatus,
  ImageChoice,
  Slot,
} from './garment-types.ts';

const decodeGarments = Schema.decodeUnknown(Schema.Array(GarmentFromRow));

export type GarmentAttributes = {
  readonly name: string;
  readonly category: string;
  readonly subcategory: string;
  readonly slots: ReadonlyArray<Slot>;
  readonly warmth: number;
  readonly rainOk: boolean;
  readonly formality: number;
  readonly wearBudget: number | null;
  readonly colors: ReadonlyArray<GarmentColor>;
  readonly pattern: string;
  readonly material: string;
  readonly fit: string;
  readonly sleeve: string;
  readonly brand: string;
  readonly seasons: ReadonlyArray<string>;
  readonly notes: string;
  readonly price: number | null;
  readonly purchasedOn: LocalDate | null;
};

export type { StoredImage } from './garment-render-repository.ts';

const readGarments = readError('The wardrobe');
const writeGarment = writeError('The garment');

export class GarmentRepository extends Effect.Service<GarmentRepository>()(
  'shared/GarmentRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      /**
       * The two stored images folded into one JSON object keyed by kind, so
       * the row already has the `images` shape the schema decodes. A missing
       * image is simply an absent key.
       */
      const imagesJson = sql`
        (select coalesce(json_object_agg(
           i.kind,
           json_build_object('key', i.storage_key, 'mime', i.mime,
                             'width', i.width, 'height', i.height)), '{}'::json)
         from garment_image i
         where i.garment_id = g.id)
      `;

      const selectGarments = (where: Statement.Fragment) => sql`
        select g.id, g.status, g.name, g.category, g.subcategory,
               array_to_json(g.slots) as slots,
               g.warmth, g.rain_ok, g.formality, g.wear_budget, g.colors,
               g.pattern, g.material, g.fit, g.sleeve, g.brand, g.seasons,
               g.notes, g.price, g.purchased_on, g.image_choice,
               g.processing_error, g.studio_render_id,
               g.studio_render_completed_id, g.retired_at, g.created_at,
               ${imagesJson} as images
        from garment g
        ${where}
        order by g.created_at desc
      `;

      const query = (where: Statement.Fragment) =>
        selectGarments(where).pipe(
          Effect.flatMap(decodeGarments),
          Effect.mapError(readGarments),
        );

      const list = () => query(sql``);

      const byId = (id: string) =>
        query(sql`where g.id = ${id}`).pipe(
          Effect.flatMap((rows) => {
            const [garment] = rows;
            return garment === undefined
              ? Effect.fail(notFound('The garment'))
              : Effect.succeed(garment);
          }),
        );

      const attachImage = (
        garmentId: string,
        kind: 'original' | 'studio',
        image: StoredImage,
      ) =>
        sql`
          insert into garment_image (garment_id, kind, storage_key, mime, width, height, bytes)
          values (${garmentId}, ${kind}, ${image.key}, ${image.mime}, ${image.width}, ${image.height}, ${image.bytes})
          on conflict (garment_id, kind) do update
            set storage_key = excluded.storage_key, mime = excluded.mime,
                width = excluded.width, height = excluded.height,
                bytes = excluded.bytes, created_at = now()
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      /** A new garment enters as `processing`, with only its photo known. */
      const create = (original: StoredImage) =>
        Effect.gen(function* () {
          const rows = yield* sql`
            insert into garment default values returning id
          `.pipe(Effect.mapError(writeGarment));
          const id = rows[0]?.id;
          if (typeof id !== 'string') {
            return yield* Effect.fail(
              writeGarment(new Error('No id returned.')),
            );
          }
          yield* attachImage(id, 'original', original);
          return id;
        });

      const attributeUpdate = (attributes: GarmentAttributes) => sql`
        set name = ${attributes.name},
            category = ${attributes.category},
            subcategory = ${attributes.subcategory},
            slots = ${attributes.slots}::garment_slot[],
            warmth = ${attributes.warmth},
            rain_ok = ${attributes.rainOk},
            formality = ${attributes.formality},
            wear_budget = ${attributes.wearBudget},
            colors = ${JSON.stringify(attributes.colors)}::jsonb,
            pattern = ${attributes.pattern},
            material = ${attributes.material},
            fit = ${attributes.fit},
            sleeve = ${attributes.sleeve},
            brand = ${attributes.brand},
            seasons = ${attributes.seasons}::text[],
            notes = ${attributes.notes},
            price = ${attributes.price},
            purchased_on = ${attributes.purchasedOn},
            updated_at = now()
      `;

      /** The model's reading lands, the raw answer is kept, and review opens. */
      const applyExtraction = (
        id: string,
        attributes: GarmentAttributes,
        extraction: unknown,
      ) =>
        sql`
          update garment
          ${attributeUpdate(attributes)},
              extraction = ${JSON.stringify(extraction)}::jsonb,
              processing_error = null,
              status = 'review'
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      const update = (id: string, attributes: GarmentAttributes) =>
        sql`
          update garment
          ${attributeUpdate(attributes)},
              studio_render_id = case
                when studio_render_id is distinct from studio_render_completed_id
                  then null
                else studio_render_id
              end,
              studio_render_completed_id = case
                when studio_render_id is distinct from studio_render_completed_id
                  then studio_render_id
                else studio_render_completed_id
              end
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      const markProcessingError = (id: string, message: string) =>
        sql`
          update garment
          set processing_error = ${message}, status = 'review', updated_at = now()
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      const setStatus = (id: string, status: GarmentStatus) =>
        sql`
          update garment
          set status = ${status},
              retired_at = case when ${status} = 'retired' then now() else null end,
              updated_at = now()
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      const setImageChoice = (id: string, choice: ImageChoice) =>
        sql`
          update garment set image_choice = ${choice}, updated_at = now()
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeGarment));

      const remove = (id: string) =>
        sql`delete from garment where id = ${id}`.pipe(
          Effect.asVoid,
          Effect.mapError(writeGarment),
        );

      const renderRepository = makeGarmentRenderRepository(sql);
      return {
        list,
        byId,
        create,
        attachImage,
        applyExtraction,
        update,
        markProcessingError,
        setStatus,
        setImageChoice,
        remove,
        ...renderRepository,
      };
    }),
  },
) {}
