import { useEffect, useState } from 'react';
import type { Availability, Game, PokedexData, Pokemon } from './types.ts';

export function usePokedex() {
  const [data, setData] = useState<PokedexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/data/pokedex.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

export const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
export const artworkUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`;

export const dexNo = (id: number) => `#${String(id).padStart(4, '0')}`;

/** Past events cannot be planned for. */
export const isObtainable = (a: Availability) => a.method !== 'event';

export const methodLabel: Record<string, string> = {
  catch: 'Catch',
  evolve: 'Evolve',
  gift: 'Gift',
  raid: 'Raid',
  event: 'Past event only',
  trade: 'Trade',
  dex: 'In game (gift, trade or special)',
};

export const linkLabel: Record<Game['home']['link'], string> = {
  'two-way': 'HOME two-way',
  'one-way': 'HOME one-way',
  bank: 'Via Pokémon Bank',
  transporter: 'Via Transporter + Bank',
  none: 'No HOME link',
};

/** Z-A Pokémon can never go back to older games, so prefer other two-way games when there is a choice. */
const isZaGroup = (g: Game) => g.id === 'za' || g.parent === 'za';

/** Lower is better: how good this source is as the way to put the Pokémon in HOME. */
export function routeScore(game: Game, a: Availability, owned: Set<string>): number {
  let score = 0;
  if (!isObtainable(a)) score += 1000;
  if (!game.current) score += 500;
  score += { 'two-way': 0, 'one-way': 30, bank: 60, transporter: 80, none: 900 }[game.home.link];
  if (isZaGroup(game)) score += 10;
  if (game.id === 'go') score += 20;
  if (game.id === 'home') score -= 5; // a free gift straight into HOME
  if (a.versions) score += 3;
  if (!owned.has(game.id) && game.id !== 'home') score += 100;
  return score;
}

export function bestRoute(p: Pokemon, games: Map<string, Game>, owned: Set<string>) {
  return [...p.avail]
    .filter((a) => games.has(a.game))
    .sort((x, y) => routeScore(games.get(x.game)!, x, owned) - routeScore(games.get(y.game)!, y, owned))[0];
}

export function versionNames(game: Game, ids?: string[]) {
  if (!ids) return [];
  return ids.map((id) => game.versions?.find((v) => v.id === id)?.name ?? id);
}

/** Base games in catalogue order, each with its DLC. */
export function groupWithDlc(games: Game[]): { game: Game; dlc: Game[] }[] {
  return games.filter((g) => !g.parent).map((game) => ({ game, dlc: games.filter((d) => d.parent === game.id) }));
}

export interface PlanStep {
  game: Game;
  owned: boolean;
  gained: Pokemon[];
}

/**
 * Greedy set cover: games the user owns first, then repeatedly the game (or DLC)
 * that unlocks the most still-missing Pokémon.
 */
export function buildPlan(
  missing: Pokemon[],
  games: Game[],
  owned: Set<string>,
  includeRetro: boolean,
): { steps: PlanStep[]; unobtainable: Pokemon[] } {
  // GO has nearly every species; only plan with it when the user says they play it.
  const candidates = games.filter((g) => (g.current || includeRetro) && (g.id !== 'go' || owned.has('go')));
  const provides = new Map(
    candidates.map((g) => [
      g.id,
      new Set(missing.filter((p) => p.avail.some((a) => a.game === g.id && isObtainable(a))).map((p) => p.id)),
    ]),
  );
  const byId = new Map(missing.map((p) => [p.id, p]));
  const remaining = new Set(missing.map((p) => p.id));
  const steps: PlanStep[] = [];
  const take = (g: Game, isOwned: boolean) => {
    const gained = [...provides.get(g.id)!].filter((id) => remaining.has(id));
    gained.forEach((id) => remaining.delete(id));
    if (gained.length) steps.push({ game: g, owned: isOwned, gained: gained.map((id) => byId.get(id)!) });
  };

  const isOwned = (g: Game) => owned.has(g.id) || g.id === 'home';
  // Owned games and HOME gifts first, largest contribution first.
  const free = candidates.filter(isOwned).sort((a, b) => provides.get(b.id)!.size - provides.get(a.id)!.size);
  free.forEach((g) => take(g, true));

  const pool = candidates.filter((g) => !isOwned(g));
  const have = new Set(free.map((g) => g.id));
  for (;;) {
    let best: Game | undefined;
    let bestCount = 0;
    for (const g of pool) {
      // A DLC only makes sense once its base game is owned or already in the plan.
      if (g.parent && !have.has(g.parent)) continue;
      const count = [...provides.get(g.id)!].filter((id) => remaining.has(id)).length;
      if (count > bestCount) [best, bestCount] = [g, count];
    }
    if (!best) break;
    take(best, false);
    have.add(best.id);
    pool.splice(pool.indexOf(best), 1);
  }
  return { steps, unobtainable: [...remaining].map((id) => byId.get(id)!) };
}
