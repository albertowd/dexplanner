import { useEffect, useRef } from 'react';
import { artworkUrl, bestRoute, dexNo, isObtainable, versionNames } from '../data.ts';
import { useI18n } from '../i18n/index.tsx';
import { toggleIn, useUserState } from '../store.ts';
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
  const owned = new Set(user.owned);
  const has = user.registered.includes(p.id);

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
          <img src={artworkUrl(p.id)} alt="" crossOrigin="anonymous" width={160} height={160} />
          <div>
            <span className="no">{dexNo(p.id)}</span>
            <h2 id="detail-title">{p.name}</h2>
            <p className="muted">
              {t.filters.gen(p.gen)}
              {p.legendary && ` · ${t.detail.legendary}`}
              {p.mythical && ` · ${t.detail.mythical}`}
            </p>
            <button
              className={has ? 'secondary' : ''}
              aria-pressed={has}
              onClick={() => update((s) => ({ registered: toggleIn(s.registered, p.id) }))}
            >
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
