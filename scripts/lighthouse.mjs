#!/usr/bin/env node
// Audits the production build with Lighthouse on mobile and desktop presets.
// Usage: node scripts/lighthouse.mjs [--min=0.9]
// Builds web/, serves it with Vite's preview server, writes HTML reports to reports/lighthouse/ and exits
// with code 1 when any category scores below the minimum. (Lighthouse 12+ has no PWA category; the PWA
// behaviour is covered by the Playwright tests in e2e/pwa.spec.ts.)
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { build, preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'web');
const outDir = path.join(root, 'reports', 'lighthouse');
const port = 4175;
const url = `http://localhost:${port}/`;
const minArg = process.argv.find((a) => a.startsWith('--min='));
const minScore = minArg ? Number(minArg.split('=')[1]) : 0.9;
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

function failingAudits(lhr) {
  const lines = [];
  for (const id of categories) {
    for (const ref of lhr.categories[id].auditRefs) {
      const audit = lhr.audits[ref.id];
      if (ref.weight > 0 && audit.score !== null && audit.score < 1) {
        const value = audit.displayValue ? ` (${audit.displayValue})` : '';
        lines.push(`    - [${id}] ${audit.title}${value}`);
      }
    }
  }
  return lines;
}

async function audit(chrome, name, config) {
  const { lhr, report } = await lighthouse(
    url,
    { port: chrome.port, output: 'html', onlyCategories: categories, logLevel: 'error' },
    config,
  );
  writeFileSync(path.join(outDir, `${name}.html`), report);
  const scores = Object.fromEntries(categories.map((c) => [c, lhr.categories[c].score]));
  const summary = categories.map((c) => `${c} ${Math.round(scores[c] * 100)}`).join('  ');
  console.log(`\n${name}: ${summary}`);
  const failing = failingAudits(lhr);
  if (failing.length) console.log(`  Not passing:\n${failing.join('\n')}`);
  return Object.values(scores).every((s) => s >= minScore);
}

await build({ root: webDir, logLevel: 'warn' });
mkdirSync(outDir, { recursive: true });
const server = await preview({ root: webDir, logLevel: 'warn', preview: { port, strictPort: true } });
let chrome;
try {
  chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const mobileOk = await audit(chrome, 'mobile');
  const desktopOk = await audit(chrome, 'desktop', desktopConfig);
  console.log(`\nReports: ${path.relative(root, outDir)}${path.sep}{mobile,desktop}.html  (minimum score ${minScore * 100})`);
  if (!mobileOk || !desktopOk) process.exitCode = 1;
} finally {
  chrome?.kill();
  await server.close();
}
