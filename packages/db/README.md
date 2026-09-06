# @rota/db

Drizzle schema, generated migrations, and the shared Postgres pool factory.

- `src/schema.ts` — the wardrobe tables. `garment` is one row per garment with its reading (category, slots, warmth, formality, colours, wear budget), its status (`processing`, `review`, `active`, `retired`), and the picture it shows; `garment_image` holds the stored original and studio renders by kind. `wear_log` is the ground truth: one row per garment per day, with the source of the entry (proposed, override, edited, backfilled). `proposal` keeps every proposal the model made, its payload and status, so adherence can be read later. `day_note` holds the day's occasion; `weather_day` the forecast the day was decided on; `settings` is a single row with the place, rest days, category budgets, and the hour the day is decided.
- `src/auth-schema.ts` — better-auth tables (user, session, account, verification), shaped by better-auth's `getAuthTables()`.
- `src/pool.ts` — `createPool(connectionString)`; one shared pool per process with an `error` listener so a dropped idle connection is logged instead of crashing the process.
- `src/postgres-date.ts` — `preservePostgresDates()`; installs pg's DATE parser so a calendar date never passes through a time zone. Wear-log dates are calendar days, not instants.
- `src/effect-client.ts` — `pgClientLayer(pool)`; the Effect SQL client over a pool this package created.
- `src/migrate.ts` — the Drizzle migration runner the web app's `db:migrate` script calls.

## Workflow

Schema migrations are generated from the Drizzle schema:

```sh
bun run db:generate                      # drizzle-kit generate (reads .env.local)
bun run --cwd ../../apps/web db:migrate  # apply
```

The colour-name removal is a data-only migration scaffolded with `bun run db:generate --custom --name remove_stored_colour_names`. It removes `name` from every stored garment colour while preserving hex values, array order, and empty arrays. Run `db:migrate` before starting the updated app, which rejects the old colour shape.

`.env.local` is composed by `just dev-env-generate`; the dev Postgres container is managed by `just dev-db-start`.

## Garment ratings

Warmth uses 1 = Light, 2 = Medium, 3 = Heavy. Formality uses 1 = Casual, 2 = Smart, 3 = Formal. Unread garments default to 2 for both. The single generated initial migration creates these defaults and constraints directly. Initialize a fresh database. Any database created from the previous migration history must be recreated first, including its Drizzle migration journal; deleting garment rows alone is insufficient.

## Environment

| Variable       | Purpose                                            | Required                                                                                          | Source                                                                                          |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string for Drizzle generation  | Required, no default. `drizzle.config.ts` fails with `DATABASE_URL is not set.` when it is missing | `config/dev.yaml` under `packages.db`, generated into `.env.local` by `just dev-env-generate`   |
