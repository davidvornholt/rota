import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Server-side configuration. Public development values live in config/dev.yaml,
 * secrets come from secrets/dev.yaml — `just dev-env-generate` composes both
 * into .env.local (see apps/web/README.md).
 */
const minSecretLength = 32;

const s3Variables = {
  S3_ENDPOINT: z.url().optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Public base URL of the bucket's custom domain; without it the app serves media itself. */
  MEDIA_PUBLIC_BASE_URL: z.url().optional(),
};

const mediaStore = z.discriminatedUnion('MEDIA_STORE', [
  z.object({
    MEDIA_STORE: z.literal('local'),
    MEDIA_LOCAL_DIR: z.string().min(1),
    ...s3Variables,
  }),
  z.object({
    MEDIA_STORE: z.literal('s3'),
    MEDIA_LOCAL_DIR: z.string().optional(),
    S3_ENDPOINT: z.url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    MEDIA_PUBLIC_BASE_URL: z.url().optional(),
  }),
]);

export type MediaStoreConfig = z.infer<typeof mediaStore>;

const serverEnv = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(minSecretLength),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    /** Positive decimal GitHub account ID of the only allowed account. */
    GITHUB_ALLOWED_ACCOUNT_ID: z.string().regex(/^[1-9]\d*$/u),
    GEMINI_MODEL: z.string().min(1),
    GOOGLE_VERTEX_PROJECT: z.string().min(1),
    GOOGLE_VERTEX_LOCATION: z.string().min(1),
    /** One-line service-account JSON; parsed once at boot in the Gemini layer. */
    GOOGLE_VERTEX_CREDENTIALS_JSON: z.string().min(1),
    FOUNDRY_OPENAI_ENDPOINT: z.url(),
    FOUNDRY_OPENAI_API_KEY: z.string().min(1),
    FOUNDRY_IMAGE_DEPLOYMENT: z.string().min(1),
    MEDIA_STORE: z.enum(['local', 's3']),
    MEDIA_LOCAL_DIR: z.string().optional(),
    ...s3Variables,
  },
  clientPrefix: 'VITE_',
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

/**
 * The media variables are validated a second time as a discriminated union:
 * `s3` needs every S3_* value, `local` needs the directory, and a boot with
 * half of either would otherwise fail on the first upload rather than here.
 */
export const mediaStoreConfig: MediaStoreConfig = mediaStore.parse(serverEnv);

export const env = serverEnv;
