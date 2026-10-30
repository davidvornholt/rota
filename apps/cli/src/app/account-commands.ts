import { Effect, Option } from 'effect';
import { Command } from 'effect/cli';
import {
  awaitApproval,
  requestDeviceCode,
} from '../features/login/device-login.ts';
import { endSession } from '../features/login/sign-out.ts';
import { callRota, rotaLayer } from '../shared/rota-api.ts';
import { forgetToken, readToken, saveToken } from '../shared/session-store.ts';
import { flag } from './command-inputs.ts';
import { openBrowser } from './open-browser.ts';
import { emit, tell } from './output.ts';
import { currentOrigin, httpLayer } from './root.ts';

const whoAmI = (origin: string) =>
  callRota((client) => client.account.me()).pipe(
    Effect.provide(rotaLayer(origin)),
  );

export const login = Command.make(
  'login',
  {
    noBrowser: flag(
      'no-browser',
      'Print the sign-in link without opening a browser',
    ),
  },
  ({ noBrowser }) =>
    Effect.gen(function* () {
      const origin = yield* currentOrigin;
      const previous = yield* readToken(origin);
      const code = yield* requestDeviceCode(origin);
      yield* tell(
        [
          `To sign in, open ${code.verificationUriComplete}`,
          `and approve the code ${code.userCode}. Waiting for the approval …`,
        ].join('\n'),
      );
      if (!noBrowser) {
        yield* openBrowser(code.verificationUriComplete);
      }
      const token = yield* awaitApproval(origin, code);
      yield* saveToken(origin, token);
      // The new session replaces the old one, which would otherwise stay
      // valid on the server until it expires.
      if (Option.isSome(previous) && previous.value !== token) {
        yield* endSession(origin, previous.value).pipe(Effect.ignore);
      }
      const member = yield* whoAmI(origin);
      yield* emit({ server: origin, signedIn: true, ...member });
    }).pipe(Effect.provide(httpLayer)),
).pipe(
  Command.withDescription(
    'Sign in by approving a code in the browser. Run it yourself in a terminal; it waits up to 15 minutes for the approval.',
  ),
);

export const logout = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const token = yield* readToken(origin);
    if (Option.isSome(token)) {
      // The token leaves this machine even when the server cannot be told.
      yield* endSession(origin, token.value).pipe(
        Effect.ensuring(forgetToken(origin).pipe(Effect.ignore)),
      );
    }
    yield* emit({ server: origin, signedIn: false });
  }).pipe(Effect.provide(httpLayer)),
).pipe(
  Command.withDescription(
    'End the session on the server and remove its token from this machine',
  ),
);

export const status = Command.make('status', {}, () =>
  Effect.gen(function* () {
    const origin = yield* currentOrigin;
    const member = yield* whoAmI(origin).pipe(
      Effect.map(Option.some),
      Effect.catchTag('NotSignedIn', () => Effect.succeedNone),
    );
    yield* emit(
      Option.match(member, {
        onNone: () => ({ server: origin, signedIn: false }),
        onSome: (signedIn) => ({ server: origin, signedIn: true, ...signedIn }),
      }),
    );
  }).pipe(Effect.provide(httpLayer)),
).pipe(Command.withDescription('Show the server and who is signed in'));
