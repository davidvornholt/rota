import { defineConfig } from 'drizzle-kit';

// Deliberately decoupled from the app env: migrations also run in the deploy
// container, where only DATABASE_URL is set (no auth env). The db:* scripts
// load .env.local via `bun --env-file`.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('DATABASE_URL is not set.');
}

export default defineConfig({
  out: './drizzle',
  schema: ['./src/schema.ts', './src/auth-schema.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
