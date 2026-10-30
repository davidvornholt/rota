import { Effect } from 'effect';
import { InvalidInput } from './errors/errors.ts';

export const defaultServer = 'https://rota.vornholt.online';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The origin of a Rota server. Only a server on this machine may use plain
 * HTTP, because the session token travels in every request.
 */
export const serverOrigin = (value: string) =>
  Effect.gen(function* () {
    const url = URL.parse(value.trim());
    if (url === null) {
      return yield* new InvalidInput({
        message: `${value} is not a URL. Pass a server such as ${defaultServer}.`,
      });
    }
    const secure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && loopbackHosts.has(url.hostname));
    if (!secure) {
      return yield* new InvalidInput({
        message: `Use https for ${url.host}. Plain http only works for a server on this machine.`,
      });
    }
    return url.origin;
  });
