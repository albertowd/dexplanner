import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateStorage } from '../src/migrate.ts';

beforeEach(() => localStorage.clear());

describe('migrateStorage', () => {
  it('moves data from the earlier project names to the current keys', () => {
    localStorage.setItem('pokeplan:v1', '{"registered":[1]}');
    localStorage.setItem('pokeplan:locale', 'ja');
    localStorage.setItem('pokeplan:sync-enabled', '1');
    migrateStorage();
    expect(localStorage.getItem('dexplanner:v1')).toBe('{"registered":[1]}');
    expect(localStorage.getItem('dexplanner:locale')).toBe('ja');
    expect(localStorage.getItem('dexplanner:sync-enabled')).toBe('1');
    expect(localStorage.getItem('pokeplan:v1')).toBeNull();
  });

  it('keeps newer data and still clears the old key', () => {
    localStorage.setItem('dexplanner:v1', 'new');
    localStorage.setItem('online-pokedex:v1', 'old');
    migrateStorage();
    expect(localStorage.getItem('dexplanner:v1')).toBe('new');
    expect(localStorage.getItem('online-pokedex:v1')).toBeNull();
  });

  it('copes with unavailable storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => migrateStorage()).not.toThrow();
    spy.mockRestore();
  });
});
