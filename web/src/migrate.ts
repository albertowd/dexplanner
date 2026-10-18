// Moves data saved under the project's earlier names (Online Pokédex, PokePlan) to the current keys.
// Imported first in main.tsx so it runs before any module reads localStorage.
const RENAMED_KEYS: [from: string, to: string][] = [
  ['pokeplan:v1', 'dexplanner:v1'],
  ['online-pokedex:v1', 'dexplanner:v1'],
  ['pokeplan:locale', 'dexplanner:locale'],
  ['pokeplan:sync-enabled', 'dexplanner:sync-enabled'],
  ['pokeplan:sync-pending', 'dexplanner:sync-pending'],
  ['pokeplan:sync-linked', 'dexplanner:sync-linked'],
];

export function migrateStorage(storage: Storage = globalThis.localStorage) {
  try {
    for (const [from, to] of RENAMED_KEYS) {
      const value = storage.getItem(from);
      if (value === null) continue;
      if (storage.getItem(to) === null) storage.setItem(to, value);
      storage.removeItem(from);
    }
  } catch {
    // storage unavailable: nothing to migrate
  }
}

migrateStorage();
