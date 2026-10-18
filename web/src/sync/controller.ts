import { useSyncExternalStore } from 'react';
import { getState, replaceState, subscribeChanges } from '../store.ts';
import { readFirebaseConfig, SYNC_BUILT_IN, type FirebaseConfig } from './config.ts';
import { createSyncEngine, type SyncEngine, type SyncSnapshot } from './engine.ts';
import type { FirebaseClient, SyncUser } from './firebase.ts';

/** Outcome to show the trainer; the UI translates the key. */
export type SyncMessage =
  | { key: 'cancelled' | 'blocked' | 'signedOut' | 'deleted' }
  | { key: 'error'; detail: string };

export interface SyncState {
  /** Sync is configured for this deployment (Firebase env vars are set). */
  available: boolean;
  user: SyncUser | null;
  /** A sign-in, sign-out or delete is in progress. */
  busy: boolean;
  sync: SyncSnapshot;
  message: SyncMessage | null;
}

interface ControllerOptions {
  config: FirebaseConfig | null;
  /** Loads the Firebase client; injectable for tests. */
  load?: (config: FirebaseConfig) => Promise<FirebaseClient>;
  storage?: Storage;
  /** Minimum time between pulls triggered by the tab regaining focus. */
  pullIntervalMs?: number;
}

/** Set after a sign-in so the next visit restores the session (and only then loads Firebase). */
const ENABLED_KEY = 'pokeplan:sync-enabled';

const errorMessage = (error: unknown): SyncMessage => {
  const code = (error as { code?: string }).code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return { key: 'cancelled' };
  if (code === 'auth/popup-blocked') return { key: 'blocked' };
  return { key: 'error', detail: error instanceof Error ? error.message : String(error) };
};

// Only builds with the Firebase variables reference the SDK; others drop this import at build time.
const loadFirebase = SYNC_BUILT_IN
  ? async (c: FirebaseConfig) => (await import('./firebase.ts')).createFirebase(c)
  : () => Promise.reject(new Error('Cloud sync is not part of this build.'));

export function createSyncController({
  config,
  load = loadFirebase,
  storage = globalThis.localStorage,
  pullIntervalMs = 60_000,
}: ControllerOptions) {
  let state: SyncState = {
    available: config !== null,
    user: null,
    busy: false,
    sync: { status: 'idle', saveAt: null, error: null },
    message: null,
  };
  const listeners = new Set<() => void>();
  let client: FirebaseClient | null = null;
  let connecting: Promise<FirebaseClient> | null = null;
  let engine: SyncEngine | null = null;
  let lastPull = 0;

  const set = (next: Partial<SyncState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const flag = (on: boolean) => {
    try {
      if (on) storage.setItem(ENABLED_KEY, '1');
      else storage.removeItem(ENABLED_KEY);
    } catch {
      // storage unavailable: the session just won't be restored automatically
    }
  };

  function startEngine(user: SyncUser) {
    engine?.stop();
    engine = createSyncEngine({
      backend: client!.backendFor(user.uid),
      store: { getState, replaceState, subscribeChanges },
      uid: user.uid,
      storage,
      onChange: (sync) => set({ sync }),
    });
    lastPull = Date.now();
    void engine.start();
  }

  function connect() {
    connecting ??= load(config!).then((c) => {
      client = c;
      c.onUser((user) => {
        set({ user });
        if (user) startEngine(user);
        else {
          engine?.stop();
          engine = null;
        }
      });
      return c;
    });
    return connecting;
  }

  async function run(action: () => Promise<void>) {
    set({ busy: true, message: null });
    try {
      await action();
    } catch (error) {
      set({ message: errorMessage(error) });
    } finally {
      set({ busy: false });
    }
  }

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!engine?.hasUnsaved()) return;
    // Start saving right away; the browser's "leave site?" prompt gives it time to finish.
    void engine.flush();
    e.preventDefault();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void engine?.flush();
    else if (engine && Date.now() - lastPull > pullIntervalMs) {
      lastPull = Date.now();
      void engine.pull().catch(() => {});
    }
  };

  return {
    /** Restores a previous session (loading Firebase) without blocking the first render. */
    init() {
      if (!config) return;
      addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('visibilitychange', onVisibility);
      if (storage.getItem(ENABLED_KEY)) void connect();
    },
    signIn: () =>
      run(async () => {
        const c = await connect();
        await c.signIn();
        flag(true);
      }),
    signOut: () =>
      run(async () => {
        await engine?.flush();
        engine?.forget();
        engine = null;
        flag(false);
        await client?.signOut();
        set({ message: { key: 'signedOut' } });
      }),
    /** Deletes the cloud copy and the sign-in account; local progress is kept. */
    deleteAccount: () =>
      run(async () => {
        const user = state.user;
        if (!user || !client) return;
        engine?.stop();
        await client.backendFor(user.uid).remove();
        engine?.forget();
        engine = null;
        flag(false);
        await client.deleteAccount();
        set({ user: null, message: { key: 'deleted' } });
      }),
    saveNow: () => engine?.flush(),
    clearMessage: () => set({ message: null }),
    /** Detaches browser listeners and stops syncing (tests, hot reload). */
    dispose() {
      removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      engine?.stop();
      engine = null;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
  };
}

export type SyncController = ReturnType<typeof createSyncController>;

export const syncController = createSyncController({ config: readFirebaseConfig() });

export function useSync(controller: SyncController = syncController) {
  return useSyncExternalStore(controller.subscribe, controller.getState);
}
