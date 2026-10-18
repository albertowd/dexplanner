import { useRef, type ReactNode } from 'react';
import { AutoIcon, Flag } from '../i18n/flags.tsx';
import { locales, setLocalePreference, useI18n, type Locale, type LocalePreference } from '../i18n/index.tsx';
import { closeDropdown, useDismissable } from '../useDismissable.ts';

/** Header dropdown to pick the interface language; shows the current language's flag. */
export function LanguageMenu() {
  const { t, locale, preference } = useI18n();
  const details = useRef<HTMLDetailsElement>(null);
  useDismissable(details);

  const choose = (value: LocalePreference, el: HTMLElement) => {
    setLocalePreference(value);
    closeDropdown(el);
  };
  const options: { value: LocalePreference; label: string; icon: ReactNode }[] = [
    { value: 'auto', label: t.language.auto, icon: <AutoIcon /> },
    ...(Object.keys(locales) as Locale[]).map((id) => ({ value: id, label: locales[id].name, icon: <Flag locale={id} /> })),
  ];

  return (
    <details ref={details} className="menu language-menu">
      <summary aria-label={t.language.current(locales[locale].name)} title={t.language.label}>
        <Flag locale={locale} />
      </summary>
      <fieldset className="menu-panel">
        <legend className="visually-hidden">{t.language.label}</legend>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="menu-item"
            aria-pressed={preference === o.value}
            lang={o.value === 'auto' ? undefined : o.value}
            onClick={(e) => choose(o.value, e.currentTarget)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        ))}
      </fieldset>
    </details>
  );
}
