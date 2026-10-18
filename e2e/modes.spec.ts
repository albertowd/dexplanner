import { expect, openDex, test } from './fixtures.ts';

test.describe('Shiny and living dex', () => {
  test('living dex lists every form and is remembered after a reload', async ({ page }) => {
    await openDex(page);
    await page.getByRole('button', { name: /Living dex/ }).click();
    await expect(page.getByText(/^\d+ entries$/)).toBeVisible();
    const total = Number((await page.getByText(/^\d+ entries$/).textContent())!.split(' ')[0]);
    expect(total).toBeGreaterThan(1500);
    await expect(page.getByText(new RegExp(`^0/${total}$`))).toBeVisible();

    await page.getByRole('searchbox').fill('vulpix');
    await expect(page.locator('.card .form-name')).toHaveText(['Alolan Form']);
    await page.getByRole('button', { name: 'Mark Vulpix · Alolan Form as registered' }).click();
    await expect(page.getByText(new RegExp(`^1/${total}$`))).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Living dex/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(new RegExp(`^1/${total}$`))).toBeVisible();
  });

  test('shiny mode shows shiny sprites and tracks shinies separately', async ({ page }) => {
    await openDex(page);
    await page.getByRole('button', { name: 'Mark Bulbasaur as registered' }).click();
    await page.getByRole('button', { name: /Shiny/ }).click();
    await expect(page.locator('.card img').first()).toHaveAttribute('src', /\/shiny\/1\.png$/);
    await expect(page.getByText(/^✨ 0\/1025$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark Bulbasaur as registered' })).toBeVisible();
  });

  test('details list the forms of a Pokémon', async ({ page }) => {
    await page.goto('/#/p/201');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /^Forms \(\d+\)$/ })).toBeVisible();
    await expect(dialog.locator('.forms-list li')).toHaveCount(27);
  });

  for (const path of ['/', '/#/p/25']) {
    test(`has no horizontal scrolling in shiny living dex mode on ${path}`, async ({ page }) => {
      await openDex(page, path);
      await page.evaluate(() => localStorage.setItem('dexplanner:mode', '{"shiny":true,"living":true}'));
      await page.reload();
      await expect(page.getByText(/^✨ \d+\/\d+$/)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
