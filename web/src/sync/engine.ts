import type { ChangeListener, ChangeOrigin, UserState } from '../store.ts';
import {
  applyPatch,
  diffStates,
  emptyPatch,
  fromRemote,
  isEmptyPatch,
  mergePatches,
  patchSize,
  sameState,
  toRemote,
  unionStates,
  type RemoteDoc,
  type SyncPatch,
} from './patch.ts';

/** Storage for one signed-in trainer's document. */
export interface SyncBackend {
  load(): Promise<Partial<RemoteDoc> | null>;
  /** Replaces the whole document. */
  save(doc: RemoteDoc): Promise<void>;
  /** Applies a patch; rejects with `DocumentMissingError` when the document doesn't exist. */
  patch(patch: SyncPatch): Promise<void>;
  remove(): Promise<void>;
}

export class DocumentMissingError extends Error {
  constructor() {
    super('The cloud document does not exist.');
  }
}

export interface SyncStore {
  getState(): UserState;
  replaceState(next: UserState, origin: ChangeOrigin): void;
  subscribeChanges(listener: ChangeListener): () => void;
}

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  /** When the pending changes will be saved (ms since epoch), while status is `pending`. */
  saveAt: number | null;
  error: string | null;
}

export interface SyncOptions {
  backend: SyncBackend;
  store: SyncStore;
  /** Identifies the account; pending changes are kept per account. */
  uid: string;
  storage?: Storage;
  /** Wait this long after the last change before saving. */
  delayMs?: number;
  /** …but never longer than this after the first unsaved change. */
  maxWaitMs?: number;
  /** Patches touching more entries than this are written as a whole document instead. */
  maxPatchSize?: number;
  onChange?: (snapshot: SyncSnapshot) => void;
}

const PENDING_KEY = 'pokeplan:sync-pending';
const LINKED_KEY = 'pokeplan:sync-linked';

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: pending changes then only live in memory
  }
}

/**
 * Mirrors the local progress to the cloud with as few reads and writes as possible:
 * changes are batched (saved `delayMs` after the last one), unsaved changes survive reloads, and
 * remote changes are pulled on demand (start, focus) rather than streamed.
 */
export function createSyncEngine({
  backend,
  store,
  uid,
  storage = globalThis.localStorage,
  delayMs = 30_000,
  maxWaitMs = 120_000,
  maxPatchSize = 300,
  onChange,
}: SyncOptions) {
  const saved = readJson<{ uid: string; patch: SyncPatch }>(storage, PENDING_KEY);
  let pending: SyncPatch = saved?.uid === uid ? saved.patch : emptyPatch();
  let inFlight: SyncPatch | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstPendingAt: number | null = null;
  let snapshot: SyncSnapshot = { status: 'idle', saveAt: null, error: null };
  let unsubscribe: (() => void) | null = null;
  let flushing: Promise<void> | null = null;

  const emit = (next: Partial<SyncSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    onChange?.(snapshot);
  };
  const persistPending = () => writeJson(storage, PENDING_KEY, isEmptyPatch(pending) ? null : { uid, patch: pending });

  function schedule() {
    if (timer) clearTimeout(timer);
    if (isEmptyPatch(pending)) return;
    const now = Date.now();
    firstPendingAt ??= now;
    const saveAt = Math.min(now + delayMs, firstPendingAt + maxWaitMs);
    timer = setTimeout(() => void flush(), saveAt - now);
    emit({ status: 'pending', saveAt });
  }

  const onLocalChange: ChangeListener = (prev, next, origin) => {
    if (origin !== 'local') return;
    pending = mergePatches(pending, diffStates(prev, next));
    persistPending();
    schedule();
  };

  async function write(batch: SyncPatch) {
    if (patchSize(batch) > maxPatchSize) return backend.save(toRemote(store.getState()));
    try {
      await backend.patch(batch);
    } catch (error) {
      // Deleted on another device (or never created): write the full state instead.
      if (error instanceof DocumentMissingError) await backend.save(toRemote(store.getState()));
      else throw error;
    }
  }

  async function doFlush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (isEmptyPatch(pending)) return;
    const batch = pending;
    inFlight = batch;
    pending = emptyPatch();
    firstPendingAt = null;
    emit({ status: 'saving', saveAt: null, error: null });
    try {
      await write(batch);
      inFlight = null;
      persistPending();
      if (isEmptyPatch(pending)) emit({ status: 'saved' });
      else schedule();
    } catch (error) {
      // Keep the batch (newer changes win) and retry on the next change, focus or save request.
      pending = mergePatches(batch, pending);
      inFlight = null;
      persistPending();
      emit({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Saves pending changes now. */
  function flush() {
    flushing ??= doFlush().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  /** Reads the cloud copy and applies it locally, keeping changes not yet saved. */
  async function pull() {
    const remote = await backend.load();
    const current = store.getState();
    if (!remote) {
      // Deleted elsewhere: this device's copy becomes the cloud copy again.
      await backend.save(toRemote(current));
      return;
    }
    const next = applyPatch(fromRemote(remote), mergePatches(inFlight ?? emptyPatch(), pending));
    if (!sameState(current, next)) store.replaceState(next, 'remote');
  }

  /**
   * Starts syncing. The first time an account is used on this device, local and cloud progress are
   * merged (nothing is lost); after that the cloud copy plus unsaved local changes wins.
   */
  async function start() {
    unsubscribe = store.subscribeChanges(onLocalChange);
    try {
      if (readJson<string>(storage, LINKED_KEY) === uid) {
        await pull();
      } else {
        const remote = await backend.load();
        const local = store.getState();
        const merged = remote ? unionStates(local, fromRemote(remote)) : local;
        if (!remote || !sameState(fromRemote(remote), merged)) await backend.save(toRemote(merged));
        if (!sameState(local, merged)) store.replaceState(merged, 'remote');
        writeJson(storage, LINKED_KEY, uid);
      }
      if (isEmptyPatch(pending)) emit({ status: 'saved' });
      else schedule();
    } catch (error) {
      emit({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  /** Signing out: forget which account this device was linked to and any unsaved changes. */
  function forget() {
    stop();
    pending = emptyPatch();
    writeJson(storage, PENDING_KEY, null);
    writeJson(storage, LINKED_KEY, null);
    emit({ status: 'idle', saveAt: null, error: null });
  }

  return {
    start,
    stop,
    forget,
    flush,
    pull,
    hasUnsaved: () => !isEmptyPatch(pending) || inFlight !== null,
    snapshot: () => snapshot,
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
