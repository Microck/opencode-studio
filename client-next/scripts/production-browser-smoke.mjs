import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// The container is populated with a synthetic config by CI; no user data or
// model calls are involved. Keep Chromium's sandbox enabled.
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const configResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/config' && response.status() === 200,
  );
  await page.goto('http://127.0.0.1:3300/', { waitUntil: 'domcontentloaded' });
  await configResponse;
  await page.locator('#main-content').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('a[href="/skills"]').click();
  await page.waitForURL('**/skills');
  await page.locator('#main-content').waitFor({ state: 'visible' });
  assert.deepEqual(errors, [], 'Unexpected browser page errors');
  console.log('Production browser loaded config and navigated to Skills.');
} finally {
  await browser.close();
}
