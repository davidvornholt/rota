import process from 'node:process';
import { Effect } from 'effect';

// stdout carries Rota's data as JSON; stderr carries errors as JSON.
// Pretty-print for people at a terminal; keep piped output compact for agents.
export const writeJson = (stream: NodeJS.WriteStream, value: unknown): void => {
  stream.write(
    `${JSON.stringify(value, null, stream.isTTY === true ? 2 : undefined)}\n`,
  );
};

export const emit = (value: unknown): Effect.Effect<void> =>
  Effect.sync(() => writeJson(process.stdout, value));

/** Instructions for the person at the terminal, such as where to approve a sign-in. */
export const tell = (text: string): Effect.Effect<void> =>
  Effect.sync(() => {
    process.stderr.write(`${text}\n`);
  });

export const failureExitCode = 1;
export const usageExitCode = 2;

export type ReportedError = {
  readonly _tag: string;
  readonly message: string;
};

// Errors about the arguments themselves, as opposed to Rota's state or the
// connection.
const invalidInputTags = new Set(['InvalidInput', 'UsageError']);

export const report = (error: ReportedError): Effect.Effect<void> =>
  Effect.sync(() => {
    writeJson(process.stderr, {
      error: { tag: error._tag, message: error.message },
    });
    process.exitCode = invalidInputTags.has(error._tag)
      ? usageExitCode
      : failureExitCode;
  });
