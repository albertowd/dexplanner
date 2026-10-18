// Small inline flags: Windows doesn't render flag emoji, so these are drawn as SVG.
import type { Locale } from './index.tsx';

const size = { width: 21, height: 14, className: 'flag', 'aria-hidden': true } as const;

function UsFlag() {
  const stripe = 14 / 13;
  return (
    <svg viewBox="0 0 21 14" {...size}>
      <rect width="21" height="14" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * stripe} width="21" height={stripe} fill="#b22234" />
      ))}
      <rect width="9" height={stripe * 7} fill="#3c3b6e" />
      {[1.5, 4.5, 7.5].flatMap((x) =>
        [1.6, 3.8, 6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#fff" />),
      )}
    </svg>
  );
}

function BrFlag() {
  return (
    <svg viewBox="0 0 21 14" {...size}>
      <rect width="21" height="14" fill="#009c3b" />
      <path d="M10.5 1.6 19.3 7 10.5 12.4 1.7 7z" fill="#ffdf00" />
      <circle cx="10.5" cy="7" r="3.2" fill="#002776" />
      <path d="M7.4 6.3a7 7 0 0 1 6.2 1.5" stroke="#fff" strokeWidth="0.55" fill="none" />
    </svg>
  );
}

/** Globe for "follow the browser language". */
export function AutoIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={14} className="flag auto" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 8h13M8 1.5c2.2 2 2.2 11 0 13M8 1.5c-2.2 2-2.2 11 0 13" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function Flag({ locale }: Readonly<{ locale: Locale }>) {
  return locale === 'pt-BR' ? <BrFlag /> : <UsFlag />;
}
