#!/usr/bin/env node
// Records a short feature tour of the live site on desktop and mobile and converts it to animated
// WebP for the README (GitHub plays animated images inline; video files committed to a repo don't).
// Usage: node scripts/showcase.mjs [--url=https://pokeplan.albertowd.dev]
// Needs `npx playwright install chromium`; ffmpeg comes from the ffmpeg-static package.
import { chromium, devices } from '@playwright/test';
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs');
const urlArg = process.argv.find((a) => a.startsWith('--url='));
const site = urlArg ? urlArg.slice('--url='.length) : 'https://pokeplan.albertowd.dev';

// Start from realistic progress so the counters and plan look like a real user's.
const state = {
  v: 1,
  registered: Array.from({ length: 151 }, (_, i) => i + 1),
  owned: ['swsh'],
  showRetro: false,
};

const profiles = {
  desktop: { options: { viewport: { width: 1280, height: 720 } }, width: 960 },
  mobile: { options: { ...devices['Pixel 7'] }, width: 360 },
};

// Playwright videos have no cursor: draw one that follows the mouse and pulses on click.
const cursorScript = () => {
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText =
      'position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'background:rgb(239 75 95 / 0.55);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px;' +
      'transition:transform .15s';
    document.body.append(dot);
    addEventListener('mousemove', (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    });
    addEventListener('mousedown', () => (dot.style.transform = 'scale(0.6)'));
    addEventListener('mouseup', () => (dot.style.transform = 'scale(1)'));
  });
};

async function imagesSettled(page) {
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('img')].every((i) => {
          // checkVisibility() also excludes content of closed <details> (hidden with content-visibility).
          const r = i.getBoundingClientRect();
          const onScreen = i.checkVisibility() && r.bottom > 0 && r.top < innerHeight;
          return !onScreen || (i.complete && i.naturalWidth > 0);
        }),
      null,
      { timeout: 20_000 },
    )
    .catch(() => {}); // a slow sprite should not abort the recording
}

/** Moves the visible cursor to the element, then clicks it. */
async function click(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.mouse.up();
}

/** Runs the tour; returns the seconds spent loading, to trim from the start of the video. */
async function tour(page, startedAt) {
  const pause = (ms = 1200) => page.waitForTimeout(ms);
  await page.goto(`${site}/`);
  await page.getByText(/^\d+\/\d+$/).waitFor();
  await page.addStyleTag({ content: '.toast { display: none !important; }' });
  await imagesSettled(page);
  const loadedAfter = (Date.now() - startedAt) / 1000;
  await pause(1500);

  // Search.
  const search = page.getByRole('searchbox', { name: 'Search' });
  await click(page, search);
  await search.pressSequentially('eevee', { delay: 120 });
  await imagesSettled(page);
  await pause();
  await search.fill('');

  // Filter: missing Pokémon in Scarlet/Violet and its DLC.
  await page.getByLabel('Status').selectOption('missing');
  await click(page, page.getByLabel(/^Obtainable in:/));
  await pause(600);
  for (const name of ['Pokémon Scarlet / Violet', 'The Teal Mask (SV DLC part 1)', 'The Indigo Disk (SV DLC part 2)']) {
    await click(page, page.getByRole('checkbox', { name }));
    await pause(400);
  }
  await page.keyboard.press('Escape');
  await imagesSettled(page);
  await pause(1500);

  // Details: where to get it and how it reaches HOME.
  await click(page, page.locator('.card-link').first());
  await imagesSettled(page);
  await pause(1800);
  await page.mouse.wheel(0, 400);
  await pause(1500);
  await page.keyboard.press('Escape');
  await pause(600);

  // Mark it as registered.
  await click(page, page.locator('.card .check').first());
  await pause(1000);

  // Plan: what to play or buy next.
  await click(page, page.getByRole('navigation').getByRole('link', { name: 'Plan' }));
  await pause(800);
  await click(page, page.locator('.steps > li summary').nth(1));
  await imagesSettled(page);
  await pause(2000);

  // Settings: owned games and mark-all.
  await click(page, page.getByRole('navigation').getByRole('link', { name: 'Settings' }));
  await pause(1200);
  await click(page, page.getByRole('checkbox', { name: /Pokémon Scarlet \/ Violet/ }));
  await pause(800);
  await page.getByRole('heading', { name: 'Pokémon HOME sync' }).scrollIntoViewIfNeeded();
  await pause(1800);
  return loadedAfter;
}

function toWebp(video, target, width, skipSeconds) {
  const result = spawnSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-ss', skipSeconds.toFixed(2), '-i', video, '-vf', `fps=12,scale=${width}:-1:flags=lanczos`,
      '-loop', '0', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '55', '-compression_level', '6', target],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${target}`);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, profile] of Object.entries(profiles)) {
    const videoDir = mkdtempSync(path.join(tmpdir(), 'dexplanner-showcase-'));
    const size = profile.options.viewport;
    const startedAt = Date.now();
    const context = await browser.newContext({
      ...profile.options,
      colorScheme: 'dark',
      recordVideo: { dir: videoDir, size },
    });
    await context.addInitScript((s) => localStorage.setItem('dexplanner:v1', JSON.stringify(s)), state);
    await context.addInitScript(cursorScript);
    const page = await context.newPage();
    const loadedAfter = await tour(page, startedAt);
    await context.close(); // flushes the video
    const video = path.join(videoDir, readdirSync(videoDir).find((f) => f.endsWith('.webm')));
    const target = path.join(outDir, `showcase-${name}.webp`);
    toWebp(video, target, profile.width, Math.max(0, loadedAfter - 0.3));
    rmSync(videoDir, { recursive: true, force: true });
    console.log(`${path.relative(root, target)}: ${(statSync(target).size / 1024 / 1024).toFixed(1)} MB`);
  }
} finally {
  await browser.close();
}
