import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
// biome-ignore lint/correctness/noUnresolvedImports: Biome cannot resolve Playwright's re-exports; TypeScript and the browser run verify these exports.
import { chromium, expect, type Page } from '@playwright/test';
import { pgClientLayer } from '@rota/db/effect-client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import sharp from 'sharp';
import {
  issueCode,
  setAccess,
} from '../src/features/people/services/people-service.ts';
import { makeUsageLedger } from '../src/shared/ai/usage-ledger.ts';
import {
  codeDigest,
  resolveAccessCode,
} from '../src/shared/auth/access-codes.ts';
import { WardrobeOwner } from '../src/shared/auth/identity.ts';
import { DayNoteRepository } from '../src/shared/data/day-note-repository.ts';
import { GarmentRepository } from '../src/shared/data/garment-repository.ts';
import {
  defaultSettings,
  SettingsRepository,
} from '../src/shared/data/settings-repository.ts';
import { pool } from '../src/shared/db/pool.ts';
import { checkRevocation, expectRevoked } from './family-revocation-check.ts';

// This test creates fixtures only in the explicitly isolated development database.
const databaseUrl = new URL(Bun.env.DATABASE_URL ?? '');
if (
  databaseUrl.pathname !== '/rota_family' ||
  !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
) {
  throw new Error(
    'Use a local rota_family database for test:family. Run its generated migrations first.',
  );
}
const ok = 200;
const notFound = 404;
const hashLength = 64;
const port = 3211;
const origin = `http://localhost:${port}`;
const mediaDirectory = '.media-family-check';
const demoPriceId = crypto.randomUUID();
const server = Bun.spawn(['bun', 'run', 'scripts/serve.ts'], {
  env: {
    ...Object.fromEntries(
      Object.entries(Bun.env).map(([key, value]) => [key, String(value)]),
    ),
    // biome-ignore lint/style/useNamingConvention: Environment variable wire name.
    PORT: String(port),
    // biome-ignore lint/style/useNamingConvention: Environment variable wire name.
    BETTER_AUTH_URL: origin,
    // biome-ignore lint/style/useNamingConvention: Environment variable wire name.
    GOOGLE_VERTEX_CREDENTIALS_JSON:
      '{"type":"service_account","project_id":"family-test"}',
    // biome-ignore lint/style/useNamingConvention: Environment variable wire name.
    FOUNDRY_OPENAI_ENDPOINT: 'http://127.0.0.1:9',
    // biome-ignore lint/style/useNamingConvention: Environment variable wire name.
    MEDIA_LOCAL_DIR: mediaDirectory,
  },
  stdout: 'ignore',
  stderr: 'pipe',
});
const browser = await chromium.launch();
const createdMembers: Array<string> = [];
const screenshotDirectory = Bun.env.FAMILY_SCREENSHOT_DIR;
const newPage = async () => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return { page, context, cdp, authenticatorId };
};
const signIn = (page: Page) =>
  page
    .getByRole('button', { name: 'Sign in with a passkey', exact: true })
    .click();
const join = async (page: Page, code: string) => {
  await page.goto(`${origin}/join`);
  await page.getByLabel('Invitation or recovery code').fill(code);
  await page
    .getByRole('button', { name: 'Save a passkey', exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(
    page.getByRole('link', { name: 'Wardrobe', exact: true }),
  ).toBeVisible();
};
const scan = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await scanWcag22AaViolations(page)).toEqual([]);
};
const capture = async (page: Page, name: string) => {
  if (screenshotDirectory) {
    await page.screenshot({
      path: `${screenshotDirectory}/${name}.png`,
      fullPage: true,
    });
  }
};
const makePerson = async (name: string) => {
  const invite = await issueCode({ name });
  createdMembers.push(invite.memberId);
  return invite;
};

try {
  await checkRevocation();
  await expect
    .poll(async () => {
      try {
        return (await fetch(`${origin}/api/healthz`)).status;
      } catch {
        return 0;
      }
    })
    .toBe(ok);
  const admin = await makePerson('Morgan (demo administrator)');
  const owner = await newPage();
  await owner.page.goto(`${origin}/login`);
  await scan(owner.page);
  await capture(owner.page, 'family-login-after');
  await owner.page.goto(`${origin}/join`);
  await scan(owner.page);
  await capture(owner.page, 'family-access-setup');
  await join(owner.page, admin.code);
  await pool.query('update member set admin = true where id = $1', [
    admin.memberId,
  ]);
  await owner.page.goto(`${origin}/people`);
  await expect(
    owner.page.getByRole('heading', { name: 'People', exact: true }),
  ).toBeVisible();
  await owner.page.getByLabel('Name', { exact: true }).fill('Alex (demo)');
  await owner.page.getByRole('button', { name: 'Create invitation' }).click();
  const codeField = owner.page.getByRole('textbox', {
    name: 'Access code',
    exact: true,
  });
  await expect(codeField).toBeVisible();
  const invitationCode = await codeField.inputValue();
  const invited = await pool.query<{ id: string; userId: string }>(
    `select m.id, m.user_id as "userId" from member m join access_code c on c.member_id = m.id where c.digest = $1`,
    [await codeDigest(invitationCode)],
  );
  const [alex] = invited.rows;
  if (!alex) {
    throw new Error('Invitation did not create a member.');
  }
  createdMembers.push(alex.id);
  await scan(owner.page);
  // Never publish a live invitation code.
  await owner.page.getByRole('button', { name: 'Hide code' }).click();
  const family = await newPage();
  await join(family.page, invitationCode);
  await expect(resolveAccessCode(invitationCode)).rejects.toThrow();
  const oldCredentials = await family.cdp.send('WebAuthn.getCredentials', {
    authenticatorId: family.authenticatorId,
  });
  expect(oldCredentials.credentials).toHaveLength(1);
  await family.page.goto(`${origin}/account`);
  await scan(family.page);
  await family.cdp.send('WebAuthn.removeVirtualAuthenticator', {
    authenticatorId: family.authenticatorId,
  });
  await family.cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await family.page
    .getByRole('button', { name: 'Add a passkey', exact: true })
    .click();
  await expect(family.page.getByRole('status')).toHaveText('Passkey added.');
  await family.page.goto(`${origin}/people`);
  await expect(
    family.page.getByRole('heading', { name: 'People', exact: true }),
  ).toHaveCount(0);
  // Both people can store the same date independently; a foreign garment cannot be fetched or changed.
  const runtimes = [admin.memberId, alex.id].map((id) =>
    ManagedRuntime.make(
      Layer.mergeAll(
        GarmentRepository.Default,
        DayNoteRepository.Default,
        SettingsRepository.Default,
      ).pipe(
        Layer.provide(pgClientLayer(pool)),
        Layer.provide(
          Layer.succeed(WardrobeOwner, {
            id,
            userId: id,
            name: 'Demo',
            admin: false,
          }),
        ),
      ),
    ),
  );
  const [first, second] = runtimes;
  if (!(first && second)) {
    throw new Error('Missing test runtimes.');
  }
  const garmentId = crypto.randomUUID();
  const photoKey = `${'a'.repeat(hashLength)}.png`;
  await Bun.write(
    `${mediaDirectory}/${photoKey}`,
    await sharp(await Bun.file('a11y/fixtures/shirt.svg').arrayBuffer())
      .png()
      .toBuffer(),
  );
  await pool.query(
    `insert into garment (id, owner_id, name, status, category) values ($1,$2,'Blue shirt','active','Shirt')`,
    [garmentId, admin.memberId],
  );
  await pool.query(
    `insert into garment_image (id, garment_id, kind, storage_key, mime, width, height, bytes) values ($1,$2,'original',$3,'image/png',1,1,1)`,
    [crypto.randomUUID(), garmentId, photoKey],
  );
  const date =
    '2026-09-19' as import('../src/shared/time/local-date.ts').LocalDate;
  await first.runPromise(
    Effect.flatMap(DayNoteRepository, (notes) =>
      notes.save(date, 'Owner note'),
    ),
  );
  await second.runPromise(
    Effect.flatMap(DayNoteRepository, (notes) =>
      notes.save(date, 'Family note'),
    ),
  );
  expect(
    await first.runPromise(
      Effect.flatMap(DayNoteRepository, (notes) => notes.read(date)),
    ),
  ).toBe('Owner note');
  expect(
    await second.runPromise(
      Effect.flatMap(DayNoteRepository, (notes) => notes.read(date)),
    ),
  ).toBe('Family note');
  await first.runPromise(
    Effect.flatMap(SettingsRepository, (settings) =>
      settings.save({ ...defaultSettings, cooldownDays: 4 }),
    ),
  );
  expect(
    (
      await second.runPromise(
        Effect.flatMap(SettingsRepository, (settings) => settings.read()),
      )
    ).cooldownDays,
  ).toBe(defaultSettings.cooldownDays);
  await expect(
    second.runPromise(
      Effect.flatMap(GarmentRepository, (garments) => garments.byId(garmentId)),
    ),
  ).rejects.toThrow();
  await second.runPromise(
    Effect.flatMap(GarmentRepository, (garments) => garments.remove(garmentId)),
  );
  expect(
    (
      await first.runPromise(
        Effect.flatMap(GarmentRepository, (garments) =>
          garments.byId(garmentId),
        ),
      )
    ).name,
  ).toBe('Blue shirt');
  expect(
    (
      await family.context.request.get(`${origin}/api/media/${photoKey}`)
    ).status(),
  ).toBe(notFound);
  await Promise.all(runtimes.map((runtime) => runtime.dispose()));
  await owner.page.goto(`${origin}/people/${admin.memberId}`);
  await expect(
    owner.page.getByRole('heading', { name: 'Blue shirt' }),
  ).toBeVisible();
  await scan(owner.page);
  await capture(owner.page, 'family-admin-wardrobe');
  await pool.query(
    `insert into api_price (id, provider, model, input_per_million, output_per_million,
    image_input_per_million, image_output_per_million, cached_input_per_million) values ($1,'vertex','demo-model',1,5,0,0,0.1)`,
    [demoPriceId],
  );
  const ledger = await Effect.runPromise(
    makeUsageLedger.pipe(
      Effect.provideService(WardrobeOwner, {
        id: alex.id,
        userId: alex.userId,
        name: 'Alex (demo)',
        admin: false,
      }),
    ),
  );
  const operation = {
    provider: 'vertex' as const,
    model: 'demo-model',
    operation: 'Outfit suggestion',
  };
  await ledger.measure(
    operation,
    () =>
      Promise.resolve({ promptTokenCount: 1000, candidatesTokenCount: 100 }),
    (usage) => ({ usage, success: true }),
  );
  await expect(
    ledger.measure(
      operation,
      () => Promise.reject(new Error('Simulated provider timeout')),
      () => ({ usage: null, success: false }),
    ),
  ).rejects.toThrow();
  const spending = await pool.query<{ status: string; cost: string | null }>(
    'select status, estimated_usd as cost from api_usage where owner_id = $1 order by created_at',
    [alex.id],
  );
  expect(spending.rows).toEqual([
    { status: 'success', cost: '0.00150000' },
    { status: 'failed', cost: null },
  ]);
  const recovery = await issueCode({ memberId: alex.id });
  const recovered = await newPage();
  await join(recovered.page, recovery.code);
  const passkeys = await pool.query(
    'select id from passkey where user_id = $1',
    [alex.userId],
  );
  expect(passkeys.rowCount).toBe(1);
  await expect(
    (await family.context.request.get(`${origin}/api/auth/get-session`)).json(),
  ).resolves.toBeNull();
  await expect(resolveAccessCode(recovery.code)).rejects.toThrow();
  await setAccess(alex.id, false);
  await recovered.page.goto(`${origin}/wardrobe`);
  await expect(recovered.page).toHaveURL(`${origin}/login`);
  await signIn(recovered.page);
  await expect(recovered.page.getByRole('alert')).toBeVisible();
  await expectRevoked(alex.userId);
  await setAccess(alex.id, true);
  await signIn(recovered.page);
  await expect(recovered.page).toHaveURL(`${origin}/`);
  await owner.page.goto(`${origin}/people`);
  await scan(owner.page);
  await capture(owner.page, 'family-admin-people');
  await owner.page.getByText('API prices', { exact: true }).click();
  await scan(owner.page);
  await owner.page.setViewportSize({ width: 390, height: 844 });
  await scan(owner.page);
  await capture(owner.page, 'family-admin-people-mobile');
  process.stdout.write(
    'Family check passed: registration, recovery, session revocation, tenant isolation, costs, and accessibility.\n',
  );
} finally {
  await browser.close();
  server.kill();
  await server.exited;
  await pool.query('delete from garment where owner_id = any($1::text[])', [
    createdMembers,
  ]);
  await pool.query('delete from day_note where owner_id = any($1::text[])', [
    createdMembers,
  ]);
  await pool.query('delete from settings where owner_id = any($1::text[])', [
    createdMembers,
  ]);
  await pool.query('delete from admin_visit where actor_id = any($1::text[])', [
    createdMembers,
  ]);
  await pool.query(
    'delete from "user" where id in (select user_id from member where id = any($1::text[]))',
    [createdMembers],
  );
  await pool.query('delete from api_usage where owner_id = any($1::text[])', [
    createdMembers,
  ]);
  await pool.query('delete from api_price where id = $1', [demoPriceId]);
  await pool.end();
}
