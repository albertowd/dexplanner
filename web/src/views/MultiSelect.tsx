import { useRef } from 'react';
import { toggleIn } from '../store.ts';
import { useI18n } from '../i18n/index.tsx';
import { useDismissable } from '../useDismissable.ts';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Shown indented under the previous top-level option (e.g. a DLC under its game). */
  child?: boolean;
}

interface Props {
  label: string;
  /** Summary shown when nothing is selected, e.g. "Any game". */
  anyLabel: string;
  /** Summary for several selections, e.g. 3 → "3 games". */
  manyLabel: (n: number) => string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** A dropdown of checkboxes. Nothing ticked means no filtering. */
export function MultiSelect({ label, anyLabel, manyLabel, options, selected, onChange }: Readonly<Props>) {
  const { t } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);

  useDismissable(details);

  const summary = summarize(options, selected, anyLabel, manyLabel);

  return (
    <details ref={details} className="multiselect">
      <summary aria-label={`${label}: ${summary}`}>
        <span>{summary}</span>
      </summary>
      <fieldset className="multiselect-panel">
        <legend className="visually-hidden">{label}</legend>
        {options.map((o) => (
          <label key={o.value} className={o.child ? 'child' : undefined}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onChange(toggleIn(selected, o.value))}
            />
            <span>{o.label}</span>
          </label>
        ))}
        {selected.length > 0 && (
          <button type="button" className="ghost small" aria-label={t.filters.clearFilter(label)} onClick={() => onChange([])}>
            {t.filters.clear}
          </button>
        )}
      </fieldset>
    </details>
  );
}

function summarize(options: MultiSelectOption[], selected: string[], anyLabel: string, manyLabel: (n: number) => string) {
  if (selected.length === 0) return anyLabel;
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? anyLabel;
  return manyLabel(selected.length);
}
