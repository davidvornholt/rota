# @rota/web

Setup and operations are in the [repository README](../../README.md).

## Outfit planning and laundry

Wear allowances count logged wears, including separate days. Reaching the allowance starts an automatic laundry period; the garment becomes available with zero wears after the configured number of days (four by default). Tomorrow's suggestions preview these return dates without changing actual wear history. Laundry shows expected returns and lets you mark a piece back clean early, postpone a late return until tomorrow, or send a piece to the basket early. Clothes below their allowance stay partly worn even after a long gap; shoes and bags have no automatic laundry cycle.

Expected returns are estimates. Changing the turnaround or editing wear history recalculates them. An explicit clean return overrides the estimate; washing before logging today's outfit allows that wear to count, while washing after logging resets it.

For a clean top every other day, choose the starting date in Settings. The day’s “Clean top” checkbox overrides that schedule for that date.

Run `bun run test:planning-db` after generating the development environment and starting the local database. It creates and removes its own disposable database, applies the generated migrations, and checks planning, saved outfits, garment selection, forecast changes, and laundry with deterministic model and weather responses. It only accepts a localhost database connection.

## Family accounts

The configured GitHub account remains the administrator and owns the existing wardrobe. Sign in once and open **People** to create an invitation. Share its code directly; the recipient enters it at `/join` and registers a passkey. Codes expire after 24 hours, are stored only as hashes, and can be cancelled. To recover an account, issue a recovery code and verify the recipient yourself before sharing it. Redemption replaces their passkeys and revokes their existing sessions. Suspending access revokes sessions and outstanding codes immediately; restoring access retains the wardrobe.

Each person has a separate wardrobe, settings, location, daily notes, history, and proposals. Administrators can inspect wardrobes through a separate read-only view. Adding a passkey requires a sign-in within the last ten minutes. Passkeys are bound to the hostname in `BETTER_AUTH_URL`; changing that hostname requires registering credentials for the new hostname.

**People → Usage and costs** uses USD rates per million tokens defined in `src/shared/ai/api-prices.ts`, checked against official sources on 19 September 2026. Vertex Gemini 3.8 Flash uses [Google’s standard on-demand rates](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing): global input/output/cached input $0.75/$3.75/$0.075 through 31 December 2026 and $1.50/$7.50/$0.15 from 1 January 2027; regional rates are 10% higher. Output includes thinking tokens, and input covers all prompt modalities. Foundry GPT-Image-2.5 Flare uses explicitly labelled [OpenAI reference rates](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare): $5 text input, $8 image input, $30 image output. Microsoft has not yet published Foundry rates for this model, so the invoice may differ. Foundry cached input remains unknown because its modality split is unavailable. Each attempt snapshots the rates, source, and estimate basis; historical estimates are unchanged when code rates change. Unknown models, deployment aliases, incomplete usage, and interrupted requests stay unknown. Provider invoices remain authoritative.

## Authentication checks

`bun run test:family` exercises real PostgreSQL and Chromium WebAuthn registration, additional passkeys, recovery, suspension, account isolation, billing records, and accessibility of the new screens. It requires a dedicated local database named `rota_family`, configured through `config/dev.local.yaml` and generated with `bun standards dev-env`. Apply migrations and build first. The check creates and removes its own demo accounts and runs a temporary server on port 3211. `FAMILY_SCREENSHOT_DIR` optionally captures demo-only screenshots with access codes hidden.

`bun run test:oauth` checks the previous-schema migration and real Better Auth GitHub callbacks against an empty local database named `rota_oauth`. It uses the generated environment, replaces only GitHub HTTP transport with deterministic fixtures, and verifies existing-account reuse, new-account creation, encrypted tokens, session reads, and rejected identities/state. Recreate this disposable database before each run.
