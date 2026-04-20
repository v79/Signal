# E2E Tests

Playwright tests covering navigation, feature behaviour, and visual output for Signal.

## Running tests

```bash
npm run test:e2e            # Run all tests (starts dev server automatically)
npm run test:e2e:screenshots  # Same, with list reporter (no progress spinner)
npx playwright test <file>  # Run a single spec file
```

## Screenshot output

Every test that exercises a visible UI state saves a PNG to `screenshots/<spec>/<slug>.png`.
Screenshots are **not committed to git** — they are regenerated on each run and used for manual
before/after comparison during CSS work.

Subfolder layout:

| Folder | Source |
|---|---|
| `screenshots/game-flow/` | `game-flow.spec.ts` — setup screen, turn flow, build flow |
| `screenshots/blocs/` | `blocs.spec.ts` — geopolitical panel states |
| `screenshots/committee/` | `committee.spec.ts` — committee panel states |
| `screenshots/space-overview/` | `space-overview.spec.ts` — near space assets panel |
| `screenshots/tech-tree/` | `tech-tree.spec.ts` — research database modal |
| `screenshots/tooltips/` | `tooltips.spec.ts` — all tooltip hover states |
| `screenshots/narrative/` | `narrative.spec.ts` — narrative modal states |
| `screenshots/visual/` | `visual.spec.ts` — component-level clips via `locator.screenshot()` |
| `screenshots/general/` | `screenshot.spec.ts` — whole-page baseline shots |

## CSS change workflow

1. **Capture baseline.** Run `npm run test:e2e:screenshots` on `main` (or before your CSS branch).
   Copy `screenshots/` to `screenshots-baseline/` (this folder is gitignored).
2. **Make CSS changes** on your branch.
3. **Regenerate screenshots.** Run `npm run test:e2e:screenshots` again.
4. **Diff visually.** Open `screenshots/` and `screenshots-baseline/` side-by-side. Any pixel
   differences are either intentional (the fix) or regressions (needs investigation).

> `screenshots-baseline/` is gitignored. For PR reviews, attach a zip or link a release asset
> rather than committing the PNGs.
