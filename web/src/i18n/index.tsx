import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { DataTranslation, Game, PokedexData, Pokemon } from '../types.ts';
import { en, type Messages } from './en.ts';
import { es } from './es.ts';
import { it } from './it.ts';
import { ja } from './ja.ts';
import { ptBR } from './pt-BR.ts';

export type Locale = 'en' | 'pt-BR' | 'es' | 'it' | 'ja';
export type LocalePreference = Locale | 'auto';

export const locales: Record<Locale, { name: string; messages: Messages }> = {
  en: { name: 'English', messages: en },
  'pt-BR': { name: 'Português (Brasil)', messages: ptBR },
  es: { name: 'Español', messages: es },
  it: { name: 'Italiano', messages: it },
  ja: { name: '日本語', messages: ja },
};

/** Browser language prefix → supported locale. */
const byLanguage: Record<string, Locale> = { en: 'en', pt: 'pt-BR', es: 'es', it: 'it', ja: 'ja' };

/** First supported language in the browser's preference order (any Portuguese → pt-BR); English otherwise. */
export function detectLocale(languages: readonly string[] = navigator.languages ?? [navigator.language]): Locale {
  for (const language of languages) {
    const locale = byLanguage[language.toLowerCase().split('-')[0]];
    if (locale) return locale;
  }
  return 'en';
}

// The language preference is per device, so it lives outside the synced progress.
const KEY = 'dexplanner:locale';
const listeners = new Set<() => void>();

function readPreference(): LocalePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value && value in locales ? (value as Locale) : 'auto';
  } catch {
    return 'auto';
  }
}

let preference = readPreference();

export function setLocalePreference(next: LocalePreference) {
  preference = next;
  try {
    if (next === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // keep it for this session only
  }
  listeners.forEach((l) => l());
}

function useLocalePreference() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => preference,
  );
}

export interface I18n {
  locale: Locale;
  preference: LocalePreference;
  t: Messages;
}

const I18nContext = createContext<I18n>({ locale: 'en', preference: 'auto', t: en });

export const useI18n = () => useContext(I18nContext);

/** Data text (game names, HOME instructions, notes) in the given language, falling back to English. */
export function localizeData(data: PokedexData, translation: DataTranslation | undefined): PokedexData {
  if (!translation) return data;
  const note = (text: string) =>
    text
      .split(' · ')
      .map((part) => translation.notes?.[part] ?? part)
      .join(' · ');
  const game = (g: Game): Game => {
    const t = translation.games?.[g.id];
    if (!t) return g;
    return {
      ...g,
      name: t.name ?? g.name,
      short: t.short ?? g.short,
      versions: g.versions?.map((v) => ({ ...v, name: t.versions?.[v.id] ?? v.name })),
      home: { ...g.home, how: t.how ?? g.home.how, note: g.home.note && (t.note ?? g.home.note) },
    };
  };
  const pokemon = (p: Pokemon): Pokemon => {
    const name = translation.pokemon?.[p.id];
    const formName = (key: string, fallback?: string) => translation.forms?.[key] ?? fallback;
    return {
      ...p,
      name: name ?? p.name,
      // Search matches the localized and the English name.
      englishName: name ? p.name : p.englishName,
      avail: p.avail.map((a) => (a.note ? { ...a, note: note(a.note) } : a)),
      shinyNote: p.shinyNote && note(p.shinyNote),
      defaultForm: p.defaultForm && { ...p.defaultForm, name: formName(p.defaultForm.key, p.defaultForm.name)! },
      forms: p.forms?.map((f) => ({ ...f, name: formName(f.key, f.name), shinyNote: f.shinyNote && note(f.shinyNote) })),
    };
  };
  return { ...data, games: data.games.map(game), pokemon: data.pokemon.map(pokemon) };
}

export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pref = useLocalePreference();
  const locale = pref === 'auto' ? detectLocale() : pref;
  const value = useMemo(() => ({ locale, preference: pref, t: locales[locale].messages }), [locale, pref]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
