import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  artworkUrl,
  bestRoute,
  buildPlan,
  dexNo,
  groupWithDlc,
  isObtainable,
  routeScore,
  spriteUrl,
  usePokedex,
  versionNames,
} from '../src/data.ts';
import { byName, data, gameMap, games, pokemon } from './fixtures.ts';

describe('formatting helpers', () => {
  it('pads dex numbers to four digits', () => {
    expect(dexNo(1)).toBe('#0001');
    expect(dexNo(1025)).toBe('#1025');
  });

  it('builds sprite and artwork URLs from the PokeAPI sprites repo', () => {
    expect(spriteUrl(25)).toMatch(/PokeAPI\/sprites\/.+\/pokemon\/25\.png$/);
    expect(artworkUrl(25)).toMatch(/other\/home\/25\.png$/);
  });

  it('maps version ids to names and keeps unknown ids', () => {
    expect(versionNames(gameMap.get('sv')!, ['scarlet', 'other'])).toEqual(['Scarlet', 'other']);
    expect(versionNames(gameMap.get('sv')!)).toEqual([]);
  });
});

describe('game filter', () => {
  it('groups DLC under their base game', () => {
    const groups = groupWithDlc(games);
    expect(groups.map((g) => g.game.id)).toEqual(['sv', 'za', 'lgpe', 'go', 'home', 'usum']);
    expect(groups[0].dlc.map((d) => d.id)).toEqual(['sv-id']);
  });
});

describe('isObtainable', () => {
  it('treats past events as not obtainable', () => {
    expect(isObtainable({ game: 'usum', method: 'event' })).toBe(false);
    expect(isObtainable({ game: 'sv' })).toBe(true);
  });
});

describe('routeScore / bestRoute', () => {
  const none = new Set<string>();

  it('prefers two-way games over Z-A, and Z-A over one-way apps', () => {
    const sv = routeScore(gameMap.get('sv')!, { game: 'sv' }, none);
    const za = routeScore(gameMap.get('za')!, { game: 'za' }, none);
    const go = routeScore(gameMap.get('go')!, { game: 'go' }, none);
    expect(sv).toBeLessThan(za);
    expect(za).toBeLessThan(go);
  });

  it('prefers games the user owns', () => {
    expect(bestRoute(byName('pikachu'), gameMap, none)?.game).toBe('sv');
    expect(bestRoute(byName('pikachu'), gameMap, new Set(['za']))?.game).toBe('za');
  });

  it('ranks a HOME gift above buying a game and past events last', () => {
    expect(bestRoute(byName('magearna'), gameMap, none)?.game).toBe('home');
    expect(bestRoute(byName('mew'), gameMap, none)?.game).toBe('go');
  });

  it('penalises retro games, version exclusives and games without a HOME link', () => {
    const usum = routeScore(gameMap.get('usum')!, { game: 'usum' }, none);
    expect(usum).toBeGreaterThan(routeScore(gameMap.get('go')!, { game: 'go' }, none));
    const all = routeScore(gameMap.get('sv')!, { game: 'sv' }, none);
    expect(routeScore(gameMap.get('sv')!, { game: 'sv', versions: ['scarlet'] }, none)).toBeGreaterThan(all);
    const unlinked = { ...gameMap.get('sv')!, home: { link: 'none' as const, how: '' } };
    expect(routeScore(unlinked, { game: 'sv' }, none)).toBeGreaterThan(usum);
  });

  it('returns undefined when there is no known source', () => {
    expect(bestRoute(byName('iron-leaves'), gameMap, none)).toBeUndefined();
  });
});

describe('buildPlan', () => {
  it('starts with HOME gifts, then picks the game that unlocks the most', () => {
    const { steps } = buildPlan(pokemon, games, new Set(), false);
    expect(steps.map((s) => s.game.id)).toEqual(['home', 'sv', 'lgpe']);
    expect(steps[0].owned).toBe(true);
    expect(steps[1].gained.map((p) => p.slug)).toEqual(['pikachu', 'tyranitar', 'koraidon']);
  });

  it('puts owned games first', () => {
    const { steps } = buildPlan(pokemon, games, new Set(['za']), false);
    expect(steps.map((s) => s.game.id).slice(0, 2)).toEqual(['za', 'home']);
    expect(steps[0].owned).toBe(true);
  });

  it('only includes Pokémon GO when the user plays it', () => {
    const without = buildPlan(pokemon, games, new Set(), false);
    expect(without.steps.some((s) => s.game.id === 'go')).toBe(false);
    expect(without.unobtainable.map((p) => p.slug)).toEqual(['mew', 'walking-wake', 'iron-leaves']);

    const withGo = buildPlan(pokemon, games, new Set(['go']), false);
    expect(withGo.steps[0].game.id).toBe('go');
    expect(withGo.unobtainable.map((p) => p.slug)).toEqual(['walking-wake', 'iron-leaves']);
  });

  it('never suggests a DLC before its base game', () => {
    const dlcOnly = [{ ...byName('walking-wake'), avail: [{ game: 'sv-id' }] }];
    const { steps } = buildPlan(dlcOnly, games, new Set(), false);
    expect(steps).toEqual([]);
    const owned = buildPlan(dlcOnly, games, new Set(['sv']), false);
    expect(owned.steps.map((s) => s.game.id)).toEqual(['sv-id']);
  });

  it('includes retro games only when asked', () => {
    const retroOnly = [{ ...byName('tyranitar'), avail: [{ game: 'usum' }] }];
    expect(buildPlan(retroOnly, games, new Set(), false).steps).toEqual([]);
    expect(buildPlan(retroOnly, games, new Set(), true).steps.map((s) => s.game.id)).toEqual(['usum']);
  });
});

describe('usePokedex', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the data file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data))));
    const { result } = renderHook(() => usePokedex());
    await waitFor(() => expect(result.current.data?.pokemon).toHaveLength(pokemon.length));
    expect(result.current.error).toBeNull();
  });

  it('reports HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const { result } = renderHook(() => usePokedex());
    await waitFor(() => expect(result.current.error).toBe('HTTP 503'));
  });
});
