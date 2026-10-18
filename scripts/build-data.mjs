#!/usr/bin/env node
// Builds web/public/data/pokedex.json from PokeAPI (cached in .cache/) plus the curated files in data/.
// Usage: node scripts/build-data.mjs [--refresh]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPokedex, nowhereCurrent } from './lib/build-pokedex.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = path.join(root, '.cache', 'species.json');
const outFile = path.join(root, 'web', 'public', 'data', 'pokedex.json');
const curatedPath = path.join(root, 'data', 'curated-availability.json');
const GRAPHQL = 'https://graphql.pokeapi.co/v1beta2';
const ENGLISH = 9;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function loadSpecies(refresh) {
  if (!refresh && existsSync(cacheFile)) return readJson(cacheFile);
  console.log('Fetching species from PokeAPI GraphQL…');
  const query = `{
    pokemonspecies(order_by: {id: asc}) {
      id name generation_id is_legendary is_mythical evolves_from_species_id
      pokemonspeciesnames(where: {language_id: {_eq: ${ENGLISH}}}) { name }
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

const species = await loadSpecies(process.argv.includes('--refresh'));
const hasCurated = existsSync(curatedPath);
const pokedex = buildPokedex({
  raw: species.data.pokemonspecies,
  games: readJson(path.join(root, 'data', 'games.json')).games,
  special: readJson(path.join(root, 'data', 'special.json')),
  curated: hasCurated ? readJson(curatedPath) : undefined,
});

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(pokedex));

const missing = nowhereCurrent(pokedex);
console.log(`Wrote ${path.relative(root, outFile)}: ${pokedex.pokemon.length} species, ${pokedex.games.length} games.`);
console.log(`Not obtainable in any current game/app (${missing.length}): ${missing.map((p) => p.name).join(', ') || 'none'}`);
if (!hasCurated) console.warn(`Note: ${path.relative(root, curatedPath)} not found; curated exclusives skipped.`);
