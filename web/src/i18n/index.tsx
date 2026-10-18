import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { DataTranslation, Game, PokedexData, Pokemon } from '../types.ts';
import { en, type Messages } from './en.ts';
import { ptBR } from './pt-BR.ts';

export type Locale = 'en' | 'pt-BR';
export type LocalePreference = Locale | 'auto';

export const locales: Record<Locale, { name: string; messages: Messages }> = {
  en: { name: 'English', messages: en },
  'pt-BR': { name: 'Português (Brasil)', messages: ptBR },
};

/** Browser language → supported locale (any Portuguese → pt-BR, everything else → English). */
export function detectLocale(languages: readonly string[] = navigator.languages ?? [navigator.language]): Locale {
  return languages.some((l) => l.toLowerCase().startsWith('pt')) ? 'pt-BR' : 'en';
}

// The language preference is per device, so it lives outside the synced progress.
const KEY = 'pokeplan:locale';
const listeners = new Set<() => void>();

function readPreference(): LocalePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'en' || value === 'pt-BR' ? value : 'auto';
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
    if (!name && !p.avail.some((a) => a.note)) return p;
    return {
      ...p,
      name: name ?? p.name,
      // Search matches the localized and the English name.
      englishName: name ? p.name : p.englishName,
      avail: p.avail.map((a) => (a.note ? { ...a, note: note(a.note) } : a)),
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
