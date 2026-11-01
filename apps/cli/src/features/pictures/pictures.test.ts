import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BunServices } from '@effect/platform-bun';
import type { Garment } from '@rota/api/wardrobe';
import { ConfigProvider, Effect } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { rotaLayer } from '../../shared/rota-api.ts';
import { garmentPicture } from './pictures.ts';

const origin = 'https://rota.example.com';
const key = `${'b'.repeat(64)}.png`;
const downloaded = new Uint8Array([7, 8, 9]);

const garment: Garment = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Shirt',
  status: 'active',
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
  picture: { url: `/api/media/${key}`, width: 800, height: 1000 },
  photo: null,
  studio: null,
};

let home = '';
let requests = 0;

const fakeFetch = (() => {
  requests += 1;
  return Promise.resolve(new Response(downloaded));
}) as unknown as typeof globalThis.fetch;

const save = () =>
  Effect.runPromise(
    garmentPicture(garment, 'picture', 'original').pipe(
      Effect.provide(rotaLayer(origin)),
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, fakeFetch),
      Effect.provide(BunServices.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromDotEnvContents(
            [
              `XDG_CONFIG_HOME=${join(home, 'config')}`,
              `XDG_CACHE_HOME=${join(home, 'cache')}`,
            ].join('\n'),
          ),
        ),
      ),
      Effect.result,
    ),
  );

beforeEach(async () => {
  requests = 0;
  home = await mkdtemp(join(tmpdir(), 'rota-pictures-'));
  await Bun.write(
    join(home, 'config', 'rota', 'sessions.json'),
    JSON.stringify({ [origin]: { token: 'session-token' } }),
  );
  await mkdir(join(home, 'elsewhere'));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe('the picture cache', () => {
  it('replaces a link where a picture belongs instead of following it', async () => {
    const pictures = join(home, 'cache', 'rota', 'pictures');
    const target = join(home, 'elsewhere', 'file');
    await mkdir(pictures, { recursive: true, mode: 0o700 });
    await writeFile(target, 'kept');
    await symlink(target, join(pictures, key));
    const result = await save();
    expect(result._tag).toBe('Success');
    expect(requests).toBe(1);
    expect((await lstat(join(pictures, key))).isFile()).toBe(true);
    expect(await readFile(join(pictures, key))).toEqual(
      Buffer.from(downloaded),
    );
    expect(await readFile(target, 'utf8')).toBe('kept');
  });

  it.each(['rota', 'rota/pictures'])(
    'refuses a link at %s before downloading',
    async (linked) => {
      const link = join(home, 'cache', linked);
      await mkdir(join(link, '..'), { recursive: true, mode: 0o700 });
      await symlink(join(home, 'elsewhere'), link);
      const result = await save();
      expect(result._tag === 'Failure' && result.failure._tag).toBe(
        'PictureNotSaved',
      );
      expect(requests).toBe(0);
      expect(await readdir(join(home, 'elsewhere'))).toEqual([]);
    },
  );
});
