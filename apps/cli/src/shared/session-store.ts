import { Effect, FileSystem, Option, Path, Schema } from 'effect';
import { SessionStoreFailed } from './errors/errors.ts';
import { xdgDirectory } from './xdg.ts';

/**
 * The session token of each Rota server this machine signed in to, keyed by
 * origin. A token stands in for the member's password, so only the owner can
 * read the file.
 */
const SessionsSchema = Schema.Record(
  Schema.String,
  Schema.Struct({ token: Schema.String }),
);
type Sessions = typeof SessionsSchema.Type;
const SessionsJson = Schema.fromJsonString(SessionsSchema, { space: 2 });

const sessionsFile = Effect.gen(function* () {
  const path = yield* Path.Path;
  const configHome = yield* xdgDirectory('XDG_CONFIG_HOME', '.config');
  return path.join(configHome, 'rota', 'sessions.json');
});

const storeFailed = (path: string) => (error: { readonly message: string }) =>
  new SessionStoreFailed({
    message: `Could not use ${path}: ${error.message}`,
  });

const readSessions = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* sessionsFile;
  const text = yield* fs.readFileString(path).pipe(
    Effect.map(Option.some),
    Effect.catchReason('PlatformError', 'NotFound', () => Effect.succeedNone),
    Effect.mapError(storeFailed(path)),
  );
  if (Option.isNone(text)) {
    return {};
  }
  return yield* Schema.decodeEffect(SessionsJson)(text.value).pipe(
    Effect.mapError(storeFailed(path)),
  );
});

/** Only the signed-in user may read the tokens. */
const ownerOnlyFile = 0o600;
const ownerOnlyDirectory = 0o700;

const writeSessions = (sessions: Sessions) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const path = yield* sessionsFile;
    const text = yield* Schema.encodeEffect(SessionsJson)(sessions).pipe(
      Effect.mapError(storeFailed(path)),
    );
    // Written beside the old file and renamed over it, so a crash never
    // leaves half a file, and created owner-only before the token is in it.
    const draft = `${path}.${crypto.randomUUID()}.tmp`;
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(pathService.dirname(path), {
        recursive: true,
        mode: ownerOnlyDirectory,
      });
      yield* fs.writeFileString(draft, `${text}\n`, { mode: ownerOnlyFile });
      yield* fs.chmod(draft, ownerOnlyFile);
      yield* fs.rename(draft, path);
    }).pipe(Effect.mapError(storeFailed(path)));
  });

export const readToken = (origin: string) =>
  Effect.map(readSessions, (sessions) =>
    Option.fromUndefinedOr(sessions[origin]?.token),
  );

export const saveToken = (origin: string, token: string) =>
  Effect.flatMap(readSessions, (sessions) =>
    writeSessions({ ...sessions, [origin]: { token } }),
  );

export const forgetToken = (origin: string) =>
  Effect.flatMap(readSessions, (sessions) => {
    if (!(origin in sessions)) {
      return Effect.void;
    }
    const { [origin]: _forgotten, ...rest } = sessions;
    return writeSessions(rest);
  });
