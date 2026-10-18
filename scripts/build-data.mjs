#!/usr/bin/env node
// Builds web/public/data/pokedex.json from PokeAPI (cached in .cache/) plus the curated files in data/.
// Usage: node scripts/build-data.mjs [--refresh]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPokedex, nowhereCurrent, translationReport } from './lib/build-pokedex.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = path.join(root, '.cache', 'species.json');
const formsCacheFile = path.join(root, '.cache', 'forms.json');
const shinyPath = path.join(root, 'data', 'shiny.json');
const outFile = path.join(root, 'web', 'public', 'data', 'pokedex.json');
const curatedPath = path.join(root, 'data', 'curated-availability.json');
const i18nDir = path.join(root, 'data', 'i18n');
const GRAPHQL = 'https://graphql.pokeapi.co/v1beta2';
// PokeAPI language ids: English, plus languages whose Pokémon names differ from English.
const ENGLISH = 9;
const POKEMON_NAME_LANGUAGES = { ja: 1 }; // ja-Hrkt (kana)
// Form names ("Alolan Form") are translated by PokeAPI in these languages; pt-BR falls back to English.
const FORM_NAME_LANGUAGES = { ja: 1, es: 7, it: 8 };

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function loadSpecies(refresh) {
  if (!refresh && existsSync(cacheFile)) return readJson(cacheFile);
  console.log('Fetching species from PokeAPI GraphQL…');
  const query = `{
    pokemonspecies(order_by: {id: asc}) {
      id name generation_id is_legendary is_mythical evolves_from_species_id
      pokemonspeciesnames(where: {language_id: {_in: [${[ENGLISH, ...Object.values(POKEMON_NAME_LANGUAGES)].join(', ')}]}}) { name language_id }
      pokemondexnumbers { pokedex { name } }
      pokemons(where: {is_default: {_eq: true}}) { encounters(distinct_on: version_id) { version { name } } }
    }
  }`;
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`PokeAPI responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(json));
  return json;
}

async function graphql(query) {
  const res = await fetch(GRAPHQL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`PokeAPI responded ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

/** Every form of every species, with names and the two sprite paths the app uses. */
async function loadForms(refresh) {
  if (!refresh && existsSync(formsCacheFile)) return readJson(formsCacheFile);
  console.log('Fetching forms from PokeAPI GraphQL…');
  const languages = [ENGLISH, ...Object.values(FORM_NAME_LANGUAGES)].join(', ');
  const json = await graphql(`{
    pokemonspecies(order_by: {id: asc}) {
      id has_gender_differences
      pokemons(order_by: {id: asc}) {
        id is_default
        pokemonforms(order_by: {form_order: asc}) {
          name form_name is_default is_battle_only is_mega
          pokemonformnames(where: {language_id: {_in: [${languages}]}}) { name language_id }
          pokemonformsprites { front: sprites(path: "front_default") }
        }
      }
    }
  }`);
  mkdirSync(path.dirname(formsCacheFile), { recursive: true });
  writeFileSync(formsCacheFile, JSON.stringify(json));
  return json;
}

const refresh = process.argv.includes('--refresh');
const species = await loadSpecies(refresh);
const forms = await loadForms(refresh);
const hasCurated = existsSync(curatedPath);
const pokedex = buildPokedex({
  raw: species.data.pokemonspecies,
  games: readJson(path.join(root, 'data', 'games.json')).games,
  special: readJson(path.join(root, 'data', 'special.json')),
  curated: hasCurated ? readJson(curatedPath) : undefined,
  pokemonNameLanguages: POKEMON_NAME_LANGUAGES,
  forms: forms.data.pokemonspecies,
  formNameLanguages: FORM_NAME_LANGUAGES,
  shiny: existsSync(shinyPath) ? readJson(shinyPath) : {},
  translations: Object.fromEntries(
    (existsSync(i18nDir) ? readdirSync(i18nDir) : [])
      .filter((f) => f.endsWith('.json'))
      .map((f) => [path.basename(f, '.json'), readJson(path.join(i18nDir, f))]),
  ),
});

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(pokedex));

const missing = nowhereCurrent(pokedex);
console.log(`Wrote ${path.relative(root, outFile)}: ${pokedex.pokemon.length} species, ${pokedex.games.length} games.`);
console.log(`Not obtainable in any current game/app (${missing.length}): ${missing.map((p) => p.name).join(', ') || 'none'}`);
const list = (items) => items.map((item) => `\n  - ${item}`).join('');
for (const [locale, report] of Object.entries(translationReport(pokedex))) {
  const problems = [
    report.games.length && `games without a translation:${list(report.games)}`,
    report.notes.length && `untranslated notes:${list(report.notes)}`,
    report.unused.length && `unused translated notes:${list(report.unused)}`,
  ].filter(Boolean);
  console.log(problems.length ? `Translations ${locale}: ${problems.join('\n')}` : `Translations ${locale}: complete.`);
}
if (!hasCurated) console.warn(`Note: ${path.relative(root, curatedPath)} not found; curated exclusives skipped.`);
