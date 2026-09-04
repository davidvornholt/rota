/**
 * A router link that never announces itself as the current page.
 *
 * TanStack Router's `Link` marks a link to the current URL with
 * `aria-current="page"`, a `data-status="active"` attribute, and its default
 * `active` class, and it applies all three after the caller's own props, so
 * they cannot be switched off through `activeProps` alone. That marking is
 * right for a nav item, which tells the reader where they are among the other
 * items, and wrong for a link offered as an action: the wordmark in the header
 * and the way back on a fallback page both point at "/", so on the home page
 * they would announce themselves as the current page beside the nav item that
 * really is one. `createLink` keeps the router's navigation and preloading but
 * hands the computed props to this host anchor, which is where the markers
 * come off.
 *
 * Callers still pass `activeProps={{ className: '' }}`: the resolved class list
 * is caller + active + inactive, and an unset `activeProps` falls back to the
 * router's own `active` class.
 */

import { createLink } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

export const UnmarkedLink = createLink(
  ({
    'aria-current': _ariaCurrent,
    'data-status': _dataStatus,
    children,
    ...anchorProps
  }: ComponentProps<'a'> & { readonly 'data-status'?: string }) => (
    <a {...anchorProps}>{children}</a>
  ),
);
