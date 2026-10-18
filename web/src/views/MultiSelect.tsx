import { useEffect, useRef } from 'react';
import { toggleIn } from '../store.ts';

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
  /** Summary noun for several selections, e.g. "games" → "3 games". */
  plural: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** A dropdown of checkboxes. Nothing ticked means no filtering. */
export function MultiSelect({ label, anyLabel, plural, options, selected, onChange }: Readonly<Props>) {
  const details = useRef<HTMLDetailsElement>(null);

  // Close like a native select: on Escape, or when clicking or focusing outside.
  useEffect(() => {
    const closeOutside = (e: Event) => {
      if (details.current?.open && !details.current.contains(e.target as Node)) details.current.open = false;
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      const el = details.current;
      if (e.key === 'Escape' && el?.open && el.contains(document.activeElement)) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const summary = summarize(options, selected, anyLabel, plural);

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
          <button type="button" className="ghost small" aria-label={`Clear ${label}`} onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </fieldset>
    </details>
  );
}

function summarize(options: MultiSelectOption[], selected: string[], anyLabel: string, plural: string) {
  if (selected.length === 0) return anyLabel;
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? anyLabel;
  return `${selected.length} ${plural}`;
}
