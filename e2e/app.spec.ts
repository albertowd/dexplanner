import { expect, openDex, pick, test } from './fixtures.ts';

test.describe('Pokédex list', () => {
  test('shows every species, the project icon and the version', async ({ page }) => {
    await openDex(page);
    await expect(page.getByText('1025 Pokémon')).toBeVisible();
    await expect(page.locator('.brand img')).toHaveAttribute('src', '/icons/icon.svg');
    await expect(page.getByRole('contentinfo')).toHaveText(/^PokePlan v\d+\.\d+\.\d+$/);
  });

  test('searches by name and number', async ({ page }) => {
    await openDex(page);
    const search = page.getByRole('searchbox', { name: 'Search' });
    await search.fill('pikachu');
    await expect(page.getByText('1 Pokémon')).toBeVisible();
    await search.fill('#1007');
    await expect(page.locator('.card .name')).toHaveText(['Koraidon']);
  });

  test('combines several games and DLC in the filter', async ({ page }) => {
    await openDex(page);
    await pick(page, 'Obtainable in', 'The Teal Mask (SV DLC part 1)');
    const tealMask = Number((await page.getByText(/^\d+ Pokémon$/).textContent())!.split(' ')[0]);
    await pick(page, 'Obtainable in', 'The Indigo Disk (SV DLC part 2)');
    const both = Number((await page.getByText(/^\d+ Pokémon$/).textContent())!.split(' ')[0]);
    expect(tealMask).toBeGreaterThan(100);
    expect(both).toBeGreaterThan(tealMask);
    await expect(page.getByLabel(/^Obtainable in:/)).toHaveAccessibleName('Obtainable in: 2 games');
  });

  test('renders the list in batches while scrolling', async ({ page }) => {
    await openDex(page);
    const cards = page.locator('.card');
    const first = await cards.count();
    expect(first).toBeLessThan(1025);
    await page.locator('.card').last().scrollIntoViewIfNeeded();
    await expect.poll(() => cards.count()).toBeGreaterThan(first);
    await page.keyboard.press('End');
    await expect.poll(async () => {
      await page.keyboard.press('End');
      return cards.count();
    }, { timeout: 15_000 }).toBe(1025);
  });

  test('remembers registered Pokémon after a reload', async ({ page }) => {
    await openDex(page);
    await page.getByRole('button', { name: 'Mark Bulbasaur as registered' }).click();
    await expect(page.getByText('1/1025')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unmark Bulbasaur' })).toBeVisible();
  });
});

test.describe('Pokémon details', () => {
  test('opens from the list and closes with Escape', async ({ page }) => {
    await openDex(page);
    await page.getByRole('searchbox', { name: 'Search' }).fill('tyranitar');
    await page.getByRole('link', { name: /Tyranitar/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Tyranitar' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Best way to get it into HOME' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('can be opened from a shared link', async ({ page }) => {
    await page.goto('/#/p/1007');
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Koraidon' })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Scarlet only').first()).toBeVisible();
  });
});

test.describe('Plan and settings', () => {
  test('builds a plan and updates it when games are owned', async ({ page }) => {
    await openDex(page, '/#/plan');
    await expect(page.getByText('1025 Pokémon missing.', { exact: false })).toBeVisible();
    await expect(page.locator('.steps > li')).not.toHaveCount(0);

    await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('checkbox', { name: /Pokémon Legends: Z-A/ }).check();
    await page.getByRole('navigation').getByRole('link', { name: 'Plan' }).click();
    await expect(page.locator('.steps > li').first()).toContainText('Owned');
  });

  test('marks everything as registered', async ({ page }) => {
    await openDex(page, '/#/settings');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Mark all as registered' }).click();
    await expect(page.getByText('1025/1025')).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Plan' }).click();
    await expect(page.getByText(/Pokédex is complete/)).toBeVisible();
  });
});

test.describe('Layout', () => {
  for (const path of ['/', '/#/plan', '/#/settings', '/#/p/248']) {
    test(`has no horizontal scrolling on ${path}`, async ({ page }) => {
      await openDex(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
