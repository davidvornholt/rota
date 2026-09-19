# @rota/web

Setup and operations are in the [repository README](../../README.md).

Wear allowances count logged wears, including separate days. Reaching the allowance starts an automatic laundry period; the garment becomes available with zero wears after the configured number of days (four by default). Tomorrow's suggestions preview these return dates without changing actual wear history. Laundry shows expected returns and lets you mark a piece back clean early, postpone a late return until tomorrow, or send a piece to the basket early. Clothes below their allowance stay partly worn even after a long gap; shoes and bags have no automatic laundry cycle.

Expected returns are estimates. Changing the turnaround or editing wear history recalculates them. An explicit clean return overrides the estimate; washing before logging today's outfit allows that wear to count, while washing after logging resets it.

For a clean top every other day, choose the starting date in Settings. The day’s “Clean top” checkbox overrides that schedule for that date.

Run `bun run test:planning-db` after generating the development environment and starting the local database. It creates and removes its own disposable database, applies the generated migrations, and checks planning, saved outfits, garment selection, forecast changes, and laundry with deterministic model and weather responses. It only accepts a localhost database connection.
