import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeatherStrip } from '../src/features/rota/ui/weather-strip.tsx';
import { localDate } from '../src/shared/time/local-date.ts';

test('forecast hours stay visible and accessible at the configured viewport', async ({
  page,
}) => {
  // Render the real component with the built app's styles without requiring OAuth.
  await page.goto('/login');
  const styles = await page.locator('link').evaluateAll((links) =>
    links
      .filter((link) => link.getAttribute('rel') === 'stylesheet')
      .map((link) => link.outerHTML)
      .join(''),
  );
  expect(styles).not.toBe('');
  const date = localDate('2026-09-05');
  const strip = renderToStaticMarkup(
    createElement(WeatherStrip, {
      today: date,
      locationLabel: 'Berlin',
      stale: false,
      weather: {
        date,
        issuedOn: date,
        locationLabel: 'Berlin',
        startHour: 5,
        endHour: 20,
        high: 20,
        low: 12,
        precipitationProbability: 10,
        precipitationMm: 0,
        windKmh: 12,
        weatherCode: 1,
      },
    }),
  );
  await page.setContent(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Forecast</title>${styles}</head><body><main>${strip}</main></body></html>`,
  );
  await expect(
    page.getByRole('listitem').filter({ hasText: '05:00–20:00 local time' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await scanWcag22AaViolations(page)).toEqual([]);
});
