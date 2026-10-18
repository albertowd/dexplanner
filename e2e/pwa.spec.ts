import { expect, openDex, test } from './fixtures.ts';

test.describe('PWA', () => {
  test('has an installable web app manifest', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ name: "DexPlanner – Let's catch them all", short_name: 'DexPlanner', display: 'standalone', start_url: '/' });
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test('registers a service worker that takes control', async ({ page }) => {
    await openDex(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/$/);
  });

  test('caches sprites as CORS responses, not opaque ones', async ({ page }) => {
    await openDex(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(page.locator('.card img').first()).toBeVisible();
    const readCache = () =>
      page.evaluate(async () => {
        const cache = await caches.open('pokemon-sprites');
        const responses = await Promise.all((await cache.keys()).map((request) => cache.match(request)));
        return responses.map((r) => ({ type: r!.type, status: r!.status }));
      });
    // The service worker stores responses shortly after the images appear.
    await expect.poll(async () => (await readCache()).length).toBeGreaterThan(0);
    const cached = await readCache();
    expect(cached.every((r) => r.type === 'cors' && r.status === 200)).toBe(true);
  });

  test('works offline after the first visit', async ({ page, context }) => {
    await openDex(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The first load happened before the worker controlled the page; reload once so the data is cached.
    await page.reload();
    await expect(page.getByText('1025 Pokémon')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('1025 Pokémon')).toBeVisible();
    await page.goto('/#/plan');
    await expect(page.getByText('1025 Pokémon missing.', { exact: false })).toBeVisible();
    await context.setOffline(false);
  });
});
