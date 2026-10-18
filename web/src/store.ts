import { useCallback, useSyncExternalStore } from 'react';

/** Everything the user owns lives in localStorage; there is no backend. */
export interface UserState {
  v: 1;
  registered: number[];
  owned: string[];
  showRetro: boolean;
}

const KEY = 'pokeplan:v1';
/** Key used before the project was renamed; read once so existing progress carries over. */
const LEGACY_KEY = 'online-pokedex:v1';
const empty: UserState = { v: 1, registered: [], owned: [], showRetro: false };

function read(): UserState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) return { ...empty, ...JSON.parse(raw) };
  } catch {
    // private mode / blocked storage: run with in-memory state
  }
  return empty;
}

let state = read();
const listeners = new Set<() => void>();

function set(next: UserState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep working in memory
  }
  listeners.forEach((l) => l());
}

// Keep several open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = read();
    listeners.forEach((l) => l());
  }
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useUserState() {
  const s = useSyncExternalStore(subscribe, () => state);
  const update = useCallback((fn: (s: UserState) => Partial<UserState>) => set({ ...state, ...fn(state) }), []);
  return [s, update] as const;
}

export function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Validates an imported backup; throws with a readable message. */
export function parseBackup(text: string): UserState {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.registered)) throw new Error('This file is not a PokePlan backup.');
  return {
    v: 1,
    registered: data.registered.filter((n: unknown) => Number.isInteger(n)),
    owned: Array.isArray(data.owned) ? data.owned.filter((s: unknown) => typeof s === 'string') : [],
    showRetro: Boolean(data.showRetro),
  };
}

export function replaceState(next: UserState) {
  set(next);
}
