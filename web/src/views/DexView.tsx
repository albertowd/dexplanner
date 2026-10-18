import { useDeferredValue, useMemo, useState } from 'react';
import { dexNo, groupWithDlc, isObtainable, spriteUrl } from '../data.ts';
import { toggleIn, useUserState } from '../store.ts';
import type { Game, PokedexData } from '../types.ts';
import { MultiSelect, type MultiSelectOption } from './MultiSelect.tsx';
import { useIncremental } from '../useIncremental.ts';

type Status = 'all' | 'missing' | 'registered';

export function DexView({ data, games }: Readonly<{ data: PokedexData; games: Map<string, Game> }>) {
  const [user, update] = useUserState();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [gens, setGens] = useState<string[]>([]);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const registered = useMemo(() => new Set(user.registered), [user.registered]);
  const gameOptions = useMemo(() => {
    const shown = data.games.filter((g) => g.current || user.showRetro);
    return groupWithDlc(shown).flatMap(({ game, dlc }): MultiSelectOption[] => [
      { value: game.id, label: game.name },
      ...dlc.map((d) => ({ value: d.id, label: d.name, child: true })),
    ]);
  }, [data.games, user.showRetro]);
  const genOptions = useMemo(
    () =>
      [...new Set(data.pokemon.map((p) => p.gen))]
        .sort((a, b) => a - b)
        .map((g) => ({ value: String(g), label: `Gen ${g}` })),
    [data.pokemon],
  );

  const list = useMemo(
    () =>
      data.pokemon.filter((p) => {
        if (status === 'missing' && registered.has(p.id)) return false;
        if (status === 'registered' && !registered.has(p.id)) return false;
        if (gens.length && !gens.includes(String(p.gen))) return false;
        if (gameIds.length && !p.avail.some((a) => gameIds.includes(a.game) && isObtainable(a))) return false;
        if (deferredQuery) {
          const num = Number(deferredQuery.replace('#', ''));
          if (Number.isInteger(num) && num > 0) return p.id === num;
          return p.name.toLowerCase().includes(deferredQuery) || p.slug.includes(deferredQuery);
        }
        return true;
      }),
    [data.pokemon, status, registered, gens, gameIds, deferredQuery],
  );

  const { visible, sentinel } = useIncremental(list.length, list);

  const toggle = (id: number) => update((s) => ({ registered: toggleIn(s.registered, id) }));
  const markAllShown = (value: boolean) =>
    update((s) => {
      const ids = new Set(s.registered);
      list.forEach((p) => (value ? ids.add(p.id) : ids.delete(p.id)));
      return { registered: [...ids] };
    });

  return (
    <section>
      <div className="filters">
        <input
          type="search"
          placeholder="Search by name or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status">
          <option value="all">All</option>
          <option value="missing">Missing in HOME</option>
          <option value="registered">Registered</option>
        </select>
        <MultiSelect
          label="Generation"
          anyLabel="All generations"
          plural="generations"
          options={genOptions}
          selected={gens}
          onChange={setGens}
        />
        <MultiSelect
          label="Obtainable in"
          anyLabel="Any game or DLC"
          plural="games"
          options={gameOptions}
          selected={gameIds}
          onChange={setGameIds}
        />
      </div>

      <div className="list-meta">
        <span className="muted">{list.length} Pokémon</span>
        {list.length > 0 && list.length < data.pokemon.length && (
          <span className="bulk">
            <button className="ghost small" onClick={() => markAllShown(true)}>
              Mark shown as registered
            </button>
            <button className="ghost small" onClick={() => markAllShown(false)}>
              Unmark shown
            </button>
          </span>
        )}
      </div>

      <ul className="grid">
        {list.slice(0, visible).map((p) => {
          const has = registered.has(p.id);
          const current = p.avail.filter((a) => games.get(a.game)?.current && isObtainable(a));
          return (
            <li key={p.id} className={`card${has ? ' has' : ''}`}>
              <a href={`#/p/${p.id}`} className="card-link">
                <img src={spriteUrl(p.id)} alt="" crossOrigin="anonymous" loading="lazy" width={96} height={96} />
                <span className="no">{dexNo(p.id)}</span>
                <span className="name">{p.name}</span>
                <span className={current.length ? 'sources' : 'sources warn'}>{sourcesLabel(current.length)}</span>
              </a>
              <button
                className="check"
                aria-pressed={has}
                aria-label={has ? `Unmark ${p.name}` : `Mark ${p.name} as registered`}
                onClick={() => toggle(p.id)}
              >
                {has ? '✓' : '+'}
              </button>
            </li>
          );
        })}
      </ul>
      {visible < list.length && <div ref={sentinel} className="sentinel" aria-hidden="true" />}
    </section>
  );
}

function sourcesLabel(count: number) {
  if (count === 0) return 'No current source';
  return count === 1 ? '1 current source' : `${count} current sources`;
}
