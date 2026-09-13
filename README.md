# Rota

Outfit suggestions from your photographed wardrobe, forecast, and occasion note.

## Development

Use the Bun version in `package.json`. From the repository root:

```sh
bun install
just dev-env-generate
just dev-db-start
bun run --cwd apps/web db:migrate
bun run dev
```

The app runs at `http://localhost:3000`. Development configuration lives in `config/dev.yaml`, encrypted credentials in `secrets/dev.yaml`, and machine overrides in ignored `config/dev.local.yaml`. Secret shapes are in `secrets/dev.example.yaml`.

Run `bun run check:fix` for the full gate. After changing the database schema, generate migrations with `bun run --cwd packages/db db:generate` and apply them with the web workspace’s `db:migrate` script.

## Deployment

[personal-infra](https://github.com/davidvornholt/personal-infra) owns production at `https://rota.vornholt.online` and the media bucket. Jobs and provider cooldowns are process-local: they do not survive restarts or coordinate multiple replicas. Pull request previews are omitted by maintainer decision.
