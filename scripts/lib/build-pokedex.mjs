// Pure transformation from PokeAPI species + curated data/ files to the app's pokedex.json shape.
// No I/O here so it can be unit tested; scripts/build-data.mjs does the reading and writing.
import { shinyStatus, speciesForms } from './forms.mjs';

const ENGLISH = 9;

/** Maps PokeAPI GraphQL species rows to the internal shape. */
export function normalizeSpecies(raw) {
  return raw.map((s) => ({
    id: s.id,
    slug: s.name,
    // Rows without language_id come from older snapshots that only fetched English.
    name: s.pokemonspeciesnames.find((n) => (n.language_id ?? ENGLISH) === ENGLISH)?.name ?? s.name,
    names: Object.fromEntries(s.pokemonspeciesnames.filter((n) => n.language_id).map((n) => [n.language_id, n.name])),
    gen: s.generation_id,
    legendary: s.is_legendary,
    mythical: s.is_mythical,
    evolvesFrom: s.evolves_from_species_id,
    dexes: new Set(s.pokemondexnumbers.map((d) => d.pokedex.name)),
    encounters: new Set((s.pokemons[0]?.encounters ?? []).map((e) => e.version.name)),
  }));
}

function createIndex(species) {
  const byId = new Map(species.map((s) => [s.id, s]));
  const bySlug = new Map(species.map((s) => [s.slug, s]));
  return {
    byId,
    idOf(ref) {
      if (typeof ref === 'number') return ref;
      const s = bySlug.get(ref);
      if (!s) throw new Error(`Unknown species slug in curated data: "${ref}"`);
      return s.id;
    },
    /** Pre-evolutions, nearest first. */
    ancestors(s) {
      const out = [];
      for (let cur = byId.get(s.evolvesFrom); cur; cur = byId.get(cur.evolvesFrom)) out.push(cur);
      return out;
    },
  };
}

/** Merges a second source for the same game into an existing entry. */
function mergeInto(existing, entry) {
  // Keep the broader version set: a source without versions means "every version".
  if (entry.versions && existing.versions) {
    existing.versions = [...new Set([...existing.versions, ...entry.versions])];
  } else {
    delete existing.versions;
  }
  if (entry.note && existing.note !== entry.note) {
    existing.note = existing.note ? `${existing.note} · ${entry.note}` : entry.note;
  }
  if (entry.method && (!existing.method || existing.method === 'dex')) existing.method = entry.method;
}

/** Curated correction of an existing source: replace how it is obtained, keep version info. */
function override(existing, entry) {
  for (const [key, value] of Object.entries(entry)) {
    if (key !== 'versions' && value) existing[key] = value;
  }
}

/** Per-species list of sources, with the merge rules for a game listed by several sources. */
export function createAvailability(species) {
  const avail = new Map(species.map((s) => [s.id, []]));
  return {
    get: (id) => avail.get(id),
    values: () => avail.values(),
    add(id, entry, { override: isOverride = false } = {}) {
      const list = avail.get(id);
      const existing = list.find((a) => a.game === entry.game);
      if (!existing) list.push(entry);
      else if (isOverride) override(existing, entry);
      else mergeInto(existing, entry);
    },
  };
}

/** Version ids of `game` in which `s` has its own encounter (empty without encounter data). */
function encounterVersions(src, s) {
  if (!src.encounters) return [];
  return Object.entries(src.encounters)
    .filter(([, pokeVersions]) => pokeVersions.some((v) => s.encounters.has(v)))
    .map(([versionId]) => versionId);
}

function curatedExclusives(src, curated, index) {
  const exclusiveOf = new Map();
  for (const [versionId, refs] of Object.entries(curated.exclusives?.[src.curated] ?? {})) {
    for (const ref of refs) {
      const id = index.idOf(ref);
      exclusiveOf.set(id, [...(exclusiveOf.get(id) ?? []), versionId]);
    }
  }
  return exclusiveOf;
}

/**
 * Species that exist in the game: its regional dexes, its encounters and, for games with encounter
 * data, evolutions of those. Evolutions newer than anything in the game (e.g. Hisuian ones for
 * Sword/Shield) don't exist there, and `closedDex` games (Let's Go) list everything in their dex.
 */
function gameCandidates(src, species) {
  const candidates = new Set(species.filter((s) => (src.dexes ?? []).some((d) => s.dexes.has(d))).map((s) => s.id));
  if (!src.encounters) return candidates;

  for (const s of species) if (encounterVersions(src, s).length) candidates.add(s.id);
  if (src.closedDex || candidates.size === 0) return candidates;

  const newestInGame = Math.max(...candidates);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of species) {
      if (!candidates.has(s.id) && s.id <= newestInGame && candidates.has(s.evolvesFrom)) {
        candidates.add(s.id);
        grew = true;
      }
    }
  }
  return candidates;
}

function encounterEntry(src, s, index, narrow) {
  const own = encounterVersions(src, s);
  if (own.length) return { method: 'catch', versions: narrow(own) };
  const caughtAncestor = index.ancestors(s).find((a) => encounterVersions(src, a).length);
  if (caughtAncestor) return { method: 'evolve', versions: narrow(encounterVersions(src, caughtAncestor)) };
  return { method: s.mythical ? 'event' : 'dex' };
}

function addGame(game, ctx) {
  const { species, index, curated, avail } = ctx;
  const src = game.source ?? {};
  if (src.go) return; // Pokémon GO is handled separately

  const versionTotal = game.versions?.length ?? 0;
  const narrow = (versions) => (versions?.length && versions.length < versionTotal ? versions : undefined);
  const exclusiveOf = curatedExclusives(src, curated, index);

  for (const id of gameCandidates(src, species)) {
    const s = index.byId.get(id);
    const entry = { game: game.id };
    if (src.encounters) {
      Object.assign(entry, encounterEntry(src, s, index, narrow));
    } else {
      const fromLine = [s, ...index.ancestors(s)].find((a) => exclusiveOf.has(a.id));
      if (fromLine) entry.versions = narrow(exclusiveOf.get(fromLine.id));
    }
    // PokeAPI lists event-ticket encounters (e.g. Faraway Island Mew) as normal ones;
    // in retro games every Mythical needed an event that is long gone.
    if (s.mythical && !game.current) entry.method = 'event';
    avail.add(id, entry);
  }

  for (const extra of curated.extra?.[src.curated] ?? []) {
    for (const ref of extra.ids ?? extra.species ?? []) {
      avail.add(index.idOf(ref), { game: game.id, versions: narrow(extra.versions), method: extra.method, note: extra.note });
    }
  }
}

function addGo(special, species, index, avail) {
  const notReleased = new Set(special.go.notReleased.map((slug) => index.idOf(slug)));
  const pastOnly = new Set(special.go.pastOnly.map((slug) => index.idOf(slug)));
  for (const s of species) {
    if (notReleased.has(s.id)) continue;
    avail.add(s.id, { game: 'go', method: pastOnly.has(s.id) ? 'event' : undefined, note: special.go.notes[s.slug] });
  }
}

/** Curated translations (without translator comments) plus localized Pokémon names from PokeAPI. */
function bundleTranslations(translations, species, pokemonNameLanguages, formsById, formNameLanguages) {
  const out = Object.fromEntries(Object.entries(translations).map(([locale, { $comment: _comment, ...t }]) => [locale, t]));
  for (const [locale, languageId] of Object.entries(pokemonNameLanguages)) {
    const names = Object.fromEntries(species.filter((s) => s.names[languageId]).map((s) => [s.id, s.names[languageId]]));
    if (Object.keys(names).length) out[locale] = { ...out[locale], pokemon: names };
  }
  for (const [locale, languageId] of Object.entries(formNameLanguages)) {
    const names = {};
    for (const { defaultForm, forms } of formsById.values()) {
      for (const form of [defaultForm, ...forms]) if (form?.names[languageId]) names[form.key] = form.names[languageId];
    }
    if (Object.keys(names).length) out[locale] = { ...out[locale], forms: names };
  }
  return out;
}

/** Living dex forms and shiny status for one species, in the pokedex.json shape. */
function formFields(s, formsById, shiny) {
  const { defaultForm, forms = [] } = formsById.get(s.id) ?? {};
  const status = shinyStatus(shiny, s.slug);
  return {
    defaultForm: defaultForm && { key: defaultForm.key, name: defaultForm.name },
    forms: forms.length
      ? forms.map((f) => {
          const formShiny = shiny.forms?.[f.key];
          return clean({ key: f.key, name: f.name, kind: f.kind, sprite: f.sprite, shiny: formShiny?.status, shinyNote: formShiny?.note });
        })
      : undefined,
    shiny: status?.status,
    shinyNote: status?.note,
  };
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== false));

/**
 * @param {object} input
 * @param {object[]} input.raw PokeAPI species rows
 * @param {object[]} input.games data/games.json `games`
 * @param {object} input.special data/special.json
 * @param {object} [input.curated] data/curated-availability.json
 * @param {Record<string, object>} [input.translations] data/i18n/<locale>.json by locale
 * @param {Date} [input.now]
 */
export function buildPokedex({
  raw,
  games,
  special,
  curated = { exclusives: {}, extra: {} },
  translations = {},
  pokemonNameLanguages = {},
  forms = [],
  formNameLanguages = {},
  shiny = {},
  now = new Date(),
}) {
  const species = normalizeSpecies(raw);
  const slugById = new Map(species.map((s) => [s.id, s.slug]));
  const formsById = new Map(forms.filter((row) => slugById.has(row.id)).map((row) => [row.id, speciesForms(row, slugById.get(row.id))]));
  const index = createIndex(species);
  const avail = createAvailability(species);
  const ctx = { species, index, curated, avail };

  for (const game of games) addGame(game, ctx);
  addGo(special, species, index, avail);
  for (const entry of special.entries) {
    for (const slug of entry.species) {
      avail.add(index.idOf(slug), { game: entry.game, method: entry.method, note: entry.note }, { override: true });
    }
  }

  // A version list that grew to cover every version after merging is not an exclusive.
  const versionCount = new Map(games.map((g) => [g.id, g.versions?.length ?? 0]));
  for (const list of avail.values()) {
    for (const a of list) if (a.versions && a.versions.length >= versionCount.get(a.game)) delete a.versions;
  }

  const gameOrder = new Map(games.map((g, i) => [g.id, i]));
  return {
    generatedAt: now.toISOString(),
    sources: [
      'https://pokeapi.co (species, regional Pokédexes, encounters)',
      'https://home.pokemon.com/en-us/move/ (HOME compatibility)',
      ...special.go.sources,
      ...(curated.sources ?? []),
    ],
    games: games.map(({ source: _source, ...g }) => g),
    translations: bundleTranslations(translations, species, pokemonNameLanguages, formsById, formNameLanguages),
    pokemon: species.map((s) =>
      clean({
        id: s.id,
        slug: s.slug,
        name: s.name,
        gen: s.gen,
        legendary: s.legendary,
        mythical: s.mythical,
        avail: avail
          .get(s.id)
          .map(clean)
          .sort((a, b) => gameOrder.get(a.game) - gameOrder.get(b.game)),
        ...formFields(s, formsById, shiny),
      }),
    ),
  };
}

/** Species with no source in any current game or app (printed as a sanity check). */
export function nowhereCurrent(pokedex) {
  const currentIds = new Set(pokedex.games.filter((g) => g.current).map((g) => g.id));
  return pokedex.pokemon.filter((p) => !p.avail.some((a) => currentIds.has(a.game)));
}

/**
 * Per locale: games without a translated HOME text, notes without a translation, and translated notes
 * that no longer appear in the data (printed by the build so nothing goes out half translated).
 */
/** A game needs its HOME text (and caveat) translated; version names are optional but, if given, complete. */
function gameTranslated(game, t) {
  if (!t?.how || (game.home.note && !t.note)) return false;
  return !t.versions || (game.versions ?? []).every((v) => t.versions[v.id]);
}

export function translationReport(pokedex) {
  const notes = new Set(
    pokedex.pokemon.flatMap((p) => [
      ...p.avail.flatMap((a) => (a.note ? a.note.split(' · ') : [])),
      ...[p.shinyNote, ...(p.forms ?? []).map((f) => f.shinyNote)].filter(Boolean),
    ]),
  );
  return Object.fromEntries(
    Object.entries(pokedex.translations ?? {}).map(([locale, t]) => [
      locale,
      {
        games: pokedex.games.filter((g) => !gameTranslated(g, t.games?.[g.id])).map((g) => g.id),
        notes: [...notes].filter((n) => !t.notes?.[n]),
        unused: Object.keys(t.notes ?? {}).filter((n) => !notes.has(n)),
      },
    ]),
  );
}
