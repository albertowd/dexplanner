/** Firebase web config from VITE_FIREBASE_* variables. These values are public by design. */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

/**
 * Whether this build has cloud sync. Vite replaces each variable at build time, so without them this
 * is the constant `false` and the Firebase code is left out of the bundle entirely.
 */
export const SYNC_BUILT_IN = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

export function readFirebaseConfig(env: Record<string, string | undefined> = import.meta.env): FirebaseConfig | null {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  return Object.values(config).every(Boolean) ? (config as FirebaseConfig) : null;
}
