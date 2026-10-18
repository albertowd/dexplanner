import { useMemo } from 'react';
import { buildPlan, dexNo, spriteUrl } from '../data.ts';
import { useUserState } from '../store.ts';
import type { PokedexData, Pokemon } from '../types.ts';

export function PlanView({ data }: Readonly<{ data: PokedexData }>) {
  const [user, update] = useUserState();
  const owned = useMemo(() => new Set(user.owned), [user.owned]);
  const gameById = new Map(data.games.map((g) => [g.id, g]));

  const plan = useMemo(() => {
    const registered = new Set(user.registered);
    const missing = data.pokemon.filter((p) => !registered.has(p.id));
    return { missing, ...buildPlan(missing, data.games, owned, user.showRetro) };
  }, [data, user.registered, owned, user.showRetro]);

  if (plan.missing.length === 0) {
    return <p className="center">Your HOME Pokédex is complete. Congratulations!</p>;
  }

  return (
    <section className="plan">
      <p className="lead">
        {plan.missing.length} Pokémon missing. Games you own come first, then the game or DLC that unlocks the most
        missing Pokémon at each step.
      </p>
      <label className="inline">
        <input
          type="checkbox"
          checked={user.showRetro}
          onChange={(e) => update(() => ({ showRetro: e.target.checked }))}
        />
        <span>Include retro games (via Pokémon Bank, which shuts down 25 Feb 2027)</span>
      </label>
      {!owned.has('go') && (
        <p className="muted small">
          Pokémon GO is left out of the plan. Tick it in <a href="#/settings">Settings</a> if you play it.
        </p>
      )}

      <ol className="steps">
        {plan.steps.map((step) => {
          const parent = step.game.parent ? gameById.get(step.game.parent) : undefined;
          return (
            <li key={step.game.id} className={step.owned ? 'owned' : ''}>
              <details>
                <summary>
                  <span className="step-title">
                    <strong>{step.game.name}</strong>
                    {step.owned ? <span className="tag ok">Owned</span> : <span className="tag">To get</span>}
                    {parent && <span className="tag">Needs {parent.short}</span>}
                  </span>
                  <span className="gain">+{step.gained.length}</span>
                </summary>
                <MiniList list={step.gained} />
              </details>
            </li>
          );
        })}
      </ol>

      {plan.unobtainable.length > 0 && (
        <details className="unobtainable">
          <summary>Not obtainable with this plan ({plan.unobtainable.length})</summary>
          <p className="muted small">
            Past events, Pokémon GO-only species (if GO is off), or retro-only species. Trading in HOME is the
            fallback.
          </p>
          <MiniList list={plan.unobtainable} />
        </details>
      )}
    </section>
  );
}

function MiniList({ list }: Readonly<{ list: Pokemon[] }>) {
  return (
    <ul className="mini">
      {list.map((p) => (
        <li key={p.id}>
          <a href={`#/p/${p.id}`}>
            <img src={spriteUrl(p.id)} alt="" crossOrigin="anonymous" loading="lazy" width={48} height={48} />
            <span>
              {dexNo(p.id)} {p.name}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
