# Contributing to PokePlan

Thanks for helping make PokePlan better! Bug reports, data corrections and pull requests are all welcome.

## Licensing of contributions

PokePlan is licensed under the [GNU AGPL v3.0 or later](LICENSE). By opening a pull request you agree that your contribution is licensed under the same terms, and you confirm that you have the right to submit it.

## Setup

You need Node.js 22.19 or newer. Docker is needed only for SonarQube.

```bash
npm install
npx playwright install chromium   # browser for the end-to-end tests and Lighthouse
npm run dev                       # http://localhost:5173
```

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

`npm run lighthouse` builds the app, serves the production build and audits it with the mobile and desktop presets. It prints any audit that isn't fully passing and exits with an error when a category scores below 90. The HTML reports are in `reports/lighthouse/`.

If your change lowers a score, explain why in the pull request. A known, accepted item: mobile "Serves images with low resolution", because the sprites are 96px pixel art.

### SonarQube

`npm run sonar -- --strict` starts a local SonarQube server in Docker, runs the unit tests with coverage, scans the code and prints every open issue. The first run takes a few minutes while the server starts; later runs are faster. It exits with an error if the quality gate fails or anything is left open.

- **Dashboard:** http://localhost:9000/dashboard?id=pokeplan. Log in as `admin` with the password from `.cache/sonar.json`, which the script generates on first run.
- **Full report:** `.cache/sonar-report.json`.
- **Stop the server:** `npm run sonar:down`.
- **False positives:** fix the code where you can. If a rule is genuinely wrong, add a `// NOSONAR: <reason>` comment on that line and mention it in the pull request.
