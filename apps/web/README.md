# @rota/web

The Rota application: TanStack Start + Vite on Bun, GitHub OAuth via better-auth (restricted to one allowed account), Tailwind with the semantic tokens in `src/styles.css`, Effect on the server.

## Development

```sh
just dev-env-generate   # compose .env.local from config/dev.yaml + secrets/dev.yaml
just dev-db-start       # local Postgres container (rota-dev-postgres)
bun run db:migrate      # apply the generated migrations
bun run dev             # Vite dev server on port 3000
```

Sign-in needs all of those. The dev server has to hold port 3000: the shared "Postlude (dev)" GitHub OAuth app sends the browser back to `http://localhost:3000/api/auth/callback/github`, so a server that fell back to another port never receives the callback.

The Vite dev server runs the server code in Node; `bun run start` runs the built app in Bun. The media store uses Node's file APIs for the local backend so both behave the same, and the S3 backend (Bun's `S3Client`) refuses to start under Node with a message that says so.

## What the app does

Rota keeps a wardrobe of photographed garments and decides each morning what to wear. A deterministic engine holds the rotation: trousers are worn four days in a row, tops two, and the day before is always read from the wear log, so a swap yesterday changes today's proposal. Where the engine has a genuine choice — a slot whose rotation just ended, a forecast that turned — Gemini picks from the engine's shortlist, with the garment pictures in front of it, and explains the pick in a sentence. The wearer confirms with one tap, asks again, swaps one item, or logs something else entirely; whatever is logged becomes the truth the next day is built on.

- `src/features/garments` — the wardrobe. Uploads land as `processing` rows; `services/ingest.ts` has Gemini read the photo into a structured garment (`schemas/extraction.ts`) and GPT-Image-2 render a flat studio picture, then the garment waits in `review` until the wearer accepts or corrects the reading. `services/upload.ts` is the multipart handler behind `/api/garments/upload`.
- `src/features/rota` — the day. `rotation.ts` is the pure engine (warmth bands, cooldown, continuations, ranked candidates). `services/proposal-service.ts` builds the prompt from the engine's shortlist, decodes Gemini's aliased answer back to garments, and settles the proposal (confirm, re-roll, override). `services/today-service.ts` assembles the Today page and answers the scheduler's tick. `services/forecast-service.ts` fetches Open-Meteo hourly data once a day and summarizes 05:00–20:00 in the selected location's time zone for outfit selection, prompts, and forecast labels. Temperatures, wind, and conditions include both endpoints; precipitation covers the intervals from 05:00 to 20:00. It falls back to the stored forecast when the network is down. Every stored forecast covers this fixed window.
- `src/features/history` — the wear log looked at from a distance: the rota board, the year as colour swatches, temperature per garment, adherence, neglected garments, cost per wear. `stats.ts` is pure; the day editor writes back through the rota feature's `logOutfitFn` from the route.
- `src/features/settings` — the place (geocoded through Open-Meteo, which fixes the time zone the day turns over in), rest days, the hour the day is decided, and per-category wear budgets.
- `src/shared/data` — one Effect repository per table; every row is decoded with Schema before it is used.
- `src/shared/ai` — the Gemini client (structured JSON output, thinking level high, images as inline parts) and the GPT-Image-2 renderer (Foundry's `images/edits`, transparent PNG, falling back to an opaque render if the deployment refuses transparency).
- `src/shared/media` — where image bytes live: a directory in development, an S3-compatible bucket in production. Keys are the SHA-256 of the bytes.

### The scheduler

`scripts/serve.ts` mints a token at boot, puts it into its own environment as `ROTA_TICK_TOKEN`, and once a minute calls `POST /api/internal/tick` in-process with that token. The tick makes the day's proposal once the configured hour has passed and nothing is logged yet, so the proposal is usually waiting before the app is opened. The route answers 401 to any request without the token; nothing outside the process knows it.

### Access control

Exactly one GitHub account can sign in: `GITHUB_ALLOWED_ACCOUNT_ID` holds its numeric account ID, and `src/shared/auth/authorization.ts` enforces it on the way in (`user.validateUserInfo`, before any row is written) and on every session read (a session that stops belonging to the allowed account is revoked). Every server function carries `sessionRequired`; `sensitive-server-fns.test.ts` fails the build if one loses it.

## Design

`DESIGN.md` at the repo root states the design intent. `src/styles.css` holds the tokens (paper, ink, hairline rules, one yellow signal) and the three type roles; `src/shared/ui/classes.ts` holds the shared control recipes. Corners are square everywhere.

## Environment

All values are read once in `src/shared/env.ts` and validated at boot. Development values are composed into `.env.local` by `just dev-env-generate` from `config/dev.yaml` (plain) and `secrets/dev.yaml` (SOPS). The a11y scan boots with `.env.a11y`, which holds fixture values only.

| Variable                         | Purpose                                                                                                                       | Required                                        | Source                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------ |
| `DATABASE_URL`                   | Postgres connection string                                                                                                    | Required                                        | `config/dev.yaml`        |
| `BETTER_AUTH_URL`                | Public origin of the app; better-auth builds the OAuth callback from it                                                       | Required                                        | `config/dev.yaml`        |
| `BETTER_AUTH_SECRET`             | Signs sessions and cookies; at least 32 characters                                                                            | Required                                        | `secrets/dev.yaml`       |
| `GITHUB_CLIENT_ID`               | GitHub OAuth app client ID                                                                                                    | Required                                        | `config/dev.yaml`        |
| `GITHUB_CLIENT_SECRET`           | GitHub OAuth app client secret                                                                                                | Required                                        | `secrets/dev.yaml`       |
| `GITHUB_ALLOWED_ACCOUNT_ID`      | Numeric GitHub account ID of the only account allowed to sign in                                                              | Required                                        | `config/dev.yaml`        |
| `GEMINI_MODEL`                   | Gemini model name used for garment reading and outfit proposals                                                               | Required                                        | `config/dev.yaml`        |
| `GOOGLE_VERTEX_PROJECT`          | Google Cloud project Gemini is billed to (Vertex AI)                                                                          | Required                                        | `config/dev.yaml`        |
| `GOOGLE_VERTEX_LOCATION`         | Vertex AI location; `global` avoids regional availability gaps                                                                | Required                                        | `config/dev.yaml`        |
| `GOOGLE_VERTEX_CREDENTIALS_JSON` | Service-account JSON on one line, with Vertex AI User on the project                                                          | Required                                        | `secrets/dev.yaml`       |
| `FOUNDRY_OPENAI_ENDPOINT`        | Microsoft Foundry resource root; the app appends `/openai/v1/images/edits`                                                    | Required                                        | `config/dev.yaml`        |
| `FOUNDRY_OPENAI_API_KEY`         | API key of that Foundry resource                                                                                              | Required                                        | `secrets/dev.yaml`       |
| `FOUNDRY_IMAGE_DEPLOYMENT`       | Name of the GPT-Image-2 deployment on the resource                                                                            | Required                                        | `config/dev.yaml`        |
| `MEDIA_STORE`                    | `local` keeps images in a directory; `s3` puts them in an S3-compatible bucket                                                 | Required                                        | `config/dev.yaml`        |
| `MEDIA_LOCAL_DIR`                | Directory for the local store, relative to the working directory                                                              | Required when `MEDIA_STORE=local`               | `config/dev.yaml`        |
| `S3_ENDPOINT`                    | S3-compatible endpoint (Cloudflare R2 account endpoint in production)                                                         | Required when `MEDIA_STORE=s3`                  | host configuration       |
| `S3_BUCKET`                      | Bucket name                                                                                                                   | Required when `MEDIA_STORE=s3`                  | host configuration       |
| `S3_ACCESS_KEY_ID`               | Bucket access key                                                                                                             | Required when `MEDIA_STORE=s3`                  | host secrets             |
| `S3_SECRET_ACCESS_KEY`           | Bucket secret key                                                                                                             | Required when `MEDIA_STORE=s3`                  | host secrets             |
| `MEDIA_PUBLIC_BASE_URL`          | Public base URL of the bucket's custom domain; without it the app serves images itself through `/api/media/*` behind sign-in | Optional                                        | host configuration       |
| `PORT`                           | Port the production server listens on                                                                                         | Optional, default 3000 (`bun run start` only)   | process environment      |
| `ROTA_TICK_TOKEN`                | Set by the server process for itself at boot; authorises `/api/internal/tick`                                                 | Never set by hand                               | `scripts/serve.ts`       |

## Container

`Dockerfile` at the repo root builds the production image: dependencies, the Vite build, then a runner that holds only `dist/`, `scripts/`, and the production `node_modules`, and runs as an unprivileged user. `bun run db:migrate:deploy` applies the generated migrations from the same image; the host runs it as a one-shot before the server starts. `.github/workflows/publish-container.yml` builds `ghcr.io/davidvornholt/rota` for every commit on `main` once the standards gate has passed for that exact commit, and `announce-container.yml` tells `personal-infra` about the new digest, which is where deployment lives.

## Verification

```sh
bun run lint && bun run check-types && bun test && bun run build && bun run test:a11y
```

`bun run check:fix` at the repo root runs all of it through Turbo.

## Garment ratings

The review card and garment editor use three choices with visible explanations: Light, Medium, Heavy for insulation and Casual, Smart, Formal for dressiness. The same definitions guide photo extraction and outfit proposals. Weather matching uses 60% of the daily high plus 40% of the low: at least 18 °C favours Light, 12 °C to below 18 °C favours Medium, and below 12 °C favours Heavy. Exact matches rank first; adjacent levels are offered when fewer than three exact matches exist. Light and Heavy never substitute for one another. Layering and the occasion remain part of the outfit proposal.
