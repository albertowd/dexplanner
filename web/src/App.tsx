import { useEffect, useMemo, useState } from 'react';
import { usePokedex } from './data.ts';
import { useUserState } from './store.ts';
import type { Game } from './types.ts';
import { DexView } from './views/DexView.tsx';
import { PlanView } from './views/PlanView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { PokemonDetail } from './views/PokemonDetail.tsx';
import { UpdatePrompt } from './UpdatePrompt.tsx';

type Route = { view: 'dex' | 'plan' | 'settings'; pokemon?: number };

function parseHash(): Route {
  const [, view, id] = location.hash.split('/');
  if (view === 'p' && id) return { view: 'dex', pokemon: Number(id) };
  if (view === 'plan' || view === 'settings') return { view };
  return { view: 'dex' };
}

export function App() {
  const { data, error } = usePokedex();
  const [user] = useUserState();
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const games = useMemo(() => new Map<string, Game>((data?.games ?? []).map((g) => [g.id, g])), [data]);
  const selected = data && route.pokemon ? data.pokemon.find((p) => p.id === route.pokemon) : undefined;
  const registeredCount = data ? data.pokemon.filter((p) => user.registered.includes(p.id)).length : 0;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <img src="/icons/icon.svg" alt="" width={24} height={24} />
          <span>PokePlan</span>
        </a>
        <nav>
          <a href="#/" aria-current={route.view === 'dex' ? 'page' : undefined}>Pokédex</a>
          <a href="#/plan" aria-current={route.view === 'plan' ? 'page' : undefined}>Plan</a>
          <a href="#/settings" aria-current={route.view === 'settings' ? 'page' : undefined}>Settings</a>
        </nav>
        <div className="progress" title="Registered in your HOME Pokédex">
          <span>{data ? `${registeredCount}/${data.pokemon.length}` : '–'}</span>
          <progress max={data?.pokemon.length ?? 1} value={registeredCount} aria-label="Registered in your HOME Pokédex" />
        </div>
      </header>

      <main>
        {error && <p className="error">Could not load Pokédex data ({error}).</p>}
        {!data && !error && <p className="muted center">Loading Pokédex…</p>}
        {data && route.view === 'dex' && <DexView data={data} games={games} />}
        {data && route.view === 'plan' && <PlanView data={data} />}
        {data && route.view === 'settings' && <SettingsView data={data} />}
      </main>

      <footer className="footer muted small">PokePlan v{__APP_VERSION__}</footer>

      {data && selected && <PokemonDetail pokemon={selected} games={games} onClose={() => (location.hash = '#/')} />}
      <UpdatePrompt />
    </div>
  );
}
