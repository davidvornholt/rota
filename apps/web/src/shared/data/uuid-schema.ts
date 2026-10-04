import { Schema } from 'effect';

/** Any dashed hexadecimal identifier, as Postgres prints a `uuid`. */
export const UuidSchema = Schema.String.check(Schema.isGUID());
