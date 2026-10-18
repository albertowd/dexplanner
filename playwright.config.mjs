import { defineConfig, devices } from '@playwright/test';

const port = 4173;

// End-to-end tests run against the production build (vite preview) so the service worker is real.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'reports/playwright/results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright/html', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    cwd: 'web',
    command: `npx vite build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
