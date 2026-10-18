// Living dex forms: which forms of each species count as separate entries, from PokeAPI data.

const ENGLISH = 9;

/** Forms that can never be in Pokémon HOME, or that duplicate another entry. */
const NEVER_IN_HOME = [
  /-totem(-|$)/, // Alolan totems
  /-starter$/, // Let's Go partner Pikachu/Eevee
  /^pikachu-(rock-star|belle|pop-star|phd|libre|cosplay)$/, // ORAS Cosplay Pikachu can't leave ORAS
  /-eternamax$/,
  /-own-tempo$/, // looks like the normal form
  /-power-construct$/, // duplicates the 10%/50% forms
  /^(koraidon|miraidon)-(?!apex-build$|ultimate-mode$)/, // riding modes
  /^minior-(?!red-meteor$).*-meteor$/, // Meteor forms look identical; HOME tracks the cores
];

/** Battle-only forms HOME does register (Mega Evolution, Gigantamax, Primal Reversion); other battle states are skipped. */
const isRegisteredBattleForm = (f) => f.is_mega || f.form_name.startsWith('gmax') || /(^|-)primal$/.test(f.form_name);

const REGIONAL = /^(alola|galar|hisui|paldea)(-|$)/;

/** Path inside the PokeAPI sprites repo, without the prefix and extension: "10103", "201-b", "female/25". */
const spritePath = (url) => url?.match(/sprites\/pokemon\/(.+)\.png$/)?.[1];

function formKind(form, pokemonSlug) {
  if (isRegisteredBattleForm(form)) return 'battle';
  if (REGIONAL.test(form.form_name)) return 'regional';
  if ((pokemonSlug ?? form.name).endsWith('-female')) return 'gender';
  return 'form';
}

const formNames = (form) => Object.fromEntries(form.pokemonformnames.map((n) => [n.language_id, n.name]).filter(([, n]) => n));

/** Whether a non-default form counts as a living dex entry. */
const countsInLivingDex = (form) =>
  !NEVER_IN_HOME.some((re) => re.test(form.name)) && (!form.is_battle_only || isRegisteredBattleForm(form));

function formEntry(form, names) {
  const entry = { key: form.name, name: names[ENGLISH] ?? form.form_name, names, kind: formKind(form) };
  const sprite = spritePath(form.pokemonformsprites[0]?.front);
  if (sprite) entry.sprite = sprite;
  return entry;
}

/**
 * Living dex entries for one species row (PokeAPI species with pokemons → pokemonforms).
 * The species' default form is the species itself (registered with the species); every other form
 * that can be in HOME becomes an extra entry. Species with visible gender differences get a female entry.
 */
export function speciesForms(row, slug) {
  const extra = [];
  let defaultForm;
  for (const pokemon of row.pokemons) {
    for (const form of pokemon.pokemonforms) {
      const names = formNames(form);
      if (pokemon.is_default && form.is_default) {
        // Name the default form only when it has one (e.g. "Meadow Pattern", "A").
        if (names[ENGLISH]) defaultForm = { key: form.name, name: names[ENGLISH], names };
      } else if (countsInLivingDex(form)) {
        extra.push(formEntry(form, names));
      }
    }
  }
  // Some species already have a "-female" form in PokeAPI (Meowstic, Indeedee…); don't add a second one.
  if (row.has_gender_differences && !extra.some((f) => f.key === `${slug}-female`)) {
    extra.push({ key: `${slug}-female`, kind: 'gender', sprite: `female/${row.id}`, names: {} });
  }
  return { defaultForm, forms: extra };
}

/** Shiny status per species and form from data/shiny.json (anything not listed is available). */
export function shinyStatus(shiny, slug, formKey) {
  return (formKey && shiny.forms?.[formKey]) || shiny.species?.[slug] || null;
}
