import { HttpApiMiddleware, HttpApiSecurity } from 'effect/http-api';
import type { CurrentMember } from './current-member.ts';
import { Unauthorized } from './errors/api-errors.ts';

/** Every endpoint needs the session token that `rota login` obtains through device authorization. */
export class Authorization extends HttpApiMiddleware.Service<
  Authorization,
  { provides: CurrentMember }
>()('@rota/api/Authorization', {
  requiredForClient: true,
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthorized,
}) {}
