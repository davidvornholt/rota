# @rota/web

Setup and operations are in the [repository README](../../README.md).

Wear allowances count logged wears between washes, including separate days. Rota cannot infer earlier washes from the old wear log: after upgrading, mark already-clean pieces washed in Laundry. Washing before logging today's outfit allows that wear to count; washing after logging it resets it. Shoes and bags have no wash allowance.

For a clean top every other day, choose the starting date in Settings. The day’s “Clean top” checkbox overrides that schedule for that date.

Run `bun run test:planning-db` after generating the development environment and starting the local database. It creates and removes its own disposable database, applies the generated migrations, and checks planning, saved outfits, garment selection, forecast changes, and laundry with deterministic model and weather responses. It only accepts a localhost database connection.
