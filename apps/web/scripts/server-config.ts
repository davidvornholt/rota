import { z } from 'zod';

const defaultPort = 3000;
const minimumPort = 1;
const maximumPort = 65_535;
// Plain decimal digits only, no leading zero: `0x1f5`, `1e3`, and `0080` are
// JS numeric literals, not the port an operator wrote down. The same shape as
// GITHUB_ALLOWED_ACCOUNT_ID in src/shared/env.ts.
const decimalDigits = /^[1-9]\d*$/u;
const portSchema = z
  .string()
  .regex(decimalDigits)
  .transform(Number)
  .pipe(z.int().min(minimumPort).max(maximumPort));

export const parsePort = (value: unknown): number => {
  // An exported but empty PORT means unset, the way src/shared/env.ts reads
  // every other value in this process.
  const blank = typeof value === 'string' && value.trim().length === 0;
  if (value === undefined || blank) {
    return defaultPort;
  }
  const result = portSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid PORT: expected digits forming an integer between 1 and 65535. ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};
