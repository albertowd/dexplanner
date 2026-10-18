import { useDeferredValue, useMemo, useState } from 'react';
import { dexNo, groupWithDlc, isObtainable } from '../data.ts';
import {
  dexEntries,
  entryShiny,
  entrySprite,
  isEntryRegistered,
  setDexMode,
  setEntries,
  toggleEntry,
  useDexMode,
  type DexEntry,
} from '../dex.ts';
import { useUserState } from '../store.ts';
import type { Game, PokedexData } from '../types.ts';
import { MultiSelect, type MultiSelectOption } from './MultiSelect.tsx';
import { useIncremental } from '../useIncremental.ts';
import { useI18n } from '../i18n/index.tsx';
import type { Messages } from '../i18n/en.ts';

type Status = 'all' | 'missing' | 'registered';

/** "Vulpix · Alolan Form"; female entries are labelled by the UI. */
export function entryLabel(e: DexEntry, t: Messages) {
  const formName = e.form ? (e.form.name ?? t.forms.female) : e.pokemon.defaultForm?.name;
  return formName ? `${e.pokemon.name} · ${formName}` : e.pokemon.name;
}

function matchesQuery(e: DexEntry, query: string) {
  const num = Number(query.replace('#', ''));
  if (Number.isInteger(num) && num > 0) return e.pokemon.id === num;
  const p = e.pokemon;
  return [p.name, p.slug, p.englishName, e.form?.name, e.form?.key].some((s) => s?.toLowerCase().includes(query));
}

export function DexView({ data, games }: Readonly<{ data: PokedexData; games: Map<string, Game> }>) {
  const [user, update] = useUserState();
  const mode = useDexMode();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [gens, setGens] = useState<string[]>([]);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

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
        .map((g) => ({ value: String(g), label: t.filters.gen(g) })),
    [data.pokemon, t],
  );

  const entries = useMemo(() => dexEntries(data.pokemon, mode.living), [data.pokemon, mode.living]);
  const list = useMemo(
    () =>
      entries.filter((e) => {
        const has = isEntryRegistered(e, user, mode.shiny);
        if (status === 'missing' && has) return false;
        if (status === 'registered' && !has) return false;
        if (gens.length && !gens.includes(String(e.pokemon.gen))) return false;
        if (gameIds.length && !e.pokemon.avail.some((a) => gameIds.includes(a.game) && isObtainable(a))) return false;
        return !deferredQuery || matchesQuery(e, deferredQuery);
      }),
    [entries, user, mode.shiny, status, gens, gameIds, deferredQuery],
  );

  const { visible, sentinel } = useIncremental(list.length, list);
  const markAllShown = (value: boolean) => update((s) => setEntries(s, list, mode.shiny, value));

  return (
    <section>
      <fieldset className="mode-toggles">
        <legend className="visually-hidden">{t.mode.label}</legend>
        <button
          type="button"
          className="mode-toggle"
          aria-pressed={mode.shiny}
          title={t.mode.shinyHint}
          onClick={() => setDexMode({ shiny: !mode.shiny })}
        >
          <span aria-hidden="true">✨</span> {t.mode.shiny}
        </button>
        <button
          type="button"
          className="mode-toggle"
          aria-pressed={mode.living}
          title={t.mode.livingHint}
          onClick={() => setDexMode({ living: !mode.living })}
        >
          <span aria-hidden="true">▦</span> {t.mode.living}
        </button>
      </fieldset>

      <div className="filters">
        <input
          type="search"
          placeholder={t.filters.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.filters.search}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label={t.filters.status}>
          <option value="all">{t.filters.all}</option>
          <option value="missing">{t.filters.missing}</option>
          <option value="registered">{t.filters.registered}</option>
        </select>
        <MultiSelect
          label={t.filters.generation}
          anyLabel={t.filters.allGenerations}
          manyLabel={t.filters.generations}
          options={genOptions}
          selected={gens}
          onChange={setGens}
        />
        <MultiSelect
          label={t.filters.obtainableIn}
          anyLabel={t.filters.anyGame}
          manyLabel={t.filters.games}
          options={gameOptions}
          selected={gameIds}
          onChange={setGameIds}
        />
      </div>

      <div className="list-meta">
        <span className="muted">{mode.living ? t.forms.entries(list.length) : t.dex.count(list.length)}</span>
        {list.length > 0 && list.length < entries.length && (
          <span className="bulk">
            <button className="ghost small" onClick={() => markAllShown(true)}>
              {t.dex.markShown}
            </button>
            <button className="ghost small" onClick={() => markAllShown(false)}>
              {t.dex.unmarkShown}
            </button>
          </span>
        )}
      </div>

      <ul className="grid">
        {list.slice(0, visible).map((e) => {
          const has = isEntryRegistered(e, user, mode.shiny);
          const label = entryLabel(e, t);
          const shiny = mode.shiny ? entryShiny(e) : undefined;
          const current = e.pokemon.avail.filter((a) => games.get(a.game)?.current && isObtainable(a));
          return (
            <li key={e.key} className={`card${has ? ' has' : ''}`}>
              <a href={`#/p/${e.pokemon.id}`} className="card-link">
                <img src={entrySprite(e, mode.shiny)} alt="" crossOrigin="anonymous" loading="lazy" width={96} height={96} />
                <span className="no">{dexNo(e.pokemon.id)}</span>
                <span className="name">{e.pokemon.name}</span>
                {label !== e.pokemon.name && <span className="form-name">{label.slice(e.pokemon.name.length + 3)}</span>}
                {shiny ? (
                  <span className={`shiny-tag shiny-${shiny.status}`} title={shiny.note}>
                    {shiny.status === 'locked' ? t.shiny.tagLocked : t.shiny.tagEvent}
                  </span>
                ) : (
                  <span className={current.length ? 'sources' : 'sources warn'}>{t.dex.sources(current.length)}</span>
                )}
              </a>
              <button
                className="check"
                aria-pressed={has}
                aria-label={has ? t.dex.unmark(label) : t.dex.mark(label)}
                onClick={() => update((s) => toggleEntry(s, e, mode.shiny))}
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
