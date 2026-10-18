// What the list shows: one entry per species, or (living dex) one per form, tracked in normal or shiny mode.
import { useSyncExternalStore } from 'react';
import type { UserState } from './store.ts';
import type { Pokemon, PokemonForm, ShinyStatus } from './types.ts';

export interface DexEntry {
  /** Species id for a species' default form, form key for other forms. */
  key: string;
  pokemon: Pokemon;
  form?: PokemonForm;
}

/** Which progress the list tracks. Kept per device; not synced. */
export interface DexMode {
  shiny: boolean;
  living: boolean;
}

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

/** Sprite for a path in the PokeAPI repo ("25", "201-b", "female/25"); shiny sprites sit in a shiny/ folder. */
export const spritePathUrl = (path: string, shiny = false) => `${SPRITES}/${shiny ? 'shiny/' : ''}${path}.png`;

export function dexEntries(pokemon: Pokemon[], living: boolean): DexEntry[] {
  if (!living) return pokemon.map((p) => ({ key: String(p.id), pokemon: p }));
  return pokemon.flatMap((p) => [
    { key: String(p.id), pokemon: p },
    ...(p.forms ?? []).map((form) => ({ key: form.key, pokemon: p, form })),
  ]);
}

export const entrySprite = (e: DexEntry, shiny: boolean) => spritePathUrl(e.form?.sprite ?? String(e.pokemon.id), shiny);

/** Shiny status of an entry: the form's own status wins over the species'; undefined means available. */
export function entryShiny(e: DexEntry): { status: ShinyStatus; note?: string } | undefined {
  if (e.form?.shiny === 'available') return undefined;
  if (e.form?.shiny) return { status: e.form.shiny, note: e.form.shinyNote };
  return e.pokemon.shiny ? { status: e.pokemon.shiny, note: e.pokemon.shinyNote } : undefined;
}

/** The progress set an entry is tracked in for the given mode. */
function field(e: DexEntry, shiny: boolean) {
  if (e.form) return shiny ? 'shinyForms' : 'forms';
  return shiny ? 'shiny' : 'registered';
}

export function isEntryRegistered(e: DexEntry, state: UserState, shiny: boolean) {
  return e.form
    ? state[field(e, shiny) as 'forms' | 'shinyForms'].includes(e.key)
    : state[field(e, shiny) as 'registered' | 'shiny'].includes(e.pokemon.id);
}

/** State change that marks (or unmarks) a group of entries. */
export function setEntries(state: UserState, entries: DexEntry[], shiny: boolean, value: boolean): Partial<UserState> {
  const species = new Set<number>(shiny ? state.shiny : state.registered);
  const forms = new Set<string>(shiny ? state.shinyForms : state.forms);
  for (const e of entries) {
    if (e.form) {
      if (value) forms.add(e.key);
      else forms.delete(e.key);
    } else if (value) species.add(e.pokemon.id);
    else species.delete(e.pokemon.id);
  }
  return shiny ? { shiny: [...species], shinyForms: [...forms] } : { registered: [...species], forms: [...forms] };
}

export const toggleEntry = (state: UserState, e: DexEntry, shiny: boolean) =>
  setEntries(state, [e], shiny, !isEntryRegistered(e, state, shiny));

// --- Mode, per device ---

const MODE_KEY = 'dexplanner:mode';
const listeners = new Set<() => void>();

function readMode(): DexMode {
  try {
    const value = JSON.parse(localStorage.getItem(MODE_KEY) ?? '{}');
    return { shiny: value.shiny === true, living: value.living === true };
  } catch {
    return { shiny: false, living: false };
  }
}

let mode = readMode();

export function setDexMode(next: Partial<DexMode>) {
  mode = { ...mode, ...next };
  try {
    localStorage.setItem(MODE_KEY, JSON.stringify(mode));
  } catch {
    // keep it for this session
  }
  listeners.forEach((l) => l());
}

export function useDexMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode,
  );
}
