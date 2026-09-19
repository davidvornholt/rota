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

**People → API prices** accepts USD rates per million tokens for the exact configured model or deployment name. Rates are snapshotted per API attempt. Vertex output includes thinking tokens; its input rate covers all prompt modalities. Foundry uses separate text-input, image-input, and image-output rates. These are estimates, not invoices: discounts, tiered pricing, missing provider metadata, and ambiguous timeouts may require reconciliation with the provider. Unknown amounts are never counted as free, and historical requests before tracking began cannot be attributed retroactively.

## Authentication checks

`bun run test:family` exercises real PostgreSQL and Chromium WebAuthn registration, additional passkeys, recovery, suspension, account isolation, billing records, and accessibility of the new screens. It requires a dedicated local database named `rota_family`, configured through `config/dev.local.yaml` and generated with `bun standards dev-env`. Apply migrations and build first. The check creates and removes its own demo accounts and runs a temporary server on port 3211. `FAMILY_SCREENSHOT_DIR` optionally captures demo-only screenshots with access codes hidden.
