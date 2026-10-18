import { useState } from 'react';
import { parseBackup, replaceState, toggleIn, useUserState } from '../store.ts';
import type { PokedexData } from '../types.ts';

export function SettingsView({ data }: Readonly<{ data: PokedexData }>) {
  const [user, update] = useUserState();
  const [message, setMessage] = useState<string | null>(null);
  const [paste, setPaste] = useState('');

  const ownable = data.games.filter((g) => g.id !== 'home' && (g.current || user.showRetro));

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pokeplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = parseBackup(await file.text());
      replaceState(next);
      setMessage(`Imported ${next.registered.length} registered Pokémon.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  /** Accepts dex numbers or names separated by commas, spaces or new lines. */
  const importList = () => {
    const byName = new Map(data.pokemon.flatMap((p) => [[p.name.toLowerCase(), p.id], [p.slug, p.id]]));
    const valid = new Set(data.pokemon.map((p) => p.id));
    const ids = new Set<number>();
    const unknown: string[] = [];
    for (const token of paste.split(/[\n,;\t]+/).map((t) => t.trim()).filter(Boolean)) {
      const num = Number(token.replace(/^#/, ''));
      const id = Number.isInteger(num) ? num : byName.get(token.toLowerCase());
      if (id && valid.has(id)) ids.add(id);
      else unknown.push(token);
    }
    update((s) => ({ registered: [...new Set([...s.registered, ...ids])] }));
    const notRecognised = unknown.length ? ` Not recognised: ${unknown.slice(0, 10).join(', ')}` : '';
    setMessage(`Marked ${ids.size} Pokémon as registered.${notRecognised}`);
    setPaste('');
  };

  return (
    <section className="settings">
      <h2>Games you own</h2>
      <p className="muted small">The plan uses these first, and each Pokémon's best route prefers them.</p>
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
        <span>Show retro games (3DS, DS, GBA)</span>
      </label>

      <h2>Pokémon HOME sync</h2>
      <div className="callout">
        <p>
          Pokémon HOME has no public API, export or share feature, so this app can't read your HOME Pokédex
          automatically. Mark Pokémon as you register them, or paste a list below. Your progress is stored only in
          this browser; use a backup to move it to another device.
        </p>
      </div>

      <h3>Mark everything</h3>
      <p className="muted small">
        Only a few Pokémon left to catch? Mark everything as registered, then untick the ones you're missing.
      </p>
      <div className="row">
        <button
          onClick={() => {
            if (confirm(`Mark all ${data.pokemon.length} Pokémon as registered?`)) {
              update(() => ({ registered: data.pokemon.map((p) => p.id) }));
              setMessage(`Marked all ${data.pokemon.length} Pokémon as registered.`);
            }
          }}
        >
          Mark all as registered
        </button>
        <button
          className="secondary"
          onClick={() => {
            if (confirm('Unmark every registered Pokémon?')) {
              update(() => ({ registered: [] }));
              setMessage('All Pokémon unmarked.');
            }
          }}
        >
          Unmark all
        </button>
      </div>

      <h3>Paste a list</h3>
      <textarea
        rows={4}
        placeholder="e.g. 1, 4, 7, pikachu, Mewtwo"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <button onClick={importList} disabled={!paste.trim()}>
        Mark as registered
      </button>

      <h3>Backup</h3>
      <div className="row">
        <button onClick={exportBackup}>Export backup</button>
        <label className="button secondary">
          <span>Import backup</span>
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        </label>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Clear all registered Pokémon and owned games?')) {
              replaceState({ v: 1, registered: [], owned: [], showRetro: false });
              setMessage('Progress cleared.');
            }
          }}
        >
          Reset
        </button>
      </div>
      {message && (
        <output className="message">{message}</output>
      )}

      <h2>About the data</h2>
      <p className="muted small">
        Data built {new Date(data.generatedAt).toLocaleDateString()} from:
      </p>
      <ul className="muted small">
        {data.sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="muted small">
        {'PokePlan is free software under the '}
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
          GNU AGPL v3.0
        </a>
        {'. '}
        <a href="https://github.com/albertowd/pokeplan" target="_blank" rel="noreferrer">
          Source code and contributions
        </a>
        {'.'}
      </p>
      <p className="muted small">
        Unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon
        and Pokémon character names are trademarks of Nintendo; Pokémon images are © Nintendo, Creatures and GAME
        FREAK.
      </p>
    </section>
  );
}
