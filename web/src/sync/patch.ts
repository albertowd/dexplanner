import type { UserState } from '../store.ts';

/** Progress fields that are sets: synced entry by entry. Numbers are species ids, strings are keys. */
export const SET_FIELDS = ['registered', 'owned', 'shiny', 'forms', 'shinyForms'] as const;
export type SetField = (typeof SET_FIELDS)[number];
const NUMERIC: ReadonlySet<SetField> = new Set(['registered', 'shiny']);

/**
 * Cloud document for one trainer (trainers/{uid}). Sets are stored as maps (`{"25": true}`) so a batch
 * of changes can add and remove single entries in one write, and edits from two devices merge instead
 * of overwriting each other.
 */
export type RemoteDoc = { v: 1; showRetro: boolean } & Record<SetField, Record<string, true>>;

/** Changes not yet saved: `true` adds an entry, `false` removes it. */
export type SyncPatch = Record<SetField, Record<string, boolean>> & { showRetro?: boolean };

export const emptyPatch = (): SyncPatch =>
  Object.fromEntries(SET_FIELDS.map((field) => [field, {}])) as Record<SetField, Record<string, boolean>>;

export function isEmptyPatch(p: SyncPatch) {
  return patchSize(p) === 0;
}

export function patchSize(p: SyncPatch) {
  return SET_FIELDS.reduce((n, field) => n + Object.keys(p[field]).length, 0) + (p.showRetro === undefined ? 0 : 1);
}

function diffSet(prev: readonly (string | number)[], next: readonly (string | number)[]): Record<string, boolean> {
  const before = new Set(prev.map(String));
  const after = new Set(next.map(String));
  const out: Record<string, boolean> = {};
  for (const x of after) if (!before.has(x)) out[x] = true;
  for (const x of before) if (!after.has(x)) out[x] = false;
  return out;
}

export function diffStates(prev: UserState, next: UserState): SyncPatch {
  const patch = emptyPatch();
  for (const field of SET_FIELDS) patch[field] = diffSet(prev[field], next[field]);
  if (prev.showRetro !== next.showRetro) patch.showRetro = next.showRetro;
  return patch;
}

/** Combines two patches; `later` wins where both touch the same entry. */
export function mergePatches(earlier: SyncPatch, later: SyncPatch): SyncPatch {
  const merged = emptyPatch();
  for (const field of SET_FIELDS) merged[field] = { ...earlier[field], ...later[field] };
  merged.showRetro = later.showRetro ?? earlier.showRetro;
  return merged;
}

const parse = (field: SetField) => (key: string) => (NUMERIC.has(field) ? Number(key) : key);
const sorted = (field: SetField, values: (string | number)[]) =>
  NUMERIC.has(field) ? (values as number[]).sort((a, b) => a - b) : values;

function applySet(field: SetField, list: readonly (string | number)[], changes: Record<string, boolean>) {
  const out = new Set(list);
  for (const [key, add] of Object.entries(changes)) {
    if (add) out.add(parse(field)(key));
    else out.delete(parse(field)(key));
  }
  return sorted(field, [...out]);
}

export function applyPatch(state: UserState, p: SyncPatch): UserState {
  const next = { ...state, showRetro: p.showRetro ?? state.showRetro };
  for (const field of SET_FIELDS) Object.assign(next, { [field]: applySet(field, state[field], p[field]) });
  return next;
}

export function toRemote(state: UserState): RemoteDoc {
  const doc = { v: 1, showRetro: state.showRetro } as RemoteDoc;
  for (const field of SET_FIELDS) doc[field] = Object.fromEntries(state[field].map((x) => [String(x), true as const]));
  return doc;
}

export function fromRemote(doc: Partial<RemoteDoc>): UserState {
  const state = { v: 1, showRetro: Boolean(doc.showRetro) } as UserState;
  for (const field of SET_FIELDS) {
    const keys = Object.keys(doc[field] ?? {}).map(parse(field));
    Object.assign(state, {
      [field]: sorted(field, NUMERIC.has(field) ? keys.filter((k) => Number.isInteger(k)) : keys),
    });
  }
  return state;
}

/** First sign-in on a device: keep everything from both sides so nothing is lost. */
export function unionStates(local: UserState, remote: UserState): UserState {
  const state = { v: 1, showRetro: remote.showRetro || local.showRetro } as UserState;
  for (const field of SET_FIELDS) {
    Object.assign(state, { [field]: sorted(field, [...new Set([...remote[field], ...local[field]])]) });
  }
  return state;
}

export function sameState(a: UserState, b: UserState) {
  return isEmptyPatch(diffStates(a, b));
}
