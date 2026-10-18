import { expect, openDex, test } from './fixtures.ts';

test.describe('Brazilian Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('follows the browser language for the interface and the data', async ({ page }) => {
    await openDex(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Configurações' })).toBeVisible();
    await expect(page.getByText('1025 Pokémon')).toBeVisible();

    await page.goto('/#/p/801');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Melhor forma de levar para o HOME' })).toBeVisible();
    await expect(dialog.getByText('Recompensas do Pokémon HOME').first()).toBeVisible();
    await expect(dialog.getByText(/Magearna de Cor Original ao completar a Pokédex Nacional/).first()).toBeVisible();
  });

  test('can switch to English from the header flag menu, and it is remembered', async ({ page }) => {
    await openDex(page, '/#/settings');
    await page.getByLabel('Idioma: Português (Brasil)').click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Games you own' })).toBeVisible();
    await expect(page.getByLabel('Language: English')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  for (const path of ['/', '/#/plan', '/#/settings', '/#/p/248']) {
    test(`has no horizontal scrolling on ${path}`, async ({ page }) => {
      await openDex(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

const others = [
  { locale: 'es-ES', settings: 'Ajustes', game: 'Escarlata' },
  { locale: 'it-IT', settings: 'Impostazioni', game: 'Scarlatto' },
  { locale: 'ja-JP', settings: '設定', game: 'スカーレット' },
];

for (const { locale, settings, game } of others) {
  test.describe(`${locale}`, () => {
    test.use({ locale });

    test('detects the language and translates the data', async ({ page }) => {
      await openDex(page, '/#/p/1007');
      await expect(page.getByRole('navigation').getByRole('link', { name: settings })).toBeVisible();
      await expect(page.getByRole('dialog').getByText(game).first()).toBeVisible();
    });

    for (const path of ['/', '/#/plan', '/#/settings', '/#/p/248']) {
      test(`has no horizontal scrolling on ${path}`, async ({ page }) => {
        await openDex(page, path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('Japanese Pokémon names', () => {
  test.use({ locale: 'ja-JP' });

  test('shows Japanese names and still finds Pokémon by their English name', async ({ page }) => {
    await openDex(page);
    await expect(page.locator('.card .name').first()).toHaveText('フシギダネ');
    await page.getByRole('searchbox').fill('pikachu');
    await expect(page.locator('.card .name')).toHaveText(['ピカチュウ']);
  });
});
