import { describe, expect, it } from 'bun:test';
import { Effect, Layer, TestClock, TestContext } from 'effect';
import { studioJobTimeout } from '#/shared/ai/studio-budgets.ts';

for (const [key, value] of [
  ['DATABASE_URL', 'postgres://localhost/rota'],
  ['BETTER_AUTH_SECRET', '12345678901234567890123456789012'],
  ['BETTER_AUTH_URL', 'http://localhost'],
  ['GITHUB_CLIENT_ID', 'test-client'],
  ['GITHUB_CLIENT_SECRET', 'test-secret'],
  ['GITHUB_ALLOWED_ACCOUNT_ID', '1'],
  ['GEMINI_MODEL', 'test-model'],
  ['GOOGLE_VERTEX_PROJECT', 'test-project'],
  ['GOOGLE_VERTEX_LOCATION', 'test-location'],
  ['GOOGLE_VERTEX_CREDENTIALS_JSON', '{}'],
  ['FOUNDRY_OPENAI_ENDPOINT', 'https://example.test'],
  ['FOUNDRY_OPENAI_API_KEY', 'test-key'],
  ['FOUNDRY_IMAGE_DEPLOYMENT', 'test-deployment'],
  ['MEDIA_STORE', 'local'],
  ['MEDIA_LOCAL_DIR', '/tmp/rota-media'],
] as const) {
  import.meta.env[key] ??= value;
}

const [
  { IngestService },
  { GarmentRepository },
  { MediaStore },
  { Gemini },
  { StudioRenderer },
] = await Promise.all([
  import('./ingest.ts'),
  import('#/shared/data/garment-repository.ts'),
  import('#/shared/media/media-store.ts'),
  import('#/shared/ai/gemini.ts'),
  import('#/shared/ai/studio-renderer.ts'),
]);

describe('garment ingest deadlines', () => {
  it('records a stalled preparation and clears the active job', async () => {
    let processingFailures = 0;
    const repository = {
      _tag: 'shared/GarmentRepository' as const,
      list: () => Effect.never,
      byId: () => Effect.never,
      create: () => Effect.never,
      attachImage: () => Effect.never,
      applyExtraction: () => Effect.never,
      update: () => Effect.never,
      markProcessingError: () =>
        Effect.sync(() => {
          processingFailures += 1;
        }),
      setStudioError: () => Effect.never,
      setStatus: () => Effect.never,
      setImageChoice: () => Effect.never,
      remove: () => Effect.never,
    };
    const media = {
      _tag: 'shared/MediaStore' as const,
      put: () => Effect.never,
      get: () => Effect.never,
      urlFor: () => '',
    };
    const gemini = {
      _tag: 'shared/Gemini' as const,
      generateJson: () => Effect.never,
      model: 'test-model',
    };
    const studio = {
      _tag: 'shared/StudioRenderer' as const,
      render: () => Effect.never,
    };
    const dependencies = Layer.mergeAll(
      Layer.succeed(GarmentRepository, repository),
      Layer.succeed(MediaStore, media),
      Layer.succeed(Gemini, gemini),
      Layer.succeed(StudioRenderer, studio),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ingest = yield* IngestService;
        yield* ingest.process('shirt');
        yield* TestClock.adjust(studioJobTimeout);
        return {
          active: ingest.studioProgress().has('shirt'),
          processingFailures,
        };
      }).pipe(
        Effect.provide(IngestService.Default.pipe(Layer.provide(dependencies))),
        Effect.provide(TestContext.TestContext),
      ),
    );

    expect(result).toEqual({ active: false, processingFailures: 1 });
  });
});
