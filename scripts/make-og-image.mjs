#!/usr/bin/env node
// Renders the 1200×630 link-preview image (web/public/og-image.png) from the app's own icon and text.
// Usage: node scripts/make-og-image.mjs  (needs `npx playwright install chromium`)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icon = readFileSync(path.join(root, 'web', 'public', 'icons', 'icon.svg'), 'utf8');
const out = path.join(root, 'web', 'public', 'og-image.png');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center; gap: 64px; padding: 0 96px;
    box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; color: #e9ebf0;
    background: radial-gradient(circle at 85% 20%, #3a1520 0, transparent 45%), #111318; }
  .icon svg { width: 260px; height: 260px; filter: drop-shadow(0 18px 40px rgb(0 0 0 / .5)); }
  h1 { margin: 0; font-size: 104px; letter-spacing: -2px; }
  h2 { margin: 6px 0 28px; font-size: 46px; font-weight: 600; color: #ef4b5f; }
  p { margin: 0; font-size: 30px; line-height: 1.4; color: #9aa1ae; max-width: 640px; }
</style></head><body>
  <div class="icon">${icon}</div>
  <div><h1>DexPlanner</h1><h2>Let's catch them all</h2>
  <p>Track your Pokémon HOME Pokédex and find which game, DLC or event gives you each missing Pokémon.</p></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${path.relative(root, out)}`);
