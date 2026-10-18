# Contributing to PokePlan

Thanks for helping make PokePlan better! Bug reports, data corrections and pull requests are all welcome.

## Licensing of contributions

PokePlan is licensed under the [GNU AGPL v3.0 or later](LICENSE). By opening a pull request you agree that your contribution is licensed under the same terms, and you confirm that you have the right to submit it.

## Setup

You need Node.js 22.19 or newer. Docker is needed only for SonarQube.

```bash
npm install
npx playwright install chromium   # browser for the end-to-end tests, Lighthouse and the showcase
npm run dev                       # http://localhost:5173
```

PokePlan is a static Vite + React PWA. Progress (registered Pokémon, owned games) is stored in the browser's `localStorage` under `pokeplan:v1`.

## Project layout

```
data/                     curated inputs (edit these)
  games.json                game catalogue + HOME transfer rules
  special.json              Pokémon GO not-released list, HOME rewards, special gifts
  curated-availability.json version exclusives / extra areas PokeAPI lacks (SV, BDSP)
scripts/
  build-data.mjs            PokeAPI + data/ → web/public/data/pokedex.json
  lib/                      the data build logic (pure, unit tested)
  test/                     tests for scripts/lib
  sonar.mjs                 runs a local SonarQube analysis
  lighthouse.mjs            runs Lighthouse on mobile and desktop
  showcase.mjs              records the README showcase animations
  make-icons.mjs            regenerates the PWA PNG icons
web/
  src/                      Vite + React PWA
  test/                     tests for web/src
  vercel.json               Vercel build, SPA fallback and cache headers
e2e/                      Playwright end-to-end tests
docs/                     README showcase animations
docker-compose.yml        local SonarQube server and scanner
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

Review `data/special.json` and `data/games.json` when HOME, GO or a game gets an update.

## Data corrections

Most mistakes are in the curated files, not the code:

- `data/games.json`: games, DLC and Pokémon HOME transfer rules.
- `data/special.json`: Pokémon GO not-released list, HOME rewards, special gifts and corrections.
- `data/curated-availability.json`: version exclusives and extra areas for Scarlet/Violet and BDSP.

Please include a source (Serebii, the official HOME site, an in-game screenshot…) in the PR description. Species in `special.json` use PokeAPI slugs (e.g. `iron-leaves`), and the build fails on unknown names.

After editing, regenerate the data and check the result:

```bash
npm run data
npm run dev
```

Commit the regenerated `web/public/data/pokedex.json` together with your change.

## Code changes

- Keep PRs focused on one change, and describe what you tested.
- New logic comes with unit tests.
- Unit tests go in the package's `test/` folder (`web/test/`, `scripts/test/`), never next to the sources.
- User-facing behaviour gets an end-to-end test in `e2e/`.

## Tests

Unit tests run with [Vitest](https://vitest.dev):

```bash
npm test               # run once
npm run test:watch     # re-run on change
npm run test:coverage  # also writes coverage/lcov.info
```

End-to-end tests in `e2e/` run with [Playwright](https://playwright.dev) against the production build, so the service worker is real. They run on a desktop and a mobile (Pixel 7) profile and cover:
- the list, filters, details, plan and settings;
- layout overflow on phones;
- the web app manifest, the service worker, sprite caching and offline use.

```bash
npm run test:e2e   # HTML report in reports/playwright/html
```

## Checks before opening a pull request

Run all of these. The pull request template has the same list as a checklist.

| Check | Command | Must pass |
|---|---|---|
| Types | `npm run typecheck` | no errors |
| Unit tests | `npm test` | all green |
| End-to-end tests | `npm run test:e2e` | all green on desktop and mobile |
| Lighthouse | `npm run lighthouse` | 90+ in every category on mobile and desktop |
| SonarQube | `npm run sonar -- --strict` | quality gate OK, 0 open issues, 0 security hotspots |
| Build | `npm run build` | succeeds |

### Lighthouse

`npm run lighthouse` builds the app, serves the production build and audits it with the mobile and desktop presets. It prints any audit that isn't fully passing and exits with an error when a category scores below 90 (`npm run lighthouse -- --min=0.95` raises the bar). The HTML reports are in `reports/lighthouse/`.

Lighthouse 12+ has no PWA category; installability and offline behaviour are covered by the Playwright tests instead.

If your change lowers a score, explain why in the pull request. A known, accepted item: mobile "Serves images with low resolution", because the sprites are 96px pixel art.

### SonarQube

`npm run sonar -- --strict` runs a local SonarQube Community Build in Docker:
- it starts the server, runs the unit tests with coverage, scans the code and prints every open issue;
- it exits with an error if the quality gate fails or anything is left open;
- the first run takes a few minutes while the server starts; later runs are faster.

On the first run, `scripts/sonar.mjs` replaces the default `admin/admin` password with a random one and creates the `pokeplan` project and an analysis token. All three are kept in the git-ignored `.cache/sonar.json`.

- **Dashboard:** http://localhost:9000/dashboard?id=pokeplan. Log in as `admin` with the password from `.cache/sonar.json`.
- **Full report:** `.cache/sonar-report.json`.
- **Configuration:** `sonar-project.properties` (sources, tests, coverage exclusions).
- **Stop the server:** `npm run sonar:down`. Analysis history is kept in Docker volumes.
- **False positives:** fix the code where you can. If a rule is genuinely wrong, add a `// NOSONAR: <reason>` comment on that line and mention it in the pull request.

## README showcase

The animations at the top of the README are recorded from the live site with Playwright and converted to animated WebP with ffmpeg (bundled through the `ffmpeg-static` package). GitHub plays animated images inline; video files committed to a repository only show as links.

```bash
npm run showcase                                   # records https://pokeplan.albertowd.dev
npm run showcase -- --url=http://localhost:4173    # or any other deployment
```

Re-record them after visible UI changes, and keep each file under about 3 MB.

## Deploying (Vercel)

The site is deployed on Vercel from GitHub. The Vercel project's **Root Directory** is `web` (Vercel detects the Vite app there), and `web/vercel.json` sets the rest:

- build with `npm run build` and publish `web/dist`;
- unknown paths fall back to `index.html`;
- `assets/` (fingerprinted by Vite) is cached for a year;
- the app shell, service worker, manifest and data are revalidated on every request, so a new deploy reaches installed PWAs;
- basic security headers (`nosniff`, `X-Frame-Options: DENY`, strict referrer policy).

Keep "Include files outside the root directory in the Build Step" enabled (the default): the build reads the version from the root `package.json`.

Every push to `main` deploys to production, and pull requests get preview deployments.
