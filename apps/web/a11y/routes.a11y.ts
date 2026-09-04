import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';

/**
 * Only the unauthenticated surface is scannable: sign-in runs exclusively
 * through GitHub OAuth, so the signed-in pages cannot be reached here. "/" is
 * listed anyway because the redirect to /login should be covered too.
 *
 * Every route carries the status, the landing path, and the heading that
 * identify it, because a scan of the wrong page still passes. The not-found
 * path has to prove it reached the themed not-found page with an HTTP 404.
 */
const routes = [
  {
    name: 'Sign in',
    path: '/login',
    landsOn: '/login',
    status: 200,
    heading: 'Rota',
  },
  {
    name: 'Home (redirects to /login)',
    path: '/',
    landsOn: '/login',
    status: 200,
    heading: 'Rota',
  },
  {
    name: 'Not found',
    path: '/this-page-does-not-exist',
    landsOn: '/this-page-does-not-exist',
    status: 404,
    heading: 'Page not found',
  },
] as const;

for (const route of routes) {
  test(`${route.name} has no automated WCAG 2.2 AA violations`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(route.path);

    expect(response?.status()).toBe(route.status);
    expect(new URL(page.url()).pathname).toBe(route.landsOn);
    await expect(
      page.getByRole('heading', { level: 1, name: route.heading }),
    ).toBeVisible();
    // A page gets exactly one main landmark. Duplicate-landmark rules are
    // axe best-practice rather than WCAG, so the scan below cannot see a
    // second one.
    await expect(page.locator('main')).toHaveCount(1);
    expect(await scanWcag22AaViolations(page)).toEqual([]);
  });
}
