// Shape of public/data/pokedex.json, produced by scripts/build-data.mjs.

/** How Pokémon caught in a game reach Pokémon HOME. */
export type HomeLink =
  | 'two-way' // deposit in HOME and withdraw back later
  | 'one-way' // goes into HOME but can never return to that game
  | 'bank' // 3DS games: Pokémon Bank → HOME, one-way
  | 'transporter' // Gen 5 / Virtual Console: Poké Transporter → Bank → HOME, one-way
  | 'none'; // no path to HOME

export interface GameVersion {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  name: string;
  short: string;
  platform: string;
  year: number;
  kind: 'game' | 'dlc' | 'app';
  /** Base game id for DLC. */
  parent?: string;
  versions?: GameVersion[];
  /** Still sold and playable on current hardware. */
  current: boolean;
  home: {
    link: HomeLink;
    /** Short how-to shown in the Pokémon detail view. */
    how: string;
    /** Extra caveat (e.g. compatibility group, required dex registration). */
    note?: string;
  };
}

export type Method = 'catch' | 'evolve' | 'gift' | 'raid' | 'event' | 'trade' | 'dex';

export interface Availability {
  game: string;
  /** Present when only some versions of the game have it (version exclusive). */
  versions?: string[];
  method?: Method;
  note?: string;
}

export interface Pokemon {
  id: number;
  slug: string;
  name: string;
  gen: number;
  legendary?: boolean;
  mythical?: boolean;
  avail: Availability[];
  /** Set by the app when `name` is localized (e.g. Japanese), so search still matches the English name. */
  englishName?: string;
}

/** Translated data text for one language (data/i18n/<locale>.json). */
export interface DataTranslation {
  games?: Record<
    string,
    { name?: string; short?: string; how?: string; note?: string; /** version id → name */ versions?: Record<string, string> }
  >;
  /** English note → translated note. */
  notes?: Record<string, string>;
  /** Species id → localized Pokémon name (only for languages whose names differ, e.g. Japanese). */
  pokemon?: Record<string, string>;
}

export interface PokedexData {
  generatedAt: string;
  sources: string[];
  games: Game[];
  pokemon: Pokemon[];
  translations?: Record<string, DataTranslation>;
}
