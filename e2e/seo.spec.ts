import { expect, test } from './fixtures.ts';

test.describe('Search engines and link previews', () => {
  test('robots.txt welcomes search engines and asks AI crawlers to stay away', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/User-agent: \*\nAllow: \//);
    for (const bot of ['GPTBot', 'CCBot', 'Google-Extended', 'Bytespider']) expect(robots).toContain(`User-agent: ${bot}`);
    expect(robots).toMatch(/User-agent: Kangaroo Bot\nDisallow: \//);
    expect(robots).not.toContain('Googlebot');
    expect(robots).toMatch(/Sitemap: https:\/\/.+\/sitemap\.xml/);
  });

  test('sitemap.xml lists the site', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).toMatch(/<loc>https:\/\/[^<]+\/<\/loc>/);
  });

  test('pages carry a canonical link and preview tags with absolute URLs', async ({ page, request }) => {
    await page.goto('/');
    const meta = (selector: string) => page.locator(selector).getAttribute('content');
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(/^https:\/\/.+\/$/);
    expect(await meta('meta[property="og:title"]')).toBe("DexPlanner – Let's catch them all");
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    const image = await meta('meta[property="og:image"]');
    expect(image).toMatch(/^https:\/\/.+\/og-image\.png$/);
    const local = await request.get('/og-image.png');
    expect(local.ok()).toBe(true);
    expect(local.headers()['content-type']).toContain('image/png');
  });
});
