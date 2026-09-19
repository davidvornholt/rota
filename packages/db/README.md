# @rota/db

See [source](src/) for the package API and [repository setup](../../README.md) for development.

The family-account migration first assigns existing rows to the administrator's `personal` wardrobe, then removes that migration-only default and makes daily keys unique per wardrobe. Drizzle Kit 0.31.10 leaves inline PostgreSQL primary-key drops as comments. The Bun patch is limited to the two constraint names established by `0000_initial.sql`, allowing the follow-up migration to remain generated. Keep it until the generator can emit these drops itself.
