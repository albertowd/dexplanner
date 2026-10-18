import { emptyState } from '../src/store.ts';
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
    expect(parsed).toEqual({ ...emptyState, registered: [1, 3], owned: ['sv'], showRetro: true });
  });

  it('defaults missing optional fields', async () => {
    const { parseBackup } = await loadStore();
    expect(parseBackup('{"registered":[]}')).toEqual({ ...emptyState, registered: [], owned: [], showRetro: false });
  });

  it('rejects other JSON', async () => {
    const { parseBackup } = await loadStore();
    expect(() => parseBackup('{"foo":1}')).toThrow('not a DexPlanner backup');
    expect(() => parseBackup('null')).toThrow('not a DexPlanner backup');
  });
});

describe('useUserState', () => {
  it('starts empty and persists updates', async () => {
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    expect(result.current[0].registered).toEqual([]);
    act(() => result.current[1](() => ({ registered: [25] })));
    expect(result.current[0].registered).toEqual([25]);
    expect(JSON.parse(localStorage.getItem('dexplanner:v1')!).registered).toEqual([25]);
  });

  it('reads progress migrated from the old project names', async () => {
    localStorage.setItem('pokeplan:v1', JSON.stringify({ ...emptyState, registered: [7], owned: ['sv'], showRetro: false }));
    const { migrateStorage } = await import('../src/migrate.ts');
    migrateStorage();
    const { useUserState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    expect(result.current[0]).toMatchObject({ registered: [7], owned: ['sv'] });
  });

  it('ignores corrupt storage', async () => {
    localStorage.setItem('dexplanner:v1', '{not json');
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
    localStorage.setItem('dexplanner:v1', JSON.stringify({ ...emptyState, registered: [9], owned: [], showRetro: false }));
    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', { key: 'dexplanner:v1' }));
      globalThis.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    });
    expect(result.current[0].registered).toEqual([9]);
  });

  it('replaceState swaps the whole state', async () => {
    const { useUserState, replaceState } = await loadStore();
    const { result } = renderHook(() => useUserState());
    act(() => replaceState({ ...emptyState, registered: [1, 2], owned: [], showRetro: true }));
    expect(result.current[0]).toEqual({ ...emptyState, registered: [1, 2], owned: [], showRetro: true });
  });
});
