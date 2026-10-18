import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// The store reads localStorage when the module loads, so each test gets a fresh copy.
async function loadStore() {
  vi.resetModules();
  return import('../src/store.ts');
}

beforeEach(() => localStorage.clear());

describe('toggleIn', () => {
  it('adds a missing item and removes a present one', async () => {
    const { toggleIn } = await loadStore();
    expect(toggleIn([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleIn([1, 2], 2)).toEqual([1]);
  });
});

describe('parseBackup', () => {
  it('accepts a backup and drops invalid values', async () => {
    const { parseBackup } = await loadStore();
    const parsed = parseBackup(JSON.stringify({ registered: [1, 'x', 2.5, 3], owned: ['sv', 4], showRetro: 1 }));
    expect(parsed).toEqual({ v: 1, registered: [1, 3], owned: ['sv'], showRetro: true });
  });

  it('defaults missing optional fields', async () => {
    const { parseBackup } = await loadStore();
    expect(parseBackup('{"registered":[]}')).toEqual({ v: 1, registered: [], owned: [], showRetro: false });
  });

  it('rejects other JSON', async () => {
    const { parseBackup } = await loadStore();
    expect(() => parseBackup('{"foo":1}')).toThrow('not a PokePlan backup');
    expect(() => parseBackup('null')).toThrow('not a PokePlan backup');
  });
});

describe('useUserState', () => {
  it('starts empty and persists updates', async () => {
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    expect(result.current[0].registered).toEqual([]);
    act(() => result.current[1](() => ({ registered: [25] })));
    expect(result.current[0].registered).toEqual([25]);
    expect(JSON.parse(localStorage.getItem('pokeplan:v1')!).registered).toEqual([25]);
  });

  it('migrates progress saved under the old project name', async () => {
    localStorage.setItem('online-pokedex:v1', JSON.stringify({ v: 1, registered: [7], owned: ['sv'], showRetro: false }));
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    expect(result.current[0]).toMatchObject({ registered: [7], owned: ['sv'] });
  });

  it('ignores corrupt storage', async () => {
    localStorage.setItem('pokeplan:v1', '{not json');
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    expect(result.current[0].registered).toEqual([]);
  });

  it('keeps working in memory when storage is unavailable', async () => {
    const { useUserState } = await loadStore();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const { result } = renderHook(() => useUserState());
    act(() => result.current[1](() => ({ owned: ['za'] })));
    expect(result.current[0].owned).toEqual(['za']);
    spy.mockRestore();
  });

  it('picks up changes made in another tab', async () => {
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    localStorage.setItem('pokeplan:v1', JSON.stringify({ v: 1, registered: [9], owned: [], showRetro: false }));
    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', { key: 'pokeplan:v1' }));
      globalThis.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    });
    expect(result.current[0].registered).toEqual([9]);
  });

  it('replaceState swaps the whole state', async () => {
    const { useUserState, replaceState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    act(() => replaceState({ v: 1, registered: [1, 2], owned: [], showRetro: true }));
    expect(result.current[0]).toEqual({ v: 1, registered: [1, 2], owned: [], showRetro: true });
  });
});
