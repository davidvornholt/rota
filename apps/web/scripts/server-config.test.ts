import { describe, expect, it } from 'bun:test';

import { parsePort } from './server-config.ts';

const defaultPort = 3000;
const validPort = 8080;

describe('parsePort', () => {
  it('uses the default when PORT is absent', () => {
    expect(parsePort(undefined)).toBe(defaultPort);
  });

  it.each(['', '   '])('treats PORT=%p as unset', (value) => {
    expect(parsePort(value)).toBe(defaultPort);
  });

  it('accepts a valid override', () => {
    expect(parsePort(String(validPort))).toBe(validPort);
  });

  it.each([
    'abc',
    '1.5',
    '0',
    '-1',
    '65536',
    // JS numeric-literal spellings a coercing parser would accept.
    '0x1f5',
    '1e3',
    '0080',
    '+8080',
    ' 8080 ',
  ])('rejects invalid PORT=%p', (value) => {
    expect(() => parsePort(value)).toThrow(
      'expected digits forming an integer between 1 and 65535',
    );
  });
});
