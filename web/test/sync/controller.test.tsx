import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSyncController as create, useSync, type SyncController } from '../../src/sync/controller.ts';
import { readFirebaseConfig } from '../../src/sync/config.ts';
import type { FirebaseClient, SyncUser } from '../../src/sync/firebase.ts';
import type { RemoteDoc } from '../../src/sync/patch.ts';
import { replaceState, getState } from '../../src/store.ts';
import { SyncIndicator } from '../../src/SyncIndicator.tsx';
import { SyncSection } from '../../src/views/SyncSection.tsx';

const config = { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' };
const ash: SyncUser = { uid: 'ash', name: 'Ash', email: 'ash@example.com', photoUrl: null };

/** Fake Firebase client with an in-memory document per user. */
function fakeClient({ signedIn = false } = {}) {
  const docs = new Map<string, RemoteDoc>();
  let onUser: (u: SyncUser | null) => void = () => {};
  const client = {
    docs,
    signInError: null as unknown,
    onUser(cb: (u: SyncUser | null) => void) {
      onUser = cb;
      queueMicrotask(() => cb(signedIn ? ash : null));
      return () => {};
    },
    async signIn() {
      if (client.signInError) throw client.signInError;
      onUser(ash);
      return ash;
    },
    signOut: vi.fn(async () => onUser(null)),
    deleteAccount: vi.fn(async () => onUser(null)),
    backendFor: (uid: string) => ({
      load: async () => docs.get(uid) ?? null,
      save: async (doc: RemoteDoc) => void docs.set(uid, structuredClone(doc)),
      patch: async () => {},
      remove: async () => void docs.delete(uid),
    }),
  };
  return client;
}

/** Every controller made in a test is disposed afterwards so its browser listeners don't leak. */
const made: SyncController[] = [];
const createSyncController = (...args: Parameters<typeof create>) => {
  const controller = create(...args);
  made.push(controller);
  return controller;
};

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

beforeEach(() => {
  localStorage.clear();
  act(() => replaceState({ v: 1, registered: [1, 2], owned: [], showRetro: false }, 'tab'));
});
afterEach(() => {
  made.splice(0).forEach((c) => c.dispose());
  vi.useRealTimers();
});

describe('readFirebaseConfig', () => {
  it('needs every value', () => {
    expect(readFirebaseConfig({})).toBeNull();
    const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' };
    expect(readFirebaseConfig(env)).toEqual(config);
  });
});

describe('sync controller and UI', () => {
  it('stays hidden when sync is not configured', () => {
    const controller = createSyncController({ config: null });
    controller.init();
    const { container } = render(<><SyncIndicator controller={controller} /><SyncSection controller={controller} /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('signs in, uploads local progress and shows the status', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient });
    controller.init();
    render(<><SyncIndicator controller={controller} /><SyncSection controller={controller} /></>);

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    await flush();
    expect(screen.getByText(/^Signed in as Ash \(ash@example\.com\)\./)).toBeInTheDocument();
    expect(client.docs.get('ash')?.registered).toEqual({ 1: true, 2: true });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(localStorage.getItem('dexplanner:sync-enabled')).toBe('1');
  });

  it('counts down to the next save and saves on request', async () => {
    const user = userEvent.setup();
    const client = fakeClient({ signedIn: true });
    localStorage.setItem('dexplanner:sync-enabled', '1');
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient });
    controller.init();
    render(<SyncIndicator controller={controller} />);
    await flush();

    act(() => replaceState({ ...getState(), registered: [1, 2, 3] }));
    expect(screen.getByText(/^Saving in \d+s$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    await flush();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes and saves when hidden', async () => {
    const client = fakeClient({ signedIn: true });
    localStorage.setItem('dexplanner:sync-enabled', '1');
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient, pullIntervalMs: 0 });
    controller.init();
    render(<SyncIndicator controller={controller} />);
    await flush();

    const quiet = new Event('beforeunload', { cancelable: true });
    dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);

    act(() => replaceState({ ...getState(), registered: [9] }));
    const leaving = new Event('beforeunload', { cancelable: true });
    dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    await flush();
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => replaceState({ ...getState(), registered: [9, 10] }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Coming back pulls changes made on other devices.
    client.docs.get('ash')!.registered['25'] = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(getState().registered).toContain(25);
  });

  it('signs out and keeps progress on the device', async () => {
    const user = userEvent.setup();
    const client = fakeClient({ signedIn: true });
    localStorage.setItem('dexplanner:sync-enabled', '1');
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient });
    controller.init();
    render(<SyncSection controller={controller} />);
    await flush();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await flush();
    expect(client.signOut).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Signed out. Your progress stays on this device.');
    expect(localStorage.getItem('dexplanner:sync-enabled')).toBeNull();
    expect(getState().registered).toEqual([1, 2]);
  });

  it('deletes the cloud data and account after confirmation', async () => {
    const user = userEvent.setup();
    const client = fakeClient({ signedIn: true });
    localStorage.setItem('dexplanner:sync-enabled', '1');
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient });
    controller.init();
    render(<SyncSection controller={controller} />);
    await flush();
    expect(client.docs.has('ash')).toBe(true);

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const button = screen.getByRole('button', { name: 'Delete cloud data and account' });
    await user.click(button);
    expect(client.deleteAccount).not.toHaveBeenCalled();
    await user.click(button);
    await flush();
    expect(client.docs.has('ash')).toBe(false);
    expect(client.deleteAccount).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Your cloud data and account were deleted.');
    confirm.mockRestore();
  });

  it('explains sign-in problems', async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    const controller = createSyncController({ config, load: async () => client as unknown as FirebaseClient });
    render(<SyncSection controller={controller} />);
    const button = screen.getByRole('button', { name: 'Sign in with Google' });

    client.signInError = { code: 'auth/popup-closed-by-user' };
    await user.click(button);
    expect(await screen.findByText('Sign-in was cancelled.')).toBeInTheDocument();
    client.signInError = { code: 'auth/popup-blocked' };
    await user.click(button);
    expect(await screen.findByText(/sign-in window was blocked/)).toBeInTheDocument();
    client.signInError = new Error('network down');
    await user.click(button);
    expect(await screen.findByText('network down')).toBeInTheDocument();
    client.signInError = 'odd failure';
    await user.click(button);
    expect(await screen.findByText('odd failure')).toBeInTheDocument();
  });

  it('only loads Firebase on start for people who signed in before', async () => {
    const load = vi.fn(async () => fakeClient() as unknown as FirebaseClient);
    createSyncController({ config, load }).init();
    expect(load).not.toHaveBeenCalled();
    localStorage.setItem('dexplanner:sync-enabled', '1');
    createSyncController({ config, load }).init();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('exposes state through a hook', () => {
    const controller = createSyncController({ config: null });
    function Probe() {
      return <span>{useSync(controller).available ? 'on' : 'off'}</span>;
    }
    render(<Probe />);
    expect(screen.getByText('off')).toBeInTheDocument();
  });
});
