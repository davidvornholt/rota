import { RotaApi } from '@rota/api/api';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { asMember } from '#/shared/api/member-runtime.ts';
import { toApiGarment } from '#/shared/api/wire.ts';
import { deleteGarment, setRetired } from '../services/garment-lifecycle.ts';
import { garmentView, garmentViews } from '../services/garment-views.ts';
import { garmentsRuntime } from '../services/garments-runtime.ts';

export const garmentsApi = HttpApiBuilder.group(
  RotaApi,
  'garments',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle('list', () =>
          asMember(() =>
            garmentsRuntime.run(
              Effect.map(garmentViews(), ({ views }) =>
                views.map(toApiGarment),
              ),
            ),
          ),
        )
        .handle('get', ({ params }) =>
          asMember(() =>
            garmentsRuntime.run(
              Effect.map(garmentView(params.id), toApiGarment),
            ),
          ),
        )
        .handle('retire', ({ params, payload }) =>
          asMember(() =>
            garmentsRuntime.run(
              Effect.map(setRetired(params.id, payload.retired), toApiGarment),
            ),
          ),
        )
        .handle('remove', ({ params }) =>
          asMember(() => garmentsRuntime.run(deleteGarment(params.id))),
        ),
    ),
);
