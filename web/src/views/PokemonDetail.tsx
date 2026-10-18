import { useEffect, useRef } from 'react';
import { artworkUrl, bestRoute, dexNo, isObtainable, versionNames } from '../data.ts';
import { useI18n } from '../i18n/index.tsx';
import { useUserState } from '../store.ts';
import { dexEntries, entryShiny, entrySprite, isEntryRegistered, toggleEntry, useDexMode } from '../dex.ts';
import { entryLabel } from './DexView.tsx';
import type { Availability, Game, Pokemon } from '../types.ts';

interface Props {
  pokemon: Pokemon;
  games: Map<string, Game>;
  onClose: () => void;
}

export function PokemonDetail({ pokemon: p, games, onClose }: Readonly<Props>) {
  const [user, update] = useUserState();
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const mode = useDexMode();
  const owned = new Set(user.owned);
  const [speciesEntry, ...formEntries] = dexEntries([p], true);
  const has = isEntryRegistered(speciesEntry, user, mode.shiny);
  const shiny = entryShiny(speciesEntry);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, [p.id]);

  const best = bestRoute(p, games, owned);
  const rows = p.avail.filter((a) => games.has(a.game));
  const current = rows.filter((a) => games.get(a.game)!.current);
  const retro = rows.filter((a) => !games.get(a.game)!.current);

  return (
    <dialog
      ref={dialog}
      className="detail"
      onClose={onClose}
      closedby="any" // NOSONAR: valid HTML attribute (light dismiss); the rule's attribute list predates it
      aria-labelledby="detail-title"
    >
      <div className="detail-body">
        <button className="close ghost" onClick={() => dialog.current?.close()} aria-label={t.detail.close}>
          ✕
        </button>
        <div className="detail-head">
          <img src={artworkUrl(p.id, mode.shiny)} alt="" crossOrigin="anonymous" width={160} height={160} />
          <div>
            <span className="no">{dexNo(p.id)}</span>
            <h2 id="detail-title">{p.name}</h2>
            <p className="muted">
              {t.filters.gen(p.gen)}
              {p.legendary && ` · ${t.detail.legendary}`}
              {p.mythical && ` · ${t.detail.mythical}`}
            </p>
            <p className={shiny ? `shiny-status shiny-${shiny.status}` : 'shiny-status'}>
              ✨ {shiny ? t.shiny[shiny.status] : t.shiny.available}
              {shiny?.note && <span className="muted small"> · {shiny.note}</span>}
            </p>
            <button
              className={has ? 'secondary' : ''}
              aria-pressed={has}
              onClick={() => update((s) => toggleEntry(s, speciesEntry, mode.shiny))}
            >
              {mode.shiny && '✨ '}
              {has ? t.detail.isRegistered : t.detail.markRegistered}
            </button>
          </div>
        </div>

        {best && isObtainable(best) && games.get(best.game)!.current ? (
          <section className="best">
            <h3>{t.detail.best}</h3>
            <SourceRow a={best} game={games.get(best.game)!} owned={owned} highlight />
          </section>
        ) : (
          <section className="best warn">
            <h3>{t.detail.noCurrent}</h3>
            <p>{t.detail.noCurrentText}</p>
          </section>
        )}

        <section>
          <h3>{t.detail.current}</h3>
          {current.length ? (
            <ul className="sources-list">
              {current.map((a) => (
                <li key={a.game}>
                  <SourceRow a={a} game={games.get(a.game)!} owned={owned} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.detail.none}</p>
          )}
        </section>

        {formEntries.length > 0 && (
          <section>
            <h3>
              {t.forms.title} ({formEntries.length})
            </h3>
            <ul className="forms-list">
              {formEntries.map((e) => {
                const formHas = isEntryRegistered(e, user, mode.shiny);
                const label = entryLabel(e, t);
                const formShiny = entryShiny(e);
                return (
                  <li key={e.key}>
                    <img src={entrySprite(e, mode.shiny)} alt="" crossOrigin="anonymous" loading="lazy" width={56} height={56} />
                    <span className="form-label">
                      {label.slice(p.name.length + 3)}
                      <span className="tag">{t.forms.kind[e.form!.kind]}</span>
                      {mode.shiny && formShiny && (
                        <span className={`shiny-tag shiny-${formShiny.status}`} title={formShiny.note}>
                          {formShiny.status === 'locked' ? t.shiny.tagLocked : t.shiny.tagEvent}
                        </span>
                      )}
                    </span>
                    <button
                      className="check"
                      aria-pressed={formHas}
                      aria-label={formHas ? t.dex.unmark(label) : t.dex.mark(label)}
                      onClick={() => update((s) => toggleEntry(s, e, mode.shiny))}
                    >
                      {formHas ? '✓' : '+'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {retro.length > 0 && (
          <details>
            <summary>{t.detail.retro(retro.length)}</summary>
            <ul className="sources-list">
              {retro.map((a) => (
                <li key={a.game}>
                  <SourceRow a={a} game={games.get(a.game)!} owned={owned} />
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="footnote muted">{t.detail.footnote}</p>
      </div>
    </dialog>
  );
}

function SourceRow({ a, game, owned, highlight }: Readonly<{ a: Availability; game: Game; owned: Set<string>; highlight?: boolean }>) {
  const { t } = useI18n();
  const versions = versionNames(game, a.versions);
  return (
    <div className={`source${highlight ? ' highlight' : ''}${isObtainable(a) ? '' : ' past'}`}>
      <div className="source-title">
        <strong>{game.name}</strong>
        {owned.has(game.id) && <span className="tag ok">{t.detail.owned}</span>}
        {versions.length > 0 && <span className="tag excl">{t.detail.only(versions.join(' / '))}</span>}
        {a.method && <span className="tag">{t.method[a.method]}</span>}
        <span className={`tag link-${game.home.link}`}>{t.link[game.home.link]}</span>
      </div>
      {a.note && <p className="note">{a.note}</p>}
      <p className="how">{game.home.how}</p>
      {game.home.note && <p className="caveat">{game.home.note}</p>}
    </div>
  );
}
