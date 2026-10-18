import type { UserState } from '../store.ts';

/**
 * Cloud document for one trainer (trainers/{uid}). Sets are stored as maps (`{"25": true}`) so a batch of changes can
 * add and remove single entries in one write, and edits from two devices merge instead of
 * overwriting each other.
 */
export interface RemoteDoc {
  v: 1;
  registered: Record<string, true>;
  owned: Record<string, true>;
  showRetro: boolean;
}

/** Changes not yet saved: `true` adds an entry, `false` removes it. */
export interface SyncPatch {
  registered: Record<string, boolean>;
  owned: Record<string, boolean>;
  showRetro?: boolean;
}

export const emptyPatch = (): SyncPatch => ({ registered: {}, owned: {} });

export function isEmptyPatch(p: SyncPatch) {
  return patchSize(p) === 0;
}

export function patchSize(p: SyncPatch) {
  return Object.keys(p.registered).length + Object.keys(p.owned).length + (p.showRetro === undefined ? 0 : 1);
}

function diffSet<T>(prev: T[], next: T[]): Record<string, boolean> {
  const before = new Set(prev);
  const after = new Set(next);
  const out: Record<string, boolean> = {};
  for (const x of after) if (!before.has(x)) out[String(x)] = true;
  for (const x of before) if (!after.has(x)) out[String(x)] = false;
  return out;
}

export function diffStates(prev: UserState, next: UserState): SyncPatch {
  const patch: SyncPatch = { registered: diffSet(prev.registered, next.registered), owned: diffSet(prev.owned, next.owned) };
  if (prev.showRetro !== next.showRetro) patch.showRetro = next.showRetro;
  return patch;
}

/** Combines two patches; `later` wins where both touch the same entry. */
export function mergePatches(earlier: SyncPatch, later: SyncPatch): SyncPatch {
  return {
    registered: { ...earlier.registered, ...later.registered },
    owned: { ...earlier.owned, ...later.owned },
    showRetro: later.showRetro ?? earlier.showRetro,
  };
}

function applySet<T>(list: T[], changes: Record<string, boolean>, parse: (key: string) => T): T[] {
  const out = new Set(list);
  for (const [key, add] of Object.entries(changes)) {
    if (add) out.add(parse(key));
    else out.delete(parse(key));
  }
  return [...out];
}

export function applyPatch(state: UserState, p: SyncPatch): UserState {
  return {
    ...state,
    registered: applySet(state.registered, p.registered, Number).sort((a, b) => a - b),
    owned: applySet(state.owned, p.owned, String),
    showRetro: p.showRetro ?? state.showRetro,
  };
}

const toMap = <T>(list: T[]) => Object.fromEntries(list.map((x) => [String(x), true as const]));

export function toRemote(state: UserState): RemoteDoc {
  return { v: 1, registered: toMap(state.registered), owned: toMap(state.owned), showRetro: state.showRetro };
}

export function fromRemote(doc: Partial<RemoteDoc>): UserState {
  return {
    v: 1,
    registered: Object.keys(doc.registered ?? {})
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b),
    owned: Object.keys(doc.owned ?? {}),
    showRetro: Boolean(doc.showRetro),
  };
}

/** First sign-in on a device: keep everything from both sides so nothing is lost. */
export function unionStates(local: UserState, remote: UserState): UserState {
  return {
    v: 1,
    registered: [...new Set([...remote.registered, ...local.registered])].sort((a, b) => a - b),
    owned: [...new Set([...remote.owned, ...local.owned])],
    showRetro: remote.showRetro || local.showRetro,
  };
}

export function sameState(a: UserState, b: UserState) {
  return isEmptyPatch(diffStates(a, b));
}
