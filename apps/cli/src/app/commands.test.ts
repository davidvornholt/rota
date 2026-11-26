import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { signOutPath } from '@rota/api/device-login';
import type { Garment } from '@rota/api/wardrobe';
import { Effect, PlatformError } from 'effect';
import {
  dayView,
  garment,
  jeans,
  pictureKey,
  shirt,
} from './command-fixtures.ts';
import {
  cli,
  endCommandTest,
  failureOf,
  origin,
  printed,
  runOk,
  startCommandTest,
  token,
} from './command-harness.ts';

const outfitPath = /^\/api\/cli\/outfits\/[0-9a-f-]{36}$/u;

beforeEach(startCommandTest);
afterEach(endCommandTest);

describe('rota day', () => {
  it('plans tomorrow from slot flags with the stored session', async () => {
    await runOk(
      'day',
      'plan',
      'tomorrow',
      '--top',
      shirt,
      '--bottom',
      jeans,
      '--based-on',
      'Office',
    );
    expect(cli.sent).toEqual([
      {
        method: 'PUT',
        path: '/api/cli/days/tomorrow/plan',
        authorization: `Bearer ${token}`,
        body: {
          items: [
            { slot: 'bottom', garmentId: jeans },
            { slot: 'top', garmentId: shirt },
          ],
          basedOn: 'Office',
        },
      },
    ]);
    expect(printed()).toEqual(dayView);
  });

  it('rejects a garment id before reading the session or asking the server', async () => {
    await rm(join(cli.home, 'config'), { recursive: true });
    const failure = await failureOf('day', 'plan', '--top', 'shirt');
    expect(failure._tag).toBe('InvalidInput');
    expect(cli.sent).toEqual([]);
  });

  it('asks to sign in again when the server refuses the session', async () => {
    cli.answer = () =>
      Response.json(
        { _tag: 'Unauthorized', message: 'Not signed in.' },
        { status: 401 },
      );
    const failure = await failureOf('day', 'show');
    expect(failure._tag).toBe('NotSignedIn');
    expect(failure.message).toContain('rota login');
  });
});

describe('rota outfits save', () => {
  it('saves a new outfit under a fresh id', async () => {
    cli.answer = (path) =>
      Response.json({
        id: path.split('/').at(-1),
        name: 'Dinner',
        items: [],
        collections: ['Evenings'],
        favourite: true,
      });
    await runOk(
      'outfits',
      'save',
      '--name',
      ' Dinner ',
      '--top',
      shirt,
      '--bottom',
      jeans,
      '--collection',
      'Evenings',
      '--favourite',
    );
    const [request] = cli.sent;
    expect(request?.method).toBe('PUT');
    expect(request?.path).toMatch(outfitPath);
    expect(request?.body).toEqual({
      name: 'Dinner',
      items: [
        { slot: 'bottom', garmentId: jeans },
        { slot: 'top', garmentId: shirt },
      ],
      collections: ['Evenings'],
      favourite: true,
    });
  });
});

describe('rota garments', () => {
  it('lists only active garments unless asked for all', async () => {
    cli.answer = () =>
      Response.json([garment(shirt, 'active'), garment(jeans, 'retired')]);
    await runOk('garments', 'list');
    expect(printed().map((item: Garment) => item.id)).toEqual([shirt]);
    await runOk('garments', 'list', '--all');
    expect(printed()).toHaveLength(2);
  });

  it('saves a picture once and prints its path', async () => {
    cli.answer = (path) =>
      path.startsWith('/api/media/')
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'image/webp' },
          })
        : Response.json(garment(shirt, 'active'));
    await runOk('garments', 'picture', shirt);
    await runOk('garments', 'picture', shirt);
    const file = join(
      cli.home,
      'cache',
      'rota',
      'pictures',
      `${pictureKey}.w640.webp`,
    );
    expect(printed()).toEqual([{ id: shirt, name: 'Garment 11', path: file }]);
    expect(await Bun.file(file).bytes()).toEqual(new Uint8Array([1, 2, 3]));
    const media = cli.sent.filter((request) =>
      request.path.startsWith('/api/media/'),
    );
    expect(media).toEqual([
      {
        method: 'GET',
        path: `/api/media/${pictureKey}?w=640`,
        authorization: `Bearer ${token}`,
        body: undefined,
      },
    ]);
  });

  it('reads a redirect from the media route as a lost session', async () => {
    cli.answer = (path) =>
      path.startsWith('/api/media/')
        ? new Response(null, {
            status: 303,
            headers: { location: '/sign-in' },
          })
        : Response.json(garment(shirt, 'active'));
    const failure = await failureOf('garments', 'picture', shirt);
    expect(failure._tag).toBe('NotSignedIn');
    expect(await readdir(join(cli.home, 'cache')).catch(() => [])).toEqual([]);
  });

  it('checks every id before fetching any garment', async () => {
    const failure = await failureOf('garments', 'picture', shirt, 'jeans');
    expect(failure._tag).toBe('InvalidInput');
    expect(cli.sent).toEqual([]);
  });

  it('retires, restores, and deletes a garment', async () => {
    cli.answer = () => Response.json(garment(shirt, 'retired'));
    await runOk('garments', 'retire', shirt);
    await runOk('garments', 'restore', shirt);
    cli.answer = () => new Response(null, { status: 204 });
    await runOk('garments', 'delete', shirt);
    expect(
      cli.sent.map(({ method, path, body }) => ({ method, path, body })),
    ).toEqual([
      {
        method: 'PUT',
        path: `/api/cli/garments/${shirt}/retired`,
        body: { retired: true },
      },
      {
        method: 'PUT',
        path: `/api/cli/garments/${shirt}/retired`,
        body: { retired: false },
      },
      { method: 'DELETE', path: `/api/cli/garments/${shirt}`, body: undefined },
    ]);
    expect(printed()).toEqual({ deleted: shirt });
  });

  it('refuses a picture the server names outside its media route', async () => {
    cli.answer = () =>
      Response.json({
        ...garment(shirt, 'active'),
        picture: { url: '/api/media/../../etc/passwd', width: 1, height: 1 },
      });
    const failure = await failureOf('garments', 'picture', shirt);
    expect(failure._tag).toBe('UnexpectedResponse');
  });
});

describe('rota history', () => {
  it("leaves a missing end to the server, which knows the wardrobe's date", async () => {
    cli.answer = () => Response.json([]);
    await runOk('history');
    await runOk('history', '--to', '2026-03-30');
    await runOk('history', '--from', '2025-01-01', '--to', '2026-01-01');
    expect(cli.sent.map((request) => request.path)).toEqual([
      '/api/cli/history',
      '/api/cli/history?to=2026-03-30',
      '/api/cli/history?from=2025-01-01&to=2026-01-01',
    ]);
  });

  it('rejects a reversed or too long range before asking the server', async () => {
    const reversed = await failureOf(
      'history',
      '--from',
      '2026-03-02',
      '--to',
      '2026-03-01',
    );
    const tooLong = await failureOf(
      'history',
      '--from',
      '2025-01-01',
      '--to',
      '2026-01-02',
    );
    expect([reversed._tag, tooLong._tag]).toEqual([
      'InvalidInput',
      'InvalidInput',
    ]);
    expect(tooLong.message).toContain('366');
    expect(cli.sent).toEqual([]);
  });
});

describe('rota logout', () => {
  it('ends the session and reports a token it could not remove', async () => {
    cli.answer = () => Response.json({});
    cli.fileSystem = (real) => ({
      ...real,
      rename: () =>
        Effect.fail(
          PlatformError.systemError({
            _tag: 'PermissionDenied',
            module: 'FileSystem',
            method: 'rename',
          }),
        ),
    });
    const failure = await failureOf('logout');
    expect(failure._tag).toBe('SessionStoreFailed');
    expect(failure.message).toContain('rota logout');
    expect(cli.sent).toEqual([
      {
        method: 'POST',
        path: signOutPath,
        authorization: `Bearer ${token}`,
        body: {},
      },
    ]);
  });
});

describe('rota status', () => {
  it('reports a machine that never signed in to the server', async () => {
    await rm(join(cli.home, 'config'), { recursive: true });
    await runOk('status');
    expect(printed()).toEqual({ server: origin, signedIn: false });
    expect(cli.sent).toEqual([]);
  });
});
