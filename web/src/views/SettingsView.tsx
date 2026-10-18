import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { emptyState, parseBackup, replaceState, toggleIn, useUserState } from '../store.ts';
import type { PokedexData } from '../types.ts';
import { SyncSection } from './SyncSection.tsx';

export function SettingsView({ data }: Readonly<{ data: PokedexData }>) {
  const [user, update] = useUserState();
  const { t, locale } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [paste, setPaste] = useState('');

  const ownable = data.games.filter((g) => g.id !== 'home' && (g.current || user.showRetro));

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dexplanner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = parseBackup(await file.text());
      replaceState(next);
      setMessage(t.settings.imported(next.registered.length));
    } catch {
      setMessage(t.settings.notBackup);
    }
  };

  /** Accepts dex numbers or names separated by commas, spaces or new lines. */
  const importList = () => {
    // Names in the current language (e.g. Japanese) and in English both work.
    const byName = new Map(
      data.pokemon.flatMap((p) =>
        [p.name, p.englishName, p.slug].filter(Boolean).map((n) => [n!.toLowerCase(), p.id] as const),
      ),
    );
    const valid = new Set(data.pokemon.map((p) => p.id));
    const ids = new Set<number>();
    const unknown: string[] = [];
    for (const token of paste.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean)) {
      const num = Number(token.replace(/^#/, ''));
      const id = Number.isInteger(num) ? num : byName.get(token.toLowerCase());
      if (id && valid.has(id)) ids.add(id);
      else unknown.push(token);
    }
    update((s) => ({ registered: [...new Set([...s.registered, ...ids])] }));
    setMessage(t.settings.markedPasted(ids.size, unknown.slice(0, 10)));
    setPaste('');
  };

  return (
    <section className="settings">
      <h2>{t.settings.owned}</h2>
      <p className="muted small">{t.settings.ownedHint}</p>
      <ul className="owned">
        {ownable.map((g) => (
          <li key={g.id}>
            <label>
              <input
                type="checkbox"
                checked={user.owned.includes(g.id)}
                onChange={() => update((s) => ({ owned: toggleIn(s.owned, g.id) }))}
              />
              <span>
                {g.name} <span className="muted small">{g.platform}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="inline">
        <input type="checkbox" checked={user.showRetro} onChange={(e) => update(() => ({ showRetro: e.target.checked }))} />
        <span>{t.settings.showRetro}</span>
      </label>

      <SyncSection />

      <h2>{t.settings.homeSync}</h2>
      <div className="callout">
        <p>{t.settings.homeSyncText}</p>
      </div>

      <h3>{t.settings.markEverything}</h3>
      <p className="muted small">{t.settings.markEverythingHint}</p>
      <div className="row">
        <button
          onClick={() => {
            if (confirm(t.settings.markAllConfirm(data.pokemon.length))) {
              update(() => ({ registered: data.pokemon.map((p) => p.id) }));
              setMessage(t.settings.markedAll(data.pokemon.length));
            }
          }}
        >
          {t.settings.markAll}
        </button>
        <button
          className="secondary"
          onClick={() => {
            if (confirm(t.settings.unmarkAllConfirm)) {
              update(() => ({ registered: [] }));
              setMessage(t.settings.unmarkedAll);
            }
          }}
        >
          {t.settings.unmarkAll}
        </button>
      </div>

      <h3>{t.settings.pasteList}</h3>
      <textarea
        rows={4}
        placeholder={t.settings.pastePlaceholder}
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <button onClick={importList} disabled={!paste.trim()}>
        {t.settings.markPasted}
      </button>

      <h3>{t.settings.backup}</h3>
      <div className="row">
        <button onClick={exportBackup}>{t.settings.exportBackup}</button>
        <label className="button secondary">
          <span>{t.settings.importBackup}</span>
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        </label>
        <button
          className="danger"
          onClick={() => {
            if (confirm(t.settings.resetConfirm)) {
              replaceState(emptyState);
              setMessage(t.settings.resetDone);
            }
          }}
        >
          {t.settings.reset}
        </button>
      </div>
      {message && <output className="message">{message}</output>}

      <h2>{t.settings.about}</h2>
      <p className="muted small">{t.settings.builtFrom(new Date(data.generatedAt).toLocaleDateString(locale))}</p>
      <ul className="muted small">
        {data.sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="muted small">
        {t.settings.license[0]}
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
          {t.settings.license[1]}
        </a>
        {t.settings.license[2]}
        <a href="https://github.com/albertowd/dexplanner" target="_blank" rel="noreferrer">
          {t.settings.license[3]}
        </a>
        {t.settings.license[4]}
      </p>
      <p className="muted small">{t.settings.disclaimer}</p>
    </section>
  );
}
