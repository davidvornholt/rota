// Playwright starts one fixture server for the whole run (see
// playwright.config.ts). No dev server or other app's accessibility suite uses
// this port.
export const fixturePort = 3111;
export const fixtureOrigin = `http://127.0.0.1:${fixturePort}/`;
export const fixtureReadyPath = '/__a11y-fixtures-ready';
