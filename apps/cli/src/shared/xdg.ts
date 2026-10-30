import { Config, Effect, Option, Path } from 'effect';

/**
 * An XDG base directory such as `XDG_CONFIG_HOME`, or its default under the
 * home directory when the variable is unset.
 */
export const xdgDirectory = (variable: string, fallback: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const chosen = yield* Config.option(Config.NonEmptyString(variable));
    if (Option.isSome(chosen)) {
      return chosen.value;
    }
    const home = yield* Config.NonEmptyString('HOME');
    return path.join(home, fallback);
  }).pipe(
    // Without HOME there is no sensible place for rota's files.
    Effect.orDie,
  );
