import { spawn } from 'node:child_process';
import process from 'node:process';
import { Effect } from 'effect';

const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';

/**
 * Opens a link in the default browser, if this machine has one. The opener
 * runs detached and unwatched: when it starts the browser itself it lives as
 * long as the browser, and the link is printed anyway.
 */
export const openBrowser = (url: string): Effect.Effect<void> =>
  Effect.sync(() => {
    try {
      const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
      // A missing opener reports ENOENT here instead of throwing.
      child.on('error', () => undefined);
      child.unref();
    } catch {
      // Opening the browser is a convenience; the printed link still works.
    }
  });
