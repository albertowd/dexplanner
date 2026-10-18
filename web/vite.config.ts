import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// The project version lives in the root package.json.
import rootPackage from '../package.json' with { type: 'json' };

const FIREBASE_VARS = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const NO_FIREBASE = '\0dexplanner-no-firebase';

/** Cloud sync is optional: without the Firebase variables, the Firebase adapter (and SDK) isn't built at all. */
function optionalCloudSync(): Plugin {
  let builtIn = true;
  return {
    name: 'dexplanner-optional-cloud-sync',
    enforce: 'pre',
    configResolved(config) {
      builtIn = FIREBASE_VARS.every((key) => config.env[key]);
    },
    resolveId(id, importer) {
      if (!builtIn && id === './firebase.ts' && importer && /[\\/]sync[\\/]controller\.ts$/.test(importer)) return NO_FIREBASE;
      return null;
    },
    load(id) {
      if (id !== NO_FIREBASE) return null;
      return 'export function createFirebase() { throw new Error("Cloud sync is not part of this build."); }';
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(rootPackage.version) },
  plugins: [
    optionalCloudSync(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: "DexPlanner – Let's catch them all",
        short_name: 'DexPlanner',
        description:
          'Track your Pokémon HOME Pokédex and find which game, DLC or event gives you each missing Pokémon.',
        theme_color: '#d7263d',
        background_color: '#111318',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Firebase is only needed after signing in: cache it on first use instead of for everyone.
        globIgnores: ['**/firebase-*.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/firebase-'),
            handler: 'CacheFirst',
            options: { cacheName: 'firebase-sdk', expiration: { maxEntries: 4 } },
          },
          {
            // Pokédex data: show cached data offline, refresh in the background.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pokedex-data' },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/PokeAPI/sprites/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pokemon-sprites',
              expiration: { maxEntries: 2500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              // Images are requested with CORS (GitHub allows it), so only real 200s are cached;
              // opaque responses would count ~7 MB each against the storage quota.
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
});
