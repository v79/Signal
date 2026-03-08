# Phase 16 — Tech Tree Visualisation

## Overview

The research system is the central mechanic of Signal, but it is currently invisible. Players accumulate field points, technologies unlock in the background, and news items appear — but there is no interface that lets the player see what technologies exist, how close they are, or what discovering each one will unlock.

Phase 16 adds a **Tech Tree panel**: a modal overlay accessible from the Research Feed that displays all technologies for the current era, their discovery stage, field requirements, progress toward each threshold, and unlocked content. For unknown technologies, information is intentionally withheld (fog of war).

---

## Goals

1. **Tech Tree button** — a single button in the Research Feed opens the modal.
2. **Modal panel** — full-screen overlay containing the tech tree.
3. **Node layout** — technologies arranged left-to-right by complexity tier; each node shows name, field requirements, and stage.
4. **Discovery fog** — unknown techs show a placeholder; rumoured techs show name only; progress techs show progress bars; discovered techs show full detail.
5. **Unlock preview** — each discovered or in-progress tech lists what it unlocks (cards, facilities).
6. **Signal-derived gating** — signal-derived techs that are still hidden show a signal icon instead of a name.
7. **Field colour coding** — field requirement bars use consistent colours matching the existing HUD.

---

## Scope Constraints

- Era 1 techs only (12 nodes). Era 2 / Era 3 content is out of scope until those phases are planned.
- No new engine logic. The tech tree reads existing `PlayerState.techs`, `TechDef`, and `PlayerState.fields`.
- No research interaction — players cannot assign research from this panel. Research remains passive.
- No tech–tech dependency arrows for now (no explicit `requiredTechIds` field exists). Layout is tier-based only.

---

## 1. Data & Types

No new engine types are needed. The component will receive:

| Prop | Type | Source |
|---|---|---|
| `techs` | `TechState[]` | `gs.player.techs` |
| `techDefs` | `Map<string, TechDef>` | `TECH_DEFS` (imported in route) |
| `fields` | `FieldPoints` | `gs.player.fields` |
| `signal` | `SignalState` | `gs.signal` |
| `cardDefs` | `Map<string, CardDef>` | `CARD_DEFS` (for unlock names) |
| `facilityDefs` | `Map<string, FacilityDef>` | `FACILITY_DEFS` (for unlock names) |

`TECH_DEFS` is already imported in `game.svelte.ts` but not currently passed to any component. It should be imported in the route (`+page.svelte`) alongside the other `*_DEFS` imports.

---

## 2. Tier Layout

Technologies are arranged into **4 tiers** by approximate field-point total (sum of `baseRecipe` values). There are no explicit `requiredTechIds` in `TechDef`, so tiers are computed at render time.

| Tier | Total base field points | Era 1 techs |
|------|------------------------|-------------|
| 1 | < 80 | `integratedCircuits`, `rocketGuidanceSystems`, `satelliteCommunications` |
| 2 | 80–130 | `microprocessors`, `personalComputing`, `geneticSequencing`, `globalPositioningNetwork` |
| 3 | 130–200 | `roboticsAutomation`, `internetProtocols`, `digitisedTelemetry` |
| 4 | > 200 | `signalPatternAnalysis`, `orbitalMechanics` |

The tier thresholds should be computed dynamically (sum of `baseRecipe` values) so they generalise to Era 2 / Era 3 without code changes. Tiers use fixed boundaries: `< 80`, `80–130`, `130–200`, `> 200`.

Within each tier, nodes are arranged vertically in a fixed order (matching the order in `TECH_DEFS`).

---

## 3. Node Visual States

Each tech node renders differently based on `TechState.stage`:

### `unknown`
- If `signalDerived === true` AND `signal.eraStrength !== 'structured'`:
  - Node shows only a signal/antenna icon. Name hidden.
- Otherwise:
  - Node shows `???` placeholder and a dim requirement silhouette.
  - No progress bars.
  - No unlock list.

### `rumour`
- Shows tech **name** (from `TechDef.name`).
- Shows `TechDef.rumourText` as flavour hint in italics.
- No recipe revealed yet (`TechState.recipe` is null at this stage in the current engine — see note below).
- No unlock list.

### `progress`
- Shows tech **name**.
- Shows a **progress bar per required field**: fill = `currentFieldValue / recipeThreshold`, capped at 100%.
- Field bars labelled and colour-coded (see §4).
- Unlock list shown but items listed as "?" if not yet discovered.
- Special marker if `requiresSimultaneous === true` (cross-field breakthrough).

### `discovered`
- Full tech card: name, field bars (all filled), discovered turn.
- Unlock list with real names: cards, facilities unlocked.
- Visually distinct (brighter border, amber/gold accent).

---

## 4. Field Colour Coding

Consistent colours to use across all field progress bars (align with existing HUD colours):

| Field | Colour |
|-------|--------|
| `physics` | `#6a9fd8` (blue) |
| `mathematics` | `#8a70c8` (purple) |
| `engineering` | `#c87840` (amber) |
| `biochemistry` | `#58a870` (green) |
| `computing` | `#60b8a0` (teal) |
| `socialScience` | `#c86080` (pink) |

These should be defined as a `FIELD_COLOURS` constant in the component (or a shared constants file) for reuse by future components.

---

## 5. Component Architecture

### New files

**`src/lib/components/TechTreeModal.svelte`**
- Top-level modal overlay (backdrop + panel).
- Receives all props (listed in §1).
- Handles close on backdrop click or Escape key.
- Renders `TechTierColumn` for each tier (1–4), laid out in a horizontal flex row.

**`src/lib/components/TechNode.svelte`**
- Renders a single technology node.
- Props: `def: TechDef`, `state: TechState`, `fields: FieldPoints`, `cardDefs`, `facilityDefs`, `signalEraStrength: SignalEraStrength`.
- Internally computes progress fraction per field: `Math.min(1, fields[field] / recipe[field])`.

### Modified files

**`src/lib/components/ResearchFeed.svelte`**
- Add `techDefs`, `techs`, `cardDefs`, `facilityDefs` props.
- Add a "TECH TREE" button (small, top-right of the panel header).
- When clicked, sets a local `showTechTree` boolean; renders `TechTreeModal` as an overlay within the component (or hoisted via a portal-like pattern if z-index is an issue).

**`src/routes/+page.svelte`**
- Import `TECH_DEFS` from `../data/technologies`.
- Pass `techDefs={TECH_DEFS}`, `techs={gs.player.techs}`, `cardDefs={CARD_DEFS}`, `facilityDefs={FACILITY_DEFS}` to `ResearchFeed`.

---

## 6. Modal Layout

```
┌─ TECH TREE ────────────────────────────────────────────────────── [✕] ┐
│                                                                        │
│  TIER 1          TIER 2          TIER 3          TIER 4               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │ Integrated│   │Microproc-│   │Robotics &│   │Signal    │           │
│  │ Circuits  │   │essors    │   │Automation│   │Pattern   │           │
│  │ ████████ │   │ ░░░░░░░░ │   │ [???]    │   │ ≋ hidden │           │
│  │ ENG COM  │   │ COM MATH │   │          │   │          │           │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│  │ Rocket   │   │ Personal │   │ Internet │   │ Orbital  │           │
│  │ Guidance │   │ Computing│   │ Protocols│   │ Mechanics│           │
│  │ RUMOURED │   │ ░░░░░░░░ │   │ [???]    │   │ [???]    │           │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘           │
│  ...                                                                   │
│                                                                        │
│  ● Discovered  ◐ In Progress  ○ Rumoured  ░ Unknown                   │
└────────────────────────────────────────────────────────────────────────┘
```

- Scrollable vertically within each tier column if nodes overflow.
- Fixed header with close button.
- Legend bar at the bottom showing stage icons.

---

## 7. Engine Note: Recipe Visibility

Currently, `TechState.recipe` is generated at game start for all techs (it is the randomised per-run threshold). It is available on all `TechState` objects from turn 1. The fog-of-war is applied purely in the **UI** by stage:

- `unknown`: do not show recipe.
- `rumour`: show field names only, not values (or show "?" values).
- `progress` + `discovered`: show actual threshold values and progress bars.

No engine changes are required.

---

## 8. Implementation Order

1. **Route update** — import `TECH_DEFS` in `+page.svelte`; add props to `ResearchFeed` invocation.
2. **ResearchFeed** — add new props; add "TECH TREE" button; wire `showTechTree` boolean.
3. **TechNode.svelte** — implement all four visual states; field progress bars; unlock list.
4. **TechTreeModal.svelte** — layout wrapper; tier columns; backdrop + close.
5. **Wire modal** — mount `TechTreeModal` inside `ResearchFeed` (or hoist if needed).
6. **Tests** — unit tests for the tier-computation helper; visual review.

---

## 9. Tests

Engine tests are not required (no new engine logic). Component tests are out of scope for Vitest (Svelte rendering not tested). Manual review checklist:

- [ ] All 12 Era 1 techs appear in the correct tier.
- [ ] Signal-derived tech (`signalPatternAnalysis`) is hidden until signal reaches `structured`.
- [ ] Unknown techs show `???`; rumoured techs show name + rumour text; progress techs show bars.
- [ ] Discovered techs show full unlock list with correct card/facility names.
- [ ] `requiresSimultaneous` techs (`signalPatternAnalysis`, `orbitalMechanics`) show a visual marker.
- [ ] Progress bars do not exceed 100%.
- [ ] Modal closes on backdrop click and Escape key.
- [ ] Tier layout is readable at 1280×800 minimum.

One Vitest test is appropriate: a pure function `getTechTier(def: TechDef): number` that sums `baseRecipe` values and returns a tier 1–4. This should live in a utility file or inline in the component script and be tested in `src/engine/techTree.test.ts`.

---

## 10. Test Count Target

| Milestone | Tests |
|-----------|-------|
| Phase 15 complete | 319 |
| Phase 16 complete (target) | ~321 |

(Only the `getTechTier` helper warrants a new test file; the rest is UI.)

---

## 11. Files Changed / Created

| File | Status | Notes |
|------|--------|-------|
| `src/lib/components/TechTreeModal.svelte` | TODO | **New** — modal shell, tier layout |
| `src/lib/components/TechNode.svelte` | TODO | **New** — single tech node, all stages |
| `src/lib/components/ResearchFeed.svelte` | TODO | Add TECH TREE button + new props |
| `src/routes/+page.svelte` | TODO | Import `TECH_DEFS`; pass to `ResearchFeed` |
| `src/engine/techTree.test.ts` | TODO | **New** — `getTechTier` unit tests |

---

## 12. Out of Scope (Deferred)

- Era 2 / Era 3 tech nodes (planned in later phases)
- Tech–tech dependency arrows (requires adding `requiredTechIds` to `TechDef`)
- Zoom / pan within the tree (only 12 nodes in Era 1 — fits in viewport)
- Research field assignment UI (out of scope by design — research is always passive)
- Clicking a tech to open a detail drawer (node content is self-contained)
