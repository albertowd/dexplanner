import type { Game, PokedexData, Pokemon } from '../src/types.ts';

const how = (link: Game['home']['link']) => ({ link, how: `How for ${link}` });

export const games: Game[] = [
  {
    id: 'sv', name: 'Pokémon Scarlet / Violet', short: 'SV', platform: 'Switch', year: 2022, kind: 'game', current: true,
    versions: [{ id: 'scarlet', name: 'Scarlet' }, { id: 'violet', name: 'Violet' }],
    home: how('two-way'),
  },
  { id: 'sv-id', name: 'The Indigo Disk', short: 'SV: ID', platform: 'Switch', year: 2023, kind: 'dlc', parent: 'sv', current: true, home: how('two-way') },
  { id: 'za', name: 'Pokémon Legends: Z-A', short: 'Z-A', platform: 'Switch', year: 2025, kind: 'game', current: true, home: { ...how('two-way'), note: 'Z-A lock' } },
  { id: 'lgpe', name: "Let's Go", short: 'LGPE', platform: 'Switch', year: 2018, kind: 'game', current: true, home: how('one-way') },
  { id: 'go', name: 'Pokémon GO', short: 'GO', platform: 'Mobile', year: 2016, kind: 'app', current: true, home: how('one-way') },
  { id: 'home', name: 'Pokémon HOME rewards', short: 'HOME', platform: 'Mobile', year: 2020, kind: 'app', current: true, home: how('two-way') },
  { id: 'usum', name: 'Ultra Sun / Ultra Moon', short: 'USUM', platform: '3DS', year: 2017, kind: 'game', current: false, home: how('bank') },
];

export const pokemon: Pokemon[] = [
  { id: 1, slug: 'bulbasaur', name: 'Bulbasaur', gen: 1, avail: [{ game: 'lgpe', method: 'catch' }, { game: 'go' }] },
  {
    id: 25,
    slug: 'pikachu',
    name: 'Pikachu',
    gen: 1,
    avail: [{ game: 'sv' }, { game: 'za' }, { game: 'go' }],
    forms: [
      { key: 'pikachu-alola-cap', name: 'Alola Cap', kind: 'form', sprite: '10099', shiny: 'locked', shinyNote: 'Caps are never shiny' },
      { key: 'pikachu-female', kind: 'gender', sprite: 'female/25' },
    ],
  },
  { id: 151, slug: 'mew', name: 'Mew', gen: 1, mythical: true, avail: [{ game: 'usum', method: 'event' }, { game: 'go', note: 'Research' }] },
  { id: 248, slug: 'tyranitar', name: 'Tyranitar', gen: 2, avail: [{ game: 'sv', versions: ['scarlet'] }, { game: 'usum', method: 'evolve' }] },
  {
    id: 801,
    slug: 'magearna',
    name: 'Magearna',
    gen: 7,
    mythical: true,
    shiny: 'event',
    avail: [{ game: 'home', method: 'gift', note: 'National dex reward' }],
    forms: [{ key: 'magearna-original', name: 'Original Color', kind: 'form', sprite: '10147', shiny: 'available' }],
  },
  { id: 1007, slug: 'koraidon', name: 'Koraidon', gen: 9, legendary: true, shiny: 'locked', shinyNote: 'Shiny-locked in SV', avail: [{ game: 'sv', versions: ['scarlet'] }] },
  { id: 1009, slug: 'walking-wake', name: 'Walking Wake', gen: 9, avail: [{ game: 'sv-id', method: 'event' }] },
  { id: 1010, slug: 'iron-leaves', name: 'Iron Leaves', gen: 9, avail: [] },
];

export const data: PokedexData = {
  generatedAt: '2026-10-18T00:00:00.000Z',
  sources: ['https://pokeapi.co'],
  games,
  pokemon,
};

export const gameMap = new Map(games.map((g) => [g.id, g]));
export const byName = (name: string) => pokemon.find((p) => p.slug === name)!;
