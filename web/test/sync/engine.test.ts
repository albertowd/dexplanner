import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncEngine, DocumentMissingError, type SyncBackend } from '../../src/sync/engine.ts';
import type { RemoteDoc, SyncPatch } from '../../src/sync/patch.ts';
import type { ChangeListener, ChangeOrigin, UserState } from '../../src/store.ts';

const state = (registered: number[], owned: string[] = [], showRetro = false): UserState => ({ v: 1, registered, owned, showRetro });

/** In-memory stand-in for the app store. */
function fakeStore(initial: UserState) {
  let current = initial;
  const listeners = new Set<ChangeListener>();
  return {
    getState: () => current,
    replaceState(next: UserState, origin: ChangeOrigin = 'local') {
      const prev = current;
      current = next;
      listeners.forEach((l) => l(prev, next, origin));
    },
    subscribeChanges(l: ChangeListener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/** In-memory stand-in for Firestore that records calls. */
function fakeBackend(initial: RemoteDoc | null) {
  let doc: RemoteDoc | null = initial;
  const calls: string[] = [];
  const backend: SyncBackend & { doc: () => RemoteDoc | null; calls: string[]; fail?: Error } = {
    calls,
    doc: () => doc,
    async load() {
      calls.push('load');
      return doc;
    },
    async save(next) {
      calls.push('save');
      if (backend.fail) throw backend.fail;
      doc = structuredClone(next);
    },
    async patch(p: SyncPatch) {
      calls.push('patch');
      if (backend.fail) throw backend.fail;
      if (!doc) throw new DocumentMissingError();
      for (const [k, add] of Object.entries(p.registered)) if (add) doc.registered[k] = true; else delete doc.registered[k];
      for (const [k, add] of Object.entries(p.owned)) if (add) doc.owned[k] = true; else delete doc.owned[k];
      if (p.showRetro !== undefined) doc.showRetro = p.showRetro;
    },
    async remove() {
      calls.push('remove');
      doc = null;
    },
  };
  return backend;
}

const remote = (registered: number[], owned: string[] = [], showRetro = false): RemoteDoc => ({
  v: 1,
  registered: Object.fromEntries(registered.map((n) => [String(n), true as const])),
  owned: Object.fromEntries(owned.map((o) => [o, true as const])),
  showRetro,
});

const toggle = (store: ReturnType<typeof fakeStore>, id: number) => {
  const s = store.getState();
  store.replaceState({ ...s, registered: s.registered.includes(id) ? s.registered.filter((x) => x !== id) : [...s.registered, id] });
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('sync engine', () => {
  it('merges local and cloud progress the first time an account is used on a device', async () => {
    const store = fakeStore(state([1, 2], ['sv']));
    const backend = fakeBackend(remote([2, 3], ['za'], true));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    expect(store.getState()).toEqual(state([1, 2, 3], ['za', 'sv'], true));
    expect(backend.doc()).toEqual(remote([1, 2, 3], ['za', 'sv'], true));
    expect(engine.snapshot().status).toBe('saved');
  });

  it('creates the cloud copy when the account has none, without rewriting identical data', async () => {
    const store = fakeStore(state([4]));
    const backend = fakeBackend(null);
    await createSyncEngine({ backend, store, uid: 'u1' }).start();
    expect(backend.doc()).toEqual(remote([4]));

    const same = fakeBackend(remote([4]));
    localStorage.clear();
    await createSyncEngine({ backend: same, store, uid: 'u1' }).start();
    expect(same.calls).toEqual(['load']);
  });

  it('later starts take the cloud copy (removals from other devices apply)', async () => {
    const store = fakeStore(state([1, 2]));
    const backend = fakeBackend(remote([1, 2]));
    const first = createSyncEngine({ backend, store, uid: 'u1' });
    await first.start();
    first.stop();
    delete backend.doc()!.registered['2']; // unmarked on another device
    await createSyncEngine({ backend, store, uid: 'u1' }).start();
    expect(store.getState().registered).toEqual([1]);
  });

  it('batches changes: one write 30 s after the last change', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const onChange = vi.fn();
    const engine = createSyncEngine({ backend, store, uid: 'u1', onChange });
    await engine.start();
    backend.calls.length = 0;

    for (const id of [1, 2, 3, 2]) {
      toggle(store, id);
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(backend.calls).toEqual([]);
    expect(engine.snapshot().status).toBe('pending');
    expect(engine.hasUnsaved()).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(backend.calls).toEqual(['patch']);
    expect(backend.doc()).toEqual(remote([1, 3]));
    expect(engine.snapshot().status).toBe('saved');
    expect(engine.hasUnsaved()).toBe(false);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'saving' }));
  });

  it('never waits longer than the maximum while changes keep coming', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const engine = createSyncEngine({ backend, store, uid: 'u1', delayMs: 30_000, maxWaitMs: 60_000 });
    await engine.start();
    backend.calls.length = 0;
    for (let id = 1; id <= 8; id++) {
      toggle(store, id);
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(backend.calls).toEqual(['patch']);
  });

  it('ignores changes that came from the cloud or another tab', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    store.replaceState(state([9]), 'remote');
    store.replaceState(state([9, 10]), 'tab');
    expect(engine.hasUnsaved()).toBe(false);
  });

  it('saves immediately on request, and writes big changes as a whole document', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const engine = createSyncEngine({ backend, store, uid: 'u1', maxPatchSize: 3 });
    await engine.start();
    backend.calls.length = 0;
    store.replaceState(state([1, 2, 3, 4, 5]));
    await engine.flush();
    expect(backend.calls).toEqual(['save']);
    expect(backend.doc()).toEqual(remote([1, 2, 3, 4, 5]));
    await engine.flush(); // nothing pending: no write
    expect(backend.calls).toEqual(['save']);
  });

  it('recreates the cloud copy if it was deleted elsewhere', async () => {
    const store = fakeStore(state([1]));
    const backend = fakeBackend(remote([1]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    await backend.remove();
    toggle(store, 2);
    await engine.flush();
    expect(backend.doc()).toEqual(remote([1, 2]));
  });

  it('keeps unsaved changes across reloads and sends them next time', async () => {
    const store = fakeStore(state([1]));
    const backend = fakeBackend(remote([1]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    toggle(store, 2);
    engine.stop(); // the tab closes before the save

    const reopened = createSyncEngine({ backend, store, uid: 'u1' });
    await reopened.start();
    expect(store.getState().registered).toEqual([1, 2]);
    expect(reopened.snapshot().status).toBe('pending');
    await reopened.flush();
    expect(backend.doc()).toEqual(remote([1, 2]));
  });

  it('does not apply another account’s unsaved changes', async () => {
    const store = fakeStore(state([1]));
    const backend = fakeBackend(remote([1]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    toggle(store, 2);
    engine.stop();
    expect(createSyncEngine({ backend: fakeBackend(remote([])), store, uid: 'u2' }).hasUnsaved()).toBe(false);
  });

  it('keeps a failed batch and retries it with newer changes', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    toggle(store, 1);
    backend.fail = new Error('offline');
    await engine.flush();
    expect(engine.snapshot()).toMatchObject({ status: 'error', error: 'offline' });
    expect(engine.hasUnsaved()).toBe(true);

    backend.fail = undefined;
    toggle(store, 2);
    await engine.flush();
    expect(backend.doc()).toEqual(remote([1, 2]));
  });

  it('pull keeps unsaved local changes on top of the cloud copy', async () => {
    const store = fakeStore(state([1]));
    const backend = fakeBackend(remote([1]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    toggle(store, 5);
    backend.doc()!.registered['7'] = true; // added on another device
    await engine.pull();
    expect(store.getState().registered).toEqual([1, 5, 7]);
  });

  it('reports start failures', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(null);
    backend.load = async () => {
      throw new Error('permission-denied');
    };
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    expect(engine.snapshot()).toMatchObject({ status: 'error', error: 'permission-denied' });
  });

  it('forget drops the link and unsaved changes', async () => {
    const store = fakeStore(state([]));
    const backend = fakeBackend(remote([]));
    const engine = createSyncEngine({ backend, store, uid: 'u1' });
    await engine.start();
    toggle(store, 3);
    engine.forget();
    expect(engine.hasUnsaved()).toBe(false);
    expect(localStorage.getItem('pokeplan:sync-pending')).toBeNull();
    expect(localStorage.getItem('pokeplan:sync-linked')).toBeNull();
    expect(engine.snapshot().status).toBe('idle');
  });
});
