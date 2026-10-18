# PokePlan – Let's catch them all

A Pokédex PWA that tracks your **Pokémon HOME** National Pokédex and tells you, for each missing Pokémon:

- **which game, DLC, app or HOME reward has it** (specific titles and version exclusives, not generations);
- **how it gets into HOME** from there: two-way, one-way, via Pokémon Bank, Z-A's compatibility lock, the FRLG Pokédex sync;
- **which games to buy or play next**: a plan that starts with the games you own and then adds the game or DLC that unlocks the most missing Pokémon.

It is a static Vite + React site, deployed on Vercel from GitHub.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Progress (registered Pokémon, owned games) is stored in the browser's `localStorage`. Use **Settings → Export backup** to move it between devices.

## Layout

```
data/                 curated inputs (edit these)
  games.json            game catalogue + HOME transfer rules
  special.json          Pokémon GO not-released list, HOME rewards, special gifts
  curated-availability.json  version exclusives / extra areas PokeAPI lacks (SV, BDSP)
scripts/
  build-data.mjs        PokeAPI + data/ → web/public/data/pokedex.json
  lib/                  the data build logic (pure, unit tested)
  test/                 tests for scripts/lib
  sonar.mjs             runs a local SonarQube analysis
  lighthouse.mjs        runs Lighthouse on mobile and desktop
  make-icons.mjs        regenerates the PWA PNG icons
web/
  src/                  Vite + React PWA
  test/                 tests for web/src
e2e/                  Playwright end-to-end tests
vercel.json           Vercel build, SPA fallback and cache headers
docker-compose.yml    local SonarQube server and scanner
```

## Pokédex data

`web/public/data/pokedex.json` is generated and committed. To rebuild it:

```bash
npm run data           # uses the cached PokeAPI snapshot in .cache/
npm run data:refresh   # re-downloads species data from PokeAPI's GraphQL API
```

Where the information comes from:

| Information | Source |
|---|---|
| Species, regional Pokédexes per game (incl. Z-A, Mega Dimension) | PokeAPI |
| Version exclusives up to Sword/Shield and DLC, Let's Go, retro games | PokeAPI encounter data |
| Version exclusives for Scarlet/Violet (+DLC) and BDSP; BDSP Grand Underground and Ramanas Park; Snacksworth legendaries | `data/curated-availability.json` (from Serebii and guides) |
| HOME transfer rules per game | `data/games.json` (home.pokemon.com/en-us/move, Serebii) |
| Pokémon GO not-released species | `data/special.json` (pogoapi.net has not been updated since Jan 2026, so it is not used) |
| HOME Pokédex rewards and save-data gifts | `data/special.json` |

Known simplifications:

- Availability is per **species**. Regional forms, Megas and Gigantamax are not tracked separately.
- In games with no encounter data (SV, Legends: Arceus, Z-A) a species in the regional dex is shown as "in game" with no method.
- Pokémon GO availability rotates with events. Pokémon listed as available in GO may not be catchable today.
- Review `data/special.json` and `data/games.json` when HOME, GO or a game gets an update.

## Pokémon HOME rules modelled

- HOME registers a Pokémon in its National Pokédex **when it is deposited in a HOME box**. Trades received in HOME also count.
- **FireRed/LeafGreen (Switch)** is the only game whose own Pokédex syncs to HOME. Each transfer syncs it, so species registered in FRLG count toward HOME's FRLG dex without moving each one. It is not confirmed that this also fills the National Pokédex.
- **Two-way:** Sword/Shield, BDSP, Legends: Arceus, Scarlet/Violet, Legends: Z-A.
  - Pokémon caught in, or ever moved into, **Z-A** can never go to older games.
- **One-way:** Let's Go, FRLG (Switch), Pokémon GO, Pokémon Bank.
  - Bank can't be newly downloaded and **shuts down on 25 Feb 2027**.
- **Pokémon Champions** only borrows Pokémon from HOME, and Pokémon obtained there can't be deposited, so it is not listed as a source.

### Why there is no automatic HOME sync

Pokémon HOME has no public API, export or share feature for a user's Pokédex or boxes. The only unofficial route is reading game saves from modded hardware, which breaks the terms of service. So the app offers manual tracking instead: per-Pokémon toggles, bulk "mark shown", pasting a list of numbers or names, and JSON backup/restore.

## Tests

Unit tests live in each package's `test/` folder, not next to the sources, and run with [Vitest](https://vitest.dev):

```bash
npm test               # run once
npm run test:watch     # re-run on change
npm run test:coverage  # also writes coverage/lcov.info
```

End-to-end tests in `e2e/` run with [Playwright](https://playwright.dev) against the production build (so the service worker is real), on a desktop and a mobile (Pixel 7) profile. They cover the list, filters, details, plan, settings, layout overflow, the web app manifest, the service worker, sprite caching and offline use.

```bash
npx playwright install chromium   # once
npm run test:e2e                  # HTML report in reports/playwright/html
```

## Lighthouse

```bash
npm run lighthouse              # mobile + desktop audits, fails below 90 in any category
npm run lighthouse -- --min=0.95
```

Reports are written to `reports/lighthouse/{mobile,desktop}.html`. Lighthouse 12+ has no PWA category; installability and offline behaviour are checked by the Playwright tests instead.

## Code quality (SonarQube)

A local SonarQube Community Build runs in Docker. Docker must be running.

```bash
npm run sonar             # start SonarQube, run tests with coverage, scan, print issues
npm run sonar -- --strict # same, but exit 1 if the quality gate fails or any issue is open
npm run sonar:down        # stop the server (analysis history is kept in Docker volumes)
```

- **First run:** `scripts/sonar.mjs` replaces the default `admin/admin` password with a random one, creates the `pokeplan` project and an analysis token. All of these are kept in the git-ignored `.cache/sonar.json`.
- **Results:** the dashboard is at http://localhost:9000/dashboard?id=pokeplan (log in as `admin` with the password from `.cache/sonar.json`). The full report is also written to `.cache/sonar-report.json`.
- **Configuration:** `sonar-project.properties` defines sources, tests and coverage exclusions.

## Deploying (Vercel)

Import the GitHub repository in Vercel. `vercel.json` already sets the build:

- install with `npm ci`, build with `npm run build`, publish `web/dist`;
- unknown paths fall back to `index.html`;
- `assets/` (fingerprinted by Vite) is cached for a year;
- the app shell, service worker, manifest and data are revalidated on every request, so a new deploy reaches installed PWAs;
- basic security headers (`nosniff`, `X-Frame-Options: DENY`, strict referrer policy).

Every push to the default branch deploys to production, and pull requests get preview deployments.

## Contributing

Pull requests are welcome, especially data corrections. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

PokePlan is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License v3.0](LICENSE) or (at your option) any later version.

If you run a modified version where others can use it over a network, the AGPL requires you to offer them its complete source code under the same license.

## Credits and disclaimer

PokePlan is an unofficial, non-commercial fan project. It is not affiliated with, endorsed or sponsored by Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and Pokémon character names are trademarks of Nintendo. Pokémon images are © Nintendo, Creatures and GAME FREAK; they are not part of this repository and not covered by its license. The app loads them at runtime from the [PokeAPI sprites](https://github.com/PokeAPI/sprites) repository.

Species and Pokédex data from [PokeAPI](https://pokeapi.co).
