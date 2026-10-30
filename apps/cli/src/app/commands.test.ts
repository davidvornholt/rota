import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { BunServices } from '@effect/platform-bun';
import type { DayView, Garment } from '@rota/api/wardrobe';
import { ConfigProvider, Effect } from 'effect';
import { Command } from 'effect/cli';
import { FetchHttpClient } from 'effect/http';
import { status } from './account-commands.ts';
import { days } from './day-commands.ts';
import { garments } from './garment-commands.ts';
import { history } from './history-command.ts';
import { outfits } from './outfit-commands.ts';
import { root } from './root.ts';

const origin = 'https://rota.example.com';
const token = 'session-token';
const shirt = '11111111-1111-4111-8111-111111111111';
const jeans = '22222222-2222-4222-8222-222222222222';
const pictureKey = `${'a'.repeat(64)}.jpg`;
const outfitPath = /^\/api\/cli\/outfits\/[0-9a-f-]{36}$/u;

type Sent = {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

// Stands in for the Rota server: records each request and answers it with
// `answer`, so no test reaches a real server.
let sent: Array<Sent> = [];
let answer: (path: string) => Response = () => Response.json({});

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const text = await request.text();
  sent.push({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    authorization: request.headers.get('authorization'),
    body: text === '' ? undefined : JSON.parse(text),
  });
  return answer(`${url.pathname}${url.search}`);
}) as typeof globalThis.fetch;

const dayView: DayView = {
  date: '2026-10-31',
  today: '2026-10-30',
  weather: null,
  forecastStale: false,
  occasion: null,
  proposal: null,
  worn: null,
  plan: null,
  laundry: [],
  problem: null,
  warnings: [],
};

const garment = (id: string, state: Garment['status']): Garment => ({
  id,
  name: `Garment ${id.slice(0, 2)}`,
  status: state,
  category: 'shirt',
  subcategory: '',
  slots: ['top'],
  colors: [],
  pattern: '',
  material: '',
  fit: '',
  sleeve: '',
  brand: '',
  notes: '',
  warmth: 2,
  formality: 2,
  rainOk: true,
  wears: 0,
  lastWornOn: null,
  wearBudget: 2,
  wearsSinceWash: 0,
  inLaundry: false,
  readyOn: null,
  price: null,
  purchasedOn: null,
  costPerWear: null,
  picture: { url: `/api/media/${pictureKey}`, width: 800, height: 1000 },
  photo: null,
  studio: null,
});

const rota = root.pipe(
  Command.withSubcommands([status, garments, days, outfits, history]),
);

let home = '';
let stdout: ReturnType<typeof spyOn>;

const printed = () =>
  JSON.parse(String(stdout.mock.calls.at(-1)?.[0] ?? 'null'));

const run = (...args: ReadonlyArray<string>) =>
  Effect.runPromise(
    Command.runWith(rota, { version: 'test' })(args).pipe(
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            [
              `ROTA_SERVER=${origin}`,
              `XDG_CONFIG_HOME=${join(home, 'config')}`,
              `XDG_CACHE_HOME=${join(home, 'cache')}`,
            ].join('\n'),
          ),
        ),
      ),
      Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
      Effect.result,
    ),
  );

const runOk = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Failure') {
    throw new Error(`rota ${args.join(' ')} failed: ${result.failure}`);
  }
};

const failureOf = async (...args: ReadonlyArray<string>) => {
  const result = await run(...args);
  if (result._tag === 'Success') {
    throw new Error(`rota ${args.join(' ')} succeeded`);
  }
  return result.failure;
};

beforeEach(async () => {
  sent = [];
  answer = () => Response.json(dayView);
  home = await mkdtemp(join(tmpdir(), 'rota-cli-'));
  await Bun.write(
    join(home, 'config', 'rota', 'sessions.json'),
    JSON.stringify({ [origin]: { token } }),
  );
  stdout = spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(async () => {
  stdout.mockRestore();
  await rm(home, { recursive: true, force: true });
});

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
    expect(sent).toEqual([
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

  it('rejects a garment id before asking the server', async () => {
    const failure = await failureOf('day', 'plan', '--top', 'shirt');
    expect(failure._tag).toBe('InvalidInput');
    expect(sent).toEqual([]);
  });

  it('asks to sign in again when the server refuses the session', async () => {
    answer = () =>
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
    answer = (path) =>
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
    const [request] = sent;
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
    answer = () =>
      Response.json([garment(shirt, 'active'), garment(jeans, 'retired')]);
    await runOk('garments', 'list');
    expect(printed().map((item: Garment) => item.id)).toEqual([shirt]);
    await runOk('garments', 'list', '--all');
    expect(printed()).toHaveLength(2);
  });

  it('saves a picture once and prints its path', async () => {
    answer = (path) =>
      path.startsWith('/api/media/')
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'image/webp' },
          })
        : Response.json(garment(shirt, 'active'));
    await runOk('garments', 'picture', shirt);
    await runOk('garments', 'picture', shirt);
    const file = join(
      home,
      'cache',
      'rota',
      'pictures',
      `${pictureKey}.w640.webp`,
    );
    expect(printed()).toEqual([{ id: shirt, name: 'Garment 11', path: file }]);
    expect(await Bun.file(file).bytes()).toEqual(new Uint8Array([1, 2, 3]));
    const media = sent.filter((request) =>
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
    answer = (path) =>
      path.startsWith('/api/media/')
        ? new Response(null, {
            status: 303,
            headers: { location: '/sign-in' },
          })
        : Response.json(garment(shirt, 'active'));
    const failure = await failureOf('garments', 'picture', shirt);
    expect(failure._tag).toBe('NotSignedIn');
    expect(await readdir(join(home, 'cache')).catch(() => [])).toEqual([]);
  });

  it('refuses a picture the server names outside its media route', async () => {
    answer = () =>
      Response.json({
        ...garment(shirt, 'active'),
        picture: { url: '/api/media/../../etc/passwd', width: 1, height: 1 },
      });
    const failure = await failureOf('garments', 'picture', shirt);
    expect(failure._tag).toBe('UnexpectedResponse');
  });
});

describe('rota history', () => {
  it('asks for the last 30 days by default', async () => {
    answer = () => Response.json([]);
    await runOk('history', '--to', '2026-03-30');
    expect(sent[0]?.path).toBe(
      '/api/cli/history?from=2026-03-01&to=2026-03-30',
    );
  });
});

describe('rota status', () => {
  it('reports a machine that never signed in to the server', async () => {
    await rm(join(home, 'config'), { recursive: true });
    await runOk('status');
    expect(printed()).toEqual({ server: origin, signedIn: false });
    expect(sent).toEqual([]);
  });
});
