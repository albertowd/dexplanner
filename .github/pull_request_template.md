## What does this change?

<!-- A short description of the change and why it's needed. Link the issue it fixes, if any (e.g. "Fixes #12"). -->

## Type of change

- [ ] Data correction (games, availability, HOME rules)
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor or tooling
- [ ] Documentation

## Sources (data corrections)

<!-- Where does the corrected information come from? Serebii page, official HOME site, in-game screenshot… -->

## Screenshots (UI changes)

<!-- Before / after, ideally on desktop and mobile. -->

## Checklist

- [ ] `npm run typecheck` has no errors
- [ ] `npm test` passes, and new logic has unit tests in a `test/` folder
- [ ] `npm run test:e2e` passes on desktop and mobile
- [ ] `npm run lighthouse` stays at 90+ in every category on mobile and desktop
- [ ] `npm run sonar -- --strict` passes: quality gate OK, 0 open issues, 0 security hotspots
- [ ] `npm run build` succeeds
- [ ] Data changes: `npm run data` was run and `web/public/data/pokedex.json` is committed
- [ ] Docs (README, CONTRIBUTING) are updated if the change affects them
