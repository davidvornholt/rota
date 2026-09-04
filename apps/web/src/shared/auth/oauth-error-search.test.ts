import { describe, expect, it } from 'bun:test';

import { parseOAuthErrorSearch } from './oauth-error-search.ts';

const searchFrom = (queryString: string) =>
  Object.fromEntries(new URLSearchParams(queryString));

describe('OAuth callback error search', () => {
  it('reads the error code better-auth appends', () => {
    expect(parseOAuthErrorSearch(searchFrom('error=access_denied'))).toEqual({
      error: 'access_denied',
    });
  });

  it('keeps only the error code from a full callback query string', () => {
    expect(
      parseOAuthErrorSearch(
        searchFrom('error=invalid_code&error_description=Nope'),
      ),
    ).toEqual({ error: 'invalid_code' });
  });

  it('reads a plain sign-in link as no error', () => {
    expect(parseOAuthErrorSearch({})).toEqual({});
  });

  it('reads junk as no error instead of failing the route', () => {
    expect(parseOAuthErrorSearch({ error: 42 })).toEqual({});
    expect(parseOAuthErrorSearch({ error: ['access_denied'] })).toEqual({});
    expect(parseOAuthErrorSearch('error=access_denied')).toEqual({});
    expect(parseOAuthErrorSearch(null)).toEqual({});
  });
});
