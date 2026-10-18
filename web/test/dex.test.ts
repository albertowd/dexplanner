import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  dexEntries,
  entryShiny,
  entrySprite,
  isEntryRegistered,
  setDexMode,
  setEntries,
  spritePathUrl,
  toggleEntry,
  useDexMode,
} from '../src/dex.ts';
import { emptyState } from '../src/store.ts';
import { byName, pokemon } from './fixtures.ts';

beforeEach(() => {
  localStorage.clear();
  act(() => setDexMode({ shiny: false, living: false }));
});

describe('dex entries', () => {
  it('lists species, or every form in living dex mode', () => {
    expect(dexEntries(pokemon, false)).toHaveLength(pokemon.length);
    const living = dexEntries([byName('pikachu')], true);
    expect(living.map((e) => e.key)).toEqual(['25', 'pikachu-alola-cap', 'pikachu-female']);
  });

  it('builds normal and shiny sprite URLs from PokeAPI paths', () => {
    const [species, cap, female] = dexEntries([byName('pikachu')], true);
    expect(spritePathUrl('25')).toMatch(/sprites\/pokemon\/25\.png$/);
    expect(entrySprite(species, true)).toMatch(/sprites\/pokemon\/shiny\/25\.png$/);
    expect(entrySprite(cap, false)).toMatch(/pokemon\/10099\.png$/);
    expect(entrySprite(female, true)).toMatch(/pokemon\/shiny\/female\/25\.png$/);
  });

  it('uses the form shiny status before the species one', () => {
    const [species, cap, female] = dexEntries([byName('pikachu')], true);
    expect(entryShiny(species)).toBeUndefined();
    expect(entryShiny(cap)).toEqual({ status: 'locked', note: 'Caps are never shiny' });
    expect(entryShiny(female)).toBeUndefined();
    const [magearna, original] = dexEntries([byName('magearna')], true);
    expect(entryShiny(magearna)).toEqual({ status: 'event', note: undefined });
    expect(entryShiny(original)).toBeUndefined();
  });

  it('tracks species, forms and their shiny versions separately', () => {
    const [species, cap] = dexEntries([byName('pikachu')], true);
    let state = { ...emptyState, ...toggleEntry(emptyState, species, false) };
    state = { ...state, ...toggleEntry(state, cap, true) };
    expect(state).toMatchObject({ registered: [25], shiny: [], forms: [], shinyForms: ['pikachu-alola-cap'] });
    expect(isEntryRegistered(species, state, false)).toBe(true);
    expect(isEntryRegistered(species, state, true)).toBe(false);
    expect(isEntryRegistered(cap, state, true)).toBe(true);
    state = { ...state, ...toggleEntry(state, species, false) };
    expect(state.registered).toEqual([]);
  });

  it('marks and unmarks groups of entries', () => {
    const entries = dexEntries([byName('pikachu')], true);
    const marked = { ...emptyState, ...setEntries(emptyState, entries, false, true) };
    expect(marked).toMatchObject({ registered: [25], forms: ['pikachu-alola-cap', 'pikachu-female'] });
    expect(setEntries(marked, entries, false, false)).toEqual({ registered: [], forms: [] });
    expect(setEntries(emptyState, entries, true, true)).toEqual({ shiny: [25], shinyForms: ['pikachu-alola-cap', 'pikachu-female'] });
  });
});

describe('dex mode', () => {
  it('is remembered per device', () => {
    const { result } = renderHook(() => useDexMode());
    expect(result.current).toEqual({ shiny: false, living: false });
    act(() => setDexMode({ shiny: true }));
    expect(result.current).toEqual({ shiny: true, living: false });
    expect(JSON.parse(localStorage.getItem('dexplanner:mode')!)).toEqual({ shiny: true, living: false });
  });

  it('reads a saved mode and copes with broken or unavailable storage', async () => {
    localStorage.setItem('dexplanner:mode', '{"living":true}');
    vi.resetModules();
    const fresh = await import('../src/dex.ts');
    expect(renderHook(() => fresh.useDexMode()).result.current).toEqual({ shiny: false, living: true });

    localStorage.setItem('dexplanner:mode', '{broken');
    vi.resetModules();
    const broken = await import('../src/dex.ts');
    expect(renderHook(() => broken.useDexMode()).result.current).toEqual({ shiny: false, living: false });

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => broken.setDexMode({ shiny: true })).not.toThrow();
    spy.mockRestore();
  });
});
