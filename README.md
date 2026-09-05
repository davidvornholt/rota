# Rota

What to wear today, from a wardrobe that keeps its own rotation. Rota holds a photographed wardrobe, applies the rotation rules that decide most days on their own (trousers four days in a row, tops two), and asks Gemini only where there is a real choice — then proposes one outfit each morning with the pictures and a sentence of reasoning. One tap logs it; the log is what tomorrow is built on.

> Built on [davidvornholt/standards](https://github.com/davidvornholt/standards).

## Workspaces

- `apps/web` — the application: TanStack Start on Bun, Effect on the server, Tailwind with the tokens in `apps/web/src/styles.css`. Its README documents every configuration value and secret.
- `packages/db` — Drizzle schema, generated migrations, and the shared Postgres pool.

## Development

```sh
bun install
just dev-env-generate   # .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start       # local Postgres in a container
bun run --cwd apps/web db:migrate
bun run dev             # http://localhost:3000
```

`bun run check:fix` runs the whole gate: standards sync check, lint, types, tests, build, and the accessibility scan.

## Deployment

Rota runs at `https://rota.vornholt.online` on `prod-1`, whose configuration lives in [`davidvornholt/personal-infra`](https://github.com/davidvornholt/personal-infra). Every commit on `main` that passes the standards gate is built into `ghcr.io/davidvornholt/rota` and announced to that repository, where a trusted writer opens a promotion pull request pinning the new digest; merging it deploys. Garment images live in the `rota-media` R2 bucket behind `https://img.rota.vornholt.online`. There are no pull request previews, by decision recorded there.

## Design

`DESIGN.md` states the design intent: paper, ink, hairline rules, square corners, one yellow signal, the garment as the only picture.

## Pull request screenshots

Publish reviewed demo screenshots from the repository root:

```sh
bun standards screenshots publish /path/to/before.png /path/to/after.png
```

The command uses `config/screenshots.yaml` and the brokered pair in `secrets/assets.yaml`, then prints Markdown for the pull request. The shared bucket and public domain are managed by [personal-infra](https://github.com/davidvornholt/personal-infra/tree/main/infra/opentofu/cloudflare-dns). Each repository has its own credential; keep this pair in SOPS.

Capture matching base and head revisions with the same route, demo data, UI state, and viewport. Include a phone comparison when responsive behavior changes. Review every image before publishing: the URLs are public and permanent. Add the returned image links as a Before/After table in the pull request's Screenshots section.

Provision or replace the repository's publishing pair through the broker:

```sh
bun standards creds add cloudflare --dest assets:assets.screenshots_rw --bucket personal-pr-screenshots --jurisdiction eu --s3 --permissions "Workers R2 Storage Bucket Item Write"
```

Use `bun standards creds plan` and `bun standards creds apply` to inspect and reconcile broker-managed credentials.
