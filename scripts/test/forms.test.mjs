import { describe, expect, it } from 'vitest';
import { shinyStatus, speciesForms } from '../lib/forms.mjs';
import { buildPokedex } from '../lib/build-pokedex.mjs';

/** A PokeAPI form row. */
const form = (name, { form_name = '', is_default = true, is_battle_only = false, is_mega = false, en, ja, sprite } = {}) => ({
  name,
  form_name,
  is_default,
  is_battle_only,
  is_mega,
  pokemonformnames: [en && { name: en, language_id: 9 }, ja && { name: ja, language_id: 1 }].filter(Boolean),
  pokemonformsprites: [{ front: sprite && `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sprite}.png` }],
});
const pokemon = (id, is_default, forms) => ({ id, is_default, pokemonforms: forms });

describe('speciesForms', () => {
  it('turns non-default forms into living dex entries with kind, name and sprite', () => {
    const vulpix = {
      id: 37,
      has_gender_differences: false,
      pokemons: [pokemon(37, true, [form('vulpix')]), pokemon(10103, false, [form('vulpix-alola', { form_name: 'alola', en: 'Alolan Form', ja: 'アローラのすがた', sprite: '10103' })])],
    };
    const { defaultForm, forms } = speciesForms(vulpix, 'vulpix');
    expect(defaultForm).toBeUndefined();
    expect(forms).toEqual([{ key: 'vulpix-alola', name: 'Alolan Form', names: { 9: 'Alolan Form', 1: 'アローラのすがた' }, kind: 'regional', sprite: '10103' }]);
  });

  it('names the default form when it has a name, and keeps cosmetic forms', () => {
    const unown = {
      id: 201,
      has_gender_differences: false,
      pokemons: [pokemon(201, true, [form('unown-a', { form_name: 'a', en: 'A' }), form('unown-b', { form_name: 'b', is_default: false, en: 'B', sprite: '201-b' })])],
    };
    const { defaultForm, forms } = speciesForms(unown, 'unown');
    expect(defaultForm).toEqual({ key: 'unown-a', name: 'A', names: { 9: 'A' } });
    expect(forms.map((f) => [f.key, f.kind, f.sprite])).toEqual([['unown-b', 'form', '201-b']]);
  });

  it('keeps Mega, Gigantamax and Primal forms but skips other battle states', () => {
    const forms = speciesForms(
      {
        id: 6,
        has_gender_differences: false,
        pokemons: [
          pokemon(6, true, [form('charizard')]),
          pokemon(10034, false, [form('charizard-mega-x', { form_name: 'mega-x', is_battle_only: true, is_mega: true, en: 'Mega Charizard X' })]),
          pokemon(10196, false, [form('charizard-gmax', { form_name: 'gmax', is_battle_only: true, en: 'Gigantamax Form' })]),
          pokemon(10077, false, [form('kyogre-primal', { form_name: 'primal', is_battle_only: true, en: 'Primal Kyogre' })]),
          pokemon(10017, false, [form('darmanitan-zen', { form_name: 'zen', is_battle_only: true, en: 'Zen Mode' })]),
        ],
      },
      'charizard',
    ).forms;
    expect(forms.map((f) => [f.key, f.kind])).toEqual([
      ['charizard-mega-x', 'battle'],
      ['charizard-gmax', 'battle'],
      ['kyogre-primal', 'battle'],
    ]);
  });

  it('skips forms that can never be in HOME', () => {
    const forms = speciesForms(
      {
        id: 25,
        has_gender_differences: false,
        pokemons: [
          pokemon(25, true, [form('pikachu')]),
          ...['pikachu-cosplay', 'pikachu-starter', 'raticate-totem-alola', 'eternatus-eternamax', 'rockruff-own-tempo', 'zygarde-50-power-construct', 'koraidon-sprinting-build', 'minior-blue-meteor'].map((n, i) => pokemon(20000 + i, false, [form(n)])),
          pokemon(10094, false, [form('pikachu-original-cap', { form_name: 'original-cap', en: 'Original Cap' })]),
          pokemon(1, false, [form('minior-red-meteor')]),
        ],
      },
      'pikachu',
    ).forms;
    expect(forms.map((f) => f.key)).toEqual(['pikachu-original-cap', 'minior-red-meteor']);
  });

  it('adds a female entry for species with visible gender differences, and labels female varieties', () => {
    const { forms } = speciesForms(
      { id: 876, has_gender_differences: true, pokemons: [pokemon(876, true, [form('indeedee-male')]), pokemon(10186, false, [form('indeedee-female', { en: 'Female' })])] },
      'indeedee',
    );
    // Indeedee already has a female form, so no second female entry is added.
    expect(forms.map((f) => [f.key, f.kind, f.sprite])).toEqual([['indeedee-female', 'gender', undefined]]);
    const pikachu = speciesForms({ id: 25, has_gender_differences: true, pokemons: [pokemon(25, true, [form('pikachu')])] }, 'pikachu');
    expect(pikachu.forms).toEqual([{ key: 'pikachu-female', kind: 'gender', sprite: 'female/25', names: {} }]);
  });
});

describe('shinyStatus', () => {
  const shiny = { species: { koraidon: { status: 'locked' } }, forms: { 'pikachu-world-cap': { status: 'event' } } };
  it('returns the form override, then the species status, else nothing', () => {
    expect(shinyStatus(shiny, 'pikachu', 'pikachu-world-cap')).toEqual({ status: 'event' });
    expect(shinyStatus(shiny, 'koraidon')).toEqual({ status: 'locked' });
    expect(shinyStatus(shiny, 'pikachu')).toBeNull();
    expect(shinyStatus({}, 'pikachu')).toBeNull();
  });
});

describe('buildPokedex with forms and shiny data', () => {
  const raw = [{ id: 37, name: 'vulpix', generation_id: 1, is_legendary: false, is_mythical: false, evolves_from_species_id: null, pokemonspeciesnames: [{ name: 'Vulpix', language_id: 9 }], pokemondexnumbers: [], pokemons: [{ encounters: [] }] }];
  const forms = [
    {
      id: 37,
      has_gender_differences: false,
      pokemons: [pokemon(37, true, [form('vulpix')]), pokemon(10103, false, [form('vulpix-alola', { form_name: 'alola', en: 'Alolan Form', ja: 'アローラのすがた', sprite: '10103' })])],
    },
    { id: 9999, has_gender_differences: false, pokemons: [] },
  ];
  const special = { go: { sources: [], notReleased: [], pastOnly: [], notes: {} }, entries: [] };

  it('adds forms, shiny status and localized form names', () => {
    const pokedex = buildPokedex({
      raw,
      games: [],
      special,
      forms,
      formNameLanguages: { ja: 1 },
      shiny: { species: { vulpix: { status: 'event', note: 'Only at a 2020 event' } }, forms: { 'vulpix-alola': { status: 'available' } } },
    });
    expect(pokedex.pokemon[0]).toMatchObject({
      shiny: 'event',
      shinyNote: 'Only at a 2020 event',
      forms: [{ key: 'vulpix-alola', name: 'Alolan Form', kind: 'regional', sprite: '10103', shiny: 'available' }],
    });
    expect(pokedex.translations.ja.forms).toEqual({ 'vulpix-alola': 'アローラのすがた' });
  });

  it('leaves species without forms or shiny data unchanged', () => {
    const p = buildPokedex({ raw, games: [], special }).pokemon[0];
    expect(p.forms).toBeUndefined();
    expect(p.shiny).toBeUndefined();
  });
});
