import { useCallback, useSyncExternalStore } from 'react';

/** The user's progress. It always lives in localStorage; cloud sync (optional) mirrors it. */
export interface UserState {
  v: 1;
  registered: number[];
  owned: string[];
  showRetro: boolean;
  /** Species registered as shiny. */
  shiny: number[];
  /** Living dex forms registered (form keys; a species' default form is the species itself). */
  forms: string[];
  /** Living dex forms registered as shiny. */
  shinyForms: string[];
}

const KEY = 'dexplanner:v1';
export const emptyState: UserState = { v: 1, registered: [], owned: [], showRetro: false, shiny: [], forms: [], shinyForms: [] };

function read(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyState, ...JSON.parse(raw) };
  } catch {
    // private mode / blocked storage: run with in-memory state
  }
  return emptyState;
}

/**
 * Where a change came from: `local` (the user, in this tab), `remote` (cloud sync) or `tab`
 * (another open tab, which syncs it itself).
 */
export type ChangeOrigin = 'local' | 'remote' | 'tab';
export type ChangeListener = (prev: UserState, next: UserState, origin: ChangeOrigin) => void;

let state = read();
const listeners = new Set<() => void>();
const changeListeners = new Set<ChangeListener>();

function set(next: UserState, origin: ChangeOrigin) {
  const prev = state;
  state = next;
  if (origin !== 'tab') {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // keep working in memory
    }
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l(prev, next, origin));
}

// Keep several open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) set(read(), 'tab');
});

/** Notifies about every state change with the previous state; used by cloud sync. */
export function subscribeChanges(listener: ChangeListener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function getState() {
  return state;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useUserState() {
  const s = useSyncExternalStore(subscribe, () => state);
  const update = useCallback((fn: (s: UserState) => Partial<UserState>) => set({ ...state, ...fn(state) }, 'local'), []);
  return [s, update] as const;
}

export function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export class BackupFormatError extends Error {
  constructor() {
    super('This file is not a DexPlanner backup.');
  }
}

/** Validates an imported backup; throws `BackupFormatError` for anything else. */
export function parseBackup(text: string): UserState {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupFormatError();
  }
  if (!data || !Array.isArray(data.registered)) throw new BackupFormatError();
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : []);
  const numbers = (value: unknown) => (Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n)) : []);
  return {
    v: 1,
    registered: numbers(data.registered),
    owned: strings(data.owned),
    showRetro: Boolean(data.showRetro),
    shiny: numbers(data.shiny),
    forms: strings(data.forms),
    shinyForms: strings(data.shinyForms),
  };
}

export function replaceState(next: UserState, origin: ChangeOrigin = 'local') {
  set(next, origin);
}
