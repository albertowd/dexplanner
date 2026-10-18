import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Tests live in each package's test/ folder, never next to the sources.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        define: { __APP_VERSION__: JSON.stringify('0.0.0-test') },
        resolve: {
          alias: {
            // The PWA plugin's virtual module only exists in a Vite build.
            'virtual:pwa-register/react': here('./web/test/stubs/pwa-register.ts'),
          },
        },
        test: {
          name: 'web',
          root: here('./web'),
          environment: 'jsdom',
          include: ['test/**/*.test.{ts,tsx}'],
          setupFiles: ['test/setup.ts'],
        },
      },
      {
        test: {
          name: 'scripts',
          root: here('./scripts'),
          environment: 'node',
          include: ['test/**/*.test.mjs'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: here('./coverage'),
      include: ['web/src/**', 'scripts/lib/**'],
      exclude: ['web/src/main.tsx', 'web/src/types.ts', '**/*.d.ts'],
    },
  },
});
