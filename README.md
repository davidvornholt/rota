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

## Design

`DESIGN.md` states the design intent: paper, ink, hairline rules, square corners, one yellow signal, the garment as the only picture.
