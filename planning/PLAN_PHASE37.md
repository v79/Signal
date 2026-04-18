# Phase 37 — CSS Consolidation & E2E Screenshot Coverage

## Goals

1. **Reduce style sprawl** across the 22 Svelte components (~10.6k LoC of `<style>` blocks) by introducing central CSS files (design tokens + shared utility classes) and refactoring components to use them.
2. **Expand e2e screenshot coverage** so that the majority of the 91 e2e tests capture PNGs — giving us a visual baseline before the CSS refactor and a diffable "after" set when it lands.

Screenshot work comes **first** so the CSS refactor can be audited visually rather than just hoped-for.

## Context

Pain points observed in the current codebase:

- **No central CSS.** Only `+layout.svelte` has any global rules (body, `*`, `html`). Every other component ships its own scoped `<style>` block.
- **Colour sprawl.** Roughly 60+ distinct dark-background hex values across components — many are near-duplicates (`#0a0e14`, `#0a1018`, `#0a1420`, `#0c1018`, `#0d1018`, `#0d1520`, `#060a10`, `#080c14`, `#080f18`, `#080c12`…). Similar drift on borders, accent colours, and success/warning/danger palettes.
- **Font-size sprawl.** ~25 distinct `rem` values in use (0.45, 0.48, 0.5, 0.52, 0.54, 0.55, 0.56, 0.58, 0.6, 0.62, 0.63, 0.65, 0.67, 0.68, 0.7, 0.72, 0.75, 0.76, 0.8, 0.85, 0.9, 1.0, 1.2, 1.4). No typographic scale.
- **Duplicated widgets.** `FacilityPicker.svelte` and `SpaceNodePicker.svelte` clearly share ~100 lines of near-identical row/header/button CSS. Panel headings were already harmonised across BLOCS/COMMITTEE/PROJECTS in Phase 36 — same treatment is needed elsewhere.
- **Only ~19 of 91 e2e tests capture a PNG.** `tooltips.spec.ts` (21 tests) and `narrative.spec.ts` (3 tests) take zero. Without a before/after visual set, a CSS pass is high-risk.

## Part A — E2E Screenshot Coverage (do this first)

### A.1 Strategy

- Use **`page.screenshot({ path, fullPage: true })`** (the existing pattern) rather than Playwright's `toHaveScreenshot()` visual-regression matcher.
  - Why: the hex map is Phaser canvas, RNG seeds vary, and hover/animation states are present — `toHaveScreenshot` will be flaky without heavy stabilisation. A plain PNG write is a cheap, reviewable artifact that fits the "compare before/after" use case.
  - Trade-off: no automated pixel diffing in CI — reviewer must eyeball. Acceptable for this phase; revisit if we want regression gates later.
- **Output scheme.** Keep PNGs under `screenshots/` (current convention, already in `playwright.config.ts` `outputDir`). Introduce subfolders by spec file to avoid the current flat clash: `screenshots/<spec>/<slug>.png` (e.g. `screenshots/tooltips/fund-tooltip.png`).
- **Baseline capture.** Before Part B lands, run the full e2e suite and archive `screenshots/` as `screenshots-baseline/` (gitignored — referenced via tar in the PR or a release-asset link). Do **not** commit baseline PNGs to git (repo bloat).
- **Seeded determinism.** Force a fixed seed wherever the setup helpers drive `/newgame` so layout text does not shift frame-to-frame across runs. Check the existing helpers in `e2e/tooltips.spec.ts` (`startNewGame`) and `e2e/committee.spec.ts` — if they rely on default seeding, extend them.

### A.2 Tests to add screenshots to

Ordered by value-for-effort:

- ✅ **`tooltips.spec.ts`** — 21 tests, 0 screenshots. Each tooltip case should capture the hovered state (tooltip visible). This is the single biggest coverage gap and exactly the kind of UI where CSS changes will be felt.
- ✅ **`narrative.spec.ts`** — 3 tests, 0 screenshots. Capture opening narrative slide, help modal open state, and a mid-slide navigation state.
- ✅ **`committee.spec.ts`** — 32 tests, only 3 screenshots. Add one per distinct visual state: empty slot, filled slot, recruit dialog open, dismiss-disabled tooltip, grace-period message.
- ✅ **`blocs.spec.ts`** — 10 tests, 1 screenshot. Add for: player-row variant, OTHER BLOCS separator, will bar variations.
- ✅ **`tech-tree.spec.ts`** — 7 tests, 2 screenshots. Add: modal opened at different zoom/pan (if applicable), discovery-state legend.
- ✅ **`space-overview.spec.ts`** — 10 tests, 5 screenshots. Fill the gaps (NEAR SPACE tab unlocked state, EARTH ORBIT section, capacity-bar overfull state).
- ✅ **`game-flow.spec.ts`** — 6 tests, 6 screenshots. Already well-covered; skip unless a state is missed.

### A.3 Component-state screenshots (new `visual.spec.ts`)

Add a single new spec whose only job is to parade every major component through its visual states with a clip bound (`page.screenshot({ clip: bbox })`) so the PNGs show only the component, not the whole page. Covers:

- HUD (resources at 0, resources formatted, deficit state)
- CardHand (empty hand, full hand, banked card, expired card)
- EventZone (pending event, countered event, collapsed vs expanded)
- ResearchFeed / SignalTrack / TechProgressSummary
- NewsTicker collapsed + expanded popup
- PhaseControls in each phase
- FacilityPicker and SpaceNodePicker open states
- Tooltip component in isolation (already partly covered by tooltips.spec.ts)

### A.4 CI / local workflow

- `npm run test:e2e -- --update-screenshots` (new alias in `package.json`) to regenerate the entire set cleanly.
- Add a README note in `e2e/README.md` (new file) explaining the baseline → diff flow.

## Part B — CSS Audit & Central Files

### B.1 Build the audit table

One-shot script (not checked in) walks `src/**/*.svelte`, extracts every `<style>` block, and tallies:

- Unique `color` values
- Unique `background` values
- Unique `border` colour/width pairs
- Unique `font-size` values
- Unique `padding` / `gap` values
- Repeated class names across files (hint at shared utility candidates)

Produces `planning/DESIGN_css_audit.md` with the full distributions. This is the evidence we design the token set from — no canonical values guessed at.

### B.2 Central files to create

```
src/styles/
  tokens.css        # CSS custom properties: colours, typography scale, spacing, radii, shadows
  base.css          # resets + :global body/html rules currently in +layout.svelte
  panels.css        # .panel, .panel-header, .panel-section — used by BlocStatus, Committee, Projects, Space, Facility pickers
  buttons.css       # .btn, .btn-primary, .btn-danger, .btn-ghost, .btn-sm — the dozens of ad-hoc button styles today
  forms.css         # inputs, toggles, ranges — lighter usage but still duplicated
  news.css          # news-item, news-category colour chips — shared by NewsTicker + EventZone
```

Imported once from `src/routes/+layout.svelte` via `<style>` `@import` or a `src/styles/index.css` root. (Svelte scoped styles cannot see vars unless declared on `:root` in a `:global` block — tokens must live in `:global` scope.)

### B.3 Proposed token shape (first pass — finalised after B.1)

```css
:root {
  /* Surface palette (dark → darker) */
  --surface-0: #060a10;    /* deepest — page / modal backdrop */
  --surface-1: #0a0e14;    /* panel body */
  --surface-2: #0d1018;    /* panel header */
  --surface-3: #121a25;    /* raised row / hover */
  --surface-alt-bloc: #0a1420;  /* bloc / space tint */

  /* Text */
  --text-primary: #c8d0d8;
  --text-muted: #5a6a7a;
  --text-dim: #3a4a5a;
  --text-accent: #8aacca;

  /* Semantic */
  --ok: #4a8ab4;
  --warn: #c8a040;
  --danger: #d08080;
  --materials: #8b5e3c;   /* already canonicalised in Phase 17 */
  --will: #b47aa8;
  --funding: #6ab08a;

  /* Type scale (7 steps — map existing 25 sizes onto these) */
  --fs-xxs: 0.5rem;
  --fs-xs: 0.58rem;
  --fs-sm: 0.62rem;
  --fs-base: 0.7rem;
  --fs-md: 0.8rem;
  --fs-lg: 1rem;
  --fs-xl: 1.4rem;

  /* Spacing (4-step scale) */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;

  /* Radii, shadows */
  --radius-sm: 2px;
  --radius-md: 4px;
  --shadow-panel: 0 4px 16px rgba(0, 0, 0, 0.6);

  /* Font families */
  --ff-mono: 'Courier New', monospace;
}
```

Exact values are placeholders — B.1's audit picks canonicals from the most-used clusters, not arbitrary guesses.

### B.4 Shared-class candidates (from the audit)

Strong duplicates already visible without the full audit:

- `.panel` — shared by BlocStatusPanel, BoardPanel, CompletedProjectsPanel, SpaceOverview, FacilityOverview
- `.panel-heading` — already harmonised (Phase 36) but style lives per-file
- `.facility-row` — nearly identical between FacilityPicker and SpaceNodePicker (inline comment noted this in the picker files: `.facility-row:hover { background: #101825; }` appears verbatim in both)
- `.build-btn` / `.demolish-btn` / `.open-build-btn` — same colour story in both pickers
- `.news-item` — between NewsTicker and EventZone / science feeds
- `.modifier-chip` / `.buff-chip` / `.debuff-chip` — BoardPanel, CompletedProjectsPanel, CardHand
- `.resource-icon` — HUD, CardHand, EventZone

## Part C — Component Refactor Passes

Landed as **separate commits** inside the phase branch, each verifiable against the A-phase screenshots:

1. Introduce `src/styles/` files + wire into `+layout.svelte`. No component changes.
2. **HUD + PhaseControls + SignalTrack + ResearchFeed** — the top-bar / right-column cluster.
3. **FacilityPicker + SpaceNodePicker** — extract shared row/button classes. Largest dedup win.
4. **BlocStatusPanel + BoardPanel + CompletedProjectsPanel + SpaceOverview + FacilityOverview** — panel family.
5. **CardHand + EventZone + NewsTicker + ScienceNewsFeed + TechProgressSummary** — card/feed family.
6. **Tooltip + TileTooltip + NarrativeModal + TechTreeModal** — overlay family.
7. **MapContainer** — last, because it straddles Phaser and DOM and is likely the trickiest.

After each pass: re-run e2e → regenerate `screenshots/` → manually diff against `screenshots-baseline/`. Commit the pass once diffs are intentional-only.

## Part D — Verification

- `npm run lint` (svelte-check + tsc) must pass after each pass — refactor must not touch behaviour.
- `npm run test` — unit suite must still pass (engine is unaffected but runs as sanity).
- `npm run test:e2e` — all 91 tests must still pass; screenshots regenerate.
- Manual: spot-check every component visually on Chromium 1920×1080 and a narrow viewport (Phase 17 noted small-screen feed issues in FUTURE_PHASES.md — call out anything we break or improve).

## Open Questions

- **Should we commit baseline screenshots to git?** Leaning no (bloat, churn), instead ship as a release asset. _Answer: __No__
- **Visual regression later?** Worth a follow-up phase to wire `toHaveScreenshot()` against a deterministic seed/masked Phaser canvas. _Answer: __No__
- **Svelte 5 `:global` in scoped styles vs central files?** Using central CSS files imported once from the layout is simpler than `:global {}` blocks inside components. Confirm this is the preferred direction. _Answer: __Yes__
- **Tailwind-style utility adoption?** Explicitly not proposed here — we're staying with plain CSS + tokens to minimise scope. Flag if a different direction is wanted. _Answer: __Np, stay with plain CSS__

## Out of Scope

- Any behavioural or layout changes beyond what's needed to adopt the tokens (e.g., no new panel designs — that's Phase 17's deferred 17.6 work).
- Animation/transition work (deferred per FUTURE_PHASES.md).
- Tailwind / CSS-in-JS / styling framework adoption.
