# @rota/web

Setup and operations are in the [repository README](../../README.md).

## Family accounts

The configured GitHub account remains the administrator and owns the existing wardrobe. Sign in once and open **People** to create an invitation. Share its code directly; the recipient enters it at `/join` and registers a passkey. Codes expire after 24 hours, are stored only as hashes, and can be cancelled. To recover an account, issue a recovery code and verify the recipient yourself before sharing it. Redemption replaces their passkeys and revokes their existing sessions. Suspending access revokes sessions and outstanding codes immediately; restoring access retains the wardrobe.

Each person has a separate wardrobe, settings, location, daily notes, history, and proposals. Administrators can inspect wardrobes through a separate read-only view. Adding a passkey requires a sign-in within the last ten minutes. Passkeys are bound to the hostname in `BETTER_AUTH_URL`; changing that hostname requires registering credentials for the new hostname.

**People → API prices** accepts USD rates per million tokens for the exact configured model or deployment name. Rates are snapshotted per API attempt. Vertex output includes thinking tokens; its input rate covers all prompt modalities. Foundry uses separate text-input, image-input, and image-output rates. These are estimates, not invoices: discounts, tiered pricing, missing provider metadata, and ambiguous timeouts may require reconciliation with the provider. Unknown amounts are never counted as free, and historical requests before tracking began cannot be attributed retroactively.

## Authentication checks

`bun run test:family` exercises real PostgreSQL and Chromium WebAuthn registration, additional passkeys, recovery, suspension, account isolation, billing records, and accessibility of the new screens. It requires a dedicated local database named `rota_family`, configured through `config/dev.local.yaml` and generated with `bun standards dev-env`. Apply migrations and build first. The check creates and removes its own demo accounts and runs a temporary server on port 3211. `FAMILY_SCREENSHOT_DIR` optionally captures demo-only screenshots with access codes hidden.
