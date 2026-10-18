import { useMemo } from 'react';
import { buildPlan, dexNo, spriteUrl } from '../data.ts';
import { useUserState } from '../store.ts';
import type { PokedexData, Pokemon } from '../types.ts';
import { useI18n } from '../i18n/index.tsx';

export function PlanView({ data }: Readonly<{ data: PokedexData }>) {
  const [user, update] = useUserState();
  const { t } = useI18n();
  const owned = useMemo(() => new Set(user.owned), [user.owned]);
  const gameById = new Map(data.games.map((g) => [g.id, g]));

  const plan = useMemo(() => {
    const registered = new Set(user.registered);
    const missing = data.pokemon.filter((p) => !registered.has(p.id));
    return { missing, ...buildPlan(missing, data.games, owned, user.showRetro) };
  }, [data, user.registered, owned, user.showRetro]);

  if (plan.missing.length === 0) {
    return <p className="center">{t.plan.complete}</p>;
  }

  return (
    <section className="plan">
      <p className="lead">{t.plan.lead(plan.missing.length)}</p>
      <label className="inline">
        <input
          type="checkbox"
          checked={user.showRetro}
          onChange={(e) => update(() => ({ showRetro: e.target.checked }))}
        />
        <span>{t.plan.includeRetro}</span>
      </label>
      {!owned.has('go') && (
        <p className="muted small">
          {t.plan.goLeftOut[0]}
          <a href="#/settings">{t.plan.goLeftOut[1]}</a>
          {t.plan.goLeftOut[2]}
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
                    {step.owned ? <span className="tag ok">{t.plan.owned}</span> : <span className="tag">{t.plan.toGet}</span>}
                    {parent && <span className="tag">{t.plan.needs(parent.short)}</span>}
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
          <summary>{t.plan.unobtainable(plan.unobtainable.length)}</summary>
          <p className="muted small">{t.plan.unobtainableText}</p>
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
