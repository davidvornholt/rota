import { RotaApi } from '@rota/api/api';
import { CurrentMember } from '@rota/api/current-member';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';

export const accountApi = HttpApiBuilder.group(RotaApi, 'account', (handlers) =>
  Effect.succeed(
    handlers.handle('me', () =>
      Effect.gen(function* () {
        const member = yield* CurrentMember;
        return { name: member.name, admin: member.admin };
      }),
    ),
  ),
);
