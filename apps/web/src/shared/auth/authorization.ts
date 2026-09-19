import type {
  ValidateUserInfoResult,
  ValidateUserInfoSource,
} from 'better-auth';

const githubProviderId = 'github';

/**
 * better-auth puts this code straight into the sign-in redirect as `?error=`,
 * so it has to stay URL-safe and stable.
 */
const accountNotAllowed: ValidateUserInfoResult = {
  error: 'account_not_allowed',
  errorDescription: 'This application is private.',
};

/** The provider profile is untrusted input, so only a scalar `id` counts. */
const providerAccountId = (profile: Record<string, unknown> | undefined) => {
  const id = profile?.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
};

/**
 * The single gate on who may sign in. better-auth runs it before it creates a
 * user, before it links a provider account, and again on every returning OAuth
 * sign-in, so narrowing the allowed account takes effect on the next attempt
 * rather than only at first link. Returning a result makes better-auth abort
 * before any row is written and redirect the browser to the sign-in page with
 * the code below, instead of rendering a raw JSON error on the callback URL.
 *
 * Anything that is not GitHub OAuth is rejected: this app admits exactly one
 * GitHub account and has no other way in.
 */
export const createGitHubAccountGate =
  (allowedAccountId: string) =>
  ({ source }: { readonly source: ValidateUserInfoSource }) => {
    if (source.method !== 'oauth') {
      return accountNotAllowed;
    }
    const { oauth } = source;
    if (oauth === undefined || oauth.providerId !== githubProviderId) {
      return accountNotAllowed;
    }
    return providerAccountId(oauth.profile) === allowedAccountId
      ? undefined
      : accountNotAllowed;
  };
