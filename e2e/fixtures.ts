import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Sprites come from GitHub at runtime; serve a local image instead so tests are fast and offline-safe.
const placeholder = readFileSync(new URL('../web/public/icons/icon-192.png', import.meta.url));

export const test = base.extend({
  // Routed on the context so requests made by the service worker are intercepted too.
  context: async ({ context }, use) => {
    await context.route('https://raw.githubusercontent.com/**', (route) =>
      route.fulfill({ contentType: 'image/png', body: placeholder, headers: { 'access-control-allow-origin': '*' } }),
    );
    await use(context);
  },
});

export { expect };

/** Opens a view and waits until the Pokédex data has loaded (the header shows progress). */
export async function openDex(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByText(/^\d+\/\d+$/)).toBeVisible();
}

/** Opens a filter dropdown (if closed) and toggles one checkbox. */
export async function pick(page: Page, filter: string, option: string) {
  const summary = page.getByLabel(new RegExp(`^${filter}:`));
  const open = await summary.evaluate((el) => (el.parentElement as HTMLDetailsElement).open);
  if (!open) await summary.click();
  await page.getByRole('checkbox', { name: option, exact: true }).click();
}
