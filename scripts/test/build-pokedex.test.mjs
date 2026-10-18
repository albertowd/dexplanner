import { describe, expect, it } from 'vitest';
import { buildPokedex, createAvailability, normalizeSpecies, nowhereCurrent, translationReport } from '../lib/build-pokedex.mjs';

/** A PokeAPI GraphQL species row. */
function sp(id, slug, { dexes = [], enc = [], from = null, mythical = false, name } = {}) {
  return {
    id,
    name: slug,
    generation_id: 1,
    is_legendary: false,
    is_mythical: mythical,
    evolves_from_species_id: from,
    pokemonspeciesnames: name === null ? [] : [{ name: name ?? slug[0].toUpperCase() + slug.slice(1) }],
    pokemondexnumbers: ['national', ...dexes].map((d) => ({ pokedex: { name: d } })),
    pokemons: [{ encounters: enc.map((v) => ({ version: { name: v } })) }],
  };
}

const twoVersions = (a, b) => [{ id: a, name: a }, { id: b, name: b }];
const home = { link: 'two-way', how: 'deposit' };

const raw = [
  sp(1, 'larvitar', { enc: ['shield', 'y'] }),
  sp(2, 'pupitar', { from: 1 }),
  sp(3, 'tyranitar', { from: 2, enc: ['shield'] }),
  sp(4, 'cosmog', { enc: ['ct-sword', 'ct-shield'] }),
  sp(5, 'cosmoem', { from: 4 }),
  sp(6, 'pikachu', { dexes: ['galar', 'paldea'], enc: ['sword', 'shield'] }),
  sp(7, 'mew', { dexes: ['kalos'], enc: ['y'], mythical: true }),
  sp(8, 'koraidon', { dexes: ['paldea'] }),
  sp(9, 'fossil', { dexes: ['galar'] }),
  sp(10, 'kleavor', { from: 3 }),
  sp(11, 'nameless', { name: null }),
];

const games = [
  {
    id: 'sv', name: 'SV', current: true, versions: twoVersions('scarlet', 'violet'), home,
    source: { dexes: ['paldea'], curated: 'scarlet-violet' },
  },
  {
    id: 'swsh', name: 'SwSh', current: true, versions: twoVersions('sword', 'shield'), home,
    source: { dexes: ['galar'], encounters: { sword: ['sword', 'ct-sword'], shield: ['shield', 'ct-shield'] } },
  },
  {
    id: 'lgpe', name: "Let's Go", current: true, home,
    source: { dexes: ['galar'], closedDex: true, encounters: { only: ['sword'] } },
  },
  {
    id: 'xy', name: 'XY', current: false, versions: twoVersions('x', 'y'), home,
    source: { dexes: ['kalos'], encounters: { x: ['x'], y: ['y'] } },
  },
  { id: 'empty', name: 'Empty', current: true, home, source: { encounters: { only: ['nowhere'] } } },
  { id: 'go', name: 'GO', current: true, home, source: { go: true } },
  { id: 'home', name: 'HOME', current: true, home },
];

const special = {
  go: { sources: ['go-source'], notReleased: ['koraidon'], pastOnly: ['mew'], notes: { mew: 'Research' } },
  entries: [
    { game: 'home', species: ['cosmog'], method: 'gift', note: 'HOME reward' },
    { game: 'sv', species: ['koraidon'], method: 'event', note: 'Corrected' },
  ],
};

const curated = {
  sources: ['curated-source'],
  exclusives: { 'scarlet-violet': { scarlet: ['koraidon', 1], violet: [] } },
  extra: {
    'scarlet-violet': [
      { ids: [1], note: 'Raid', method: 'raid' },
      { ids: ['larvitar'], versions: ['violet'], note: 'Violet extra' },
    ],
  },
};

const build = (overrides = {}) =>
  buildPokedex({ raw, games, special, curated, now: new Date('2026-10-18T00:00:00Z'), ...overrides });
const availOf = (pokedex, slug, game) => pokedex.pokemon.find((p) => p.slug === slug).avail.find((a) => a.game === game);

describe('normalizeSpecies', () => {
  it('maps PokeAPI rows and falls back to the slug without an English name', () => {
    const [larvitar] = normalizeSpecies(raw);
    expect(larvitar).toMatchObject({ id: 1, slug: 'larvitar', name: 'Larvitar', gen: 1, evolvesFrom: null });
    expect([...larvitar.encounters]).toEqual(['shield', 'y']);
    expect(normalizeSpecies(raw).at(-1).name).toBe('nameless');
  });

  it('handles species without a default form', () => {
    const [s] = normalizeSpecies([{ ...sp(1, 'x'), pokemons: [] }]);
    expect(s.encounters.size).toBe(0);
  });
});

describe('buildPokedex', () => {
  it('writes metadata, sources and strips the build-only source config from games', () => {
    const pokedex = build();
    expect(pokedex.generatedAt).toBe('2026-10-18T00:00:00.000Z');
    expect(pokedex.sources).toEqual(expect.arrayContaining(['go-source', 'curated-source']));
    expect(pokedex.games.every((g) => !('source' in g))).toBe(true);
  });

  it('uses encounter data for catch method and version exclusives', () => {
    const pokedex = build();
    expect(availOf(pokedex, 'pikachu', 'swsh')).toEqual({ game: 'swsh', method: 'catch' });
    expect(availOf(pokedex, 'tyranitar', 'swsh')).toEqual({ game: 'swsh', method: 'catch', versions: ['shield'] });
  });

  it('inherits availability and exclusivity through evolution', () => {
    const pokedex = build();
    expect(availOf(pokedex, 'pupitar', 'swsh')).toEqual({ game: 'swsh', method: 'evolve', versions: ['shield'] });
    expect(availOf(pokedex, 'cosmoem', 'swsh')).toEqual({ game: 'swsh', method: 'evolve' });
  });

  it('does not add evolutions newer than anything in the game', () => {
    expect(availOf(build(), 'kleavor', 'swsh')).toBeUndefined();
  });

  it('does not expand closed dexes', () => {
    expect(availOf(build(), 'pupitar', 'lgpe')).toBeUndefined();
    expect(availOf(build(), 'pikachu', 'lgpe')).toEqual({ game: 'lgpe', method: 'catch' });
  });

  it('marks dex-only species without encounters', () => {
    expect(availOf(build(), 'fossil', 'swsh')).toEqual({ game: 'swsh', method: 'dex' });
  });

  it('treats Mythicals in retro games as past events', () => {
    expect(availOf(build(), 'mew', 'xy')).toEqual({ game: 'xy', method: 'event', versions: ['y'] });
  });

  it('applies curated exclusives through evolution lines in games without encounter data', () => {
    const pokedex = build();
    expect(availOf(pokedex, 'pikachu', 'sv')).toEqual({ game: 'sv' });
    expect(availOf(pokedex, 'tyranitar', 'sv')).toBeUndefined();
  });

  it('merges curated extras into one entry and collapses versions covering the whole game', () => {
    const larvitar = availOf(build(), 'larvitar', 'sv');
    // scarlet exclusive (dex-less game: extra adds it) + violet extra = every version
    expect(larvitar).toEqual({ game: 'sv', method: 'raid', note: 'Raid · Violet extra' });
  });

  it('applies corrections without touching version info', () => {
    expect(availOf(build(), 'koraidon', 'sv')).toEqual({
      game: 'sv', versions: ['scarlet'], method: 'event', note: 'Corrected',
    });
    expect(availOf(build(), 'cosmog', 'home')).toEqual({ game: 'home', method: 'gift', note: 'HOME reward' });
  });

  it('lists everything in GO except the not-released list, with past-only events', () => {
    const pokedex = build();
    expect(availOf(pokedex, 'koraidon', 'go')).toBeUndefined();
    expect(availOf(pokedex, 'mew', 'go')).toEqual({ game: 'go', method: 'event', note: 'Research' });
    expect(availOf(pokedex, 'pikachu', 'go')).toEqual({ game: 'go' });
  });

  it('orders sources by the game catalogue', () => {
    const order = build().pokemon.find((p) => p.slug === 'pikachu').avail.map((a) => a.game);
    expect(order).toEqual(['sv', 'swsh', 'lgpe', 'go']);
  });

  it('works without curated data', () => {
    const pokedex = build({ curated: undefined });
    expect(availOf(pokedex, 'koraidon', 'sv')).toEqual({ game: 'sv', method: 'event', note: 'Corrected' });
  });

  it('fails loudly on unknown curated species', () => {
    expect(() => build({ special: { ...special, entries: [{ game: 'sv', species: ['missingno'] }] } })).toThrow(
      'Unknown species slug in curated data: "missingno"',
    );
  });
});

describe('createAvailability', () => {
  const species = normalizeSpecies([sp(1, 'a')]);

  it('replaces a dex-only method with a concrete one when merging', () => {
    const avail = createAvailability(species);
    avail.add(1, { game: 'g', method: 'dex', versions: ['x'] });
    avail.add(1, { game: 'g', method: 'catch', versions: ['y'], note: 'n' });
    expect(avail.get(1)).toEqual([{ game: 'g', method: 'catch', versions: ['x', 'y'], note: 'n' }]);
  });

  it('keeps the first concrete method and does not repeat an identical note', () => {
    const avail = createAvailability(species);
    avail.add(1, { game: 'g', method: 'catch', note: 'n' });
    avail.add(1, { game: 'g', method: 'gift', note: 'n' });
    expect(avail.get(1)).toEqual([{ game: 'g', method: 'catch', note: 'n' }]);
  });
});

describe('nowhereCurrent', () => {
  it('lists species with no source in a current game or app', () => {
    const pokedex = build({ special: { ...special, go: { ...special.go, notReleased: ['koraidon', 'kleavor', 'nameless'] } } });
    expect(nowhereCurrent(pokedex).map((p) => p.slug)).toEqual(['kleavor', 'nameless']);
  });
});

describe('translations', () => {
  const ptBR = {
    $comment: 'notes for translators',
    games: Object.fromEntries(games.map((g) => [g.id, { how: 'como' }])),
    notes: { 'HOME reward': 'Recompensa do HOME', Research: 'Pesquisa', Corrected: 'Corrigido', Stale: 'Antigo' },
  };

  it('bundles translations without the translator comment', () => {
    const pokedex = build({ translations: { 'pt-BR': ptBR } });
    expect(Object.keys(pokedex.translations)).toEqual(['pt-BR']);
    expect(pokedex.translations['pt-BR'].$comment).toBeUndefined();
    expect(pokedex.translations['pt-BR'].notes.Research).toBe('Pesquisa');
    expect(build().translations).toEqual({});
  });

  it('reports missing game texts, untranslated notes and unused translations', () => {
    const partial = { ...ptBR, games: { ...ptBR.games, swsh: undefined } };
    const pokedex = build({ translations: { 'pt-BR': partial } });
    const report = translationReport(pokedex)['pt-BR'];
    expect(report.games).toEqual(['swsh']);
    expect(report.notes.sort()).toEqual(['Raid', 'Violet extra']);
    expect(report.unused).toEqual(['Stale']);
  });

  it('flags games whose caveat has no translation', () => {
    const withNote = games.map((g) => (g.id === 'sv' ? { ...g, home: { ...g.home, note: 'Careful' } } : g));
    const report = translationReport(build({ games: withNote, translations: { 'pt-BR': ptBR } }))['pt-BR'];
    expect(report.games).toEqual(['sv']);
    expect(translationReport({ ...build(), translations: undefined })).toEqual({});
  });
});
