import process from 'node:process';
import { BunServices } from '@effect/platform-bun';
import { Effect } from 'effect';
import { Command } from 'effect/cli';
import packageJson from '../../package.json' with { type: 'json' };
import { login, logout, status } from './account-commands.ts';
import { days, forecast } from './day-commands.ts';
import { garments } from './garment-commands.ts';
import { history } from './history-command.ts';
import { outfits } from './outfit-commands.ts';
import { report } from './output.ts';
import { root } from './root.ts';

const rota = root.pipe(
  Command.withSubcommands([
    login,
    logout,
    status,
    garments,
    days,
    forecast,
    outfits,
    history,
  ]),
);

// The CLI library prints help to stdout itself; parse errors become one JSON
// error on stderr like every other failure, so agents parse a single shape.
const program = Command.runWith(rota, {
  version: packageJson.version,
  renderErrors: false,
})(process.argv.slice(2)).pipe(
  Effect.catchTag('ShowHelp', (help) =>
    help.errors.length === 0
      ? Effect.void
      : report({
          _tag: 'UsageError',
          message: help.errors.map((error) => error.message).join('\n'),
        }),
  ),
  Effect.catch((error) =>
    report(
      error._tag === 'UserError'
        ? { _tag: 'UsageError', message: error.message }
        : error,
    ),
  ),
  Effect.catchDefect((defect) =>
    report({ _tag: 'UnexpectedError', message: String(defect) }),
  ),
  Effect.provide(BunServices.layer),
);

await Effect.runPromise(program);
