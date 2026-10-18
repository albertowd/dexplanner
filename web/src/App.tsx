import { useEffect, useMemo, useState } from 'react';
import { usePokedex } from './data.ts';
import { localizeData, useI18n } from './i18n/index.tsx';
import { useUserState } from './store.ts';
import type { Game } from './types.ts';
import { DexView } from './views/DexView.tsx';
import { PlanView } from './views/PlanView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { PokemonDetail } from './views/PokemonDetail.tsx';
import { UpdatePrompt } from './UpdatePrompt.tsx';
import { SyncIndicator } from './SyncIndicator.tsx';
import { LanguageMenu } from './header/LanguageMenu.tsx';
import { AccountMenu } from './header/AccountMenu.tsx';

type Route = { view: 'dex' | 'plan' | 'settings'; pokemon?: number };

function parseHash(): Route {
  const [, view, id] = location.hash.split('/');
  if (view === 'p' && id) return { view: 'dex', pokemon: Number(id) };
  if (view === 'plan' || view === 'settings') return { view };
  return { view: 'dex' };
}

export function App() {
  const { data: rawData, error } = usePokedex();
  const { t, locale } = useI18n();
  const [user] = useUserState();
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // Game names, HOME instructions and notes in the chosen language.
  const data = useMemo(() => rawData && localizeData(rawData, rawData.translations?.[locale]), [rawData, locale]);
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
          <a href="#/" aria-current={route.view === 'dex' ? 'page' : undefined}>{t.nav.dex}</a>
          <a href="#/plan" aria-current={route.view === 'plan' ? 'page' : undefined}>{t.nav.plan}</a>
          <a href="#/settings" aria-current={route.view === 'settings' ? 'page' : undefined}>{t.nav.settings}</a>
        </nav>
        <div className="header-tools">
          <SyncIndicator />
          <LanguageMenu />
          <AccountMenu />
        </div>
        <div className="progress" title={t.app.progress}>
          <span>{data ? `${registeredCount}/${data.pokemon.length}` : '–'}</span>
          <progress max={data?.pokemon.length ?? 1} value={registeredCount} aria-label={t.app.progress} />
        </div>
      </header>

      <main>
        {error && <p className="error">{t.app.loadError(error)}</p>}
        {!data && !error && <p className="muted center">{t.app.loading}</p>}
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
