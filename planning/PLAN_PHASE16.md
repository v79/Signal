# Phase 16 — Tech Tree Visualisation

## Overview

The research system is the central mechanic of Signal, but it is currently invisible. Players accumulate field points, technologies unlock in the background, and news items appear — but there is no interface that lets the player see what technologies exist, how close they are, or what discovering each one will unlock.

Phase 16 adds a **Tech Tree modal**: a full-screen overlay accessible from the Research Feed that renders technologies as interactive nodes in a **Phaser canvas**. Svelte handles the modal chrome (backdrop, header, close button); Phaser handles all node drawing, progress bars, colour coding, and — in a future phase — dependency arrows between nodes.

---

## Why Phaser, Not HTML

A pure HTML/CSS implementation would require an awkward SVG overlay to draw dependency arrows when `requiredTechIds` is added in a later phase. Phaser makes this a trivial `Graphics.strokePath()` call. Additional benefits:

- Pan and zoom come free via Phaser's Camera system as the tree grows across eras.
- Node discovery animations (glow pulse, connection propagation) are straightforward.
- The architecture follows the established pattern already used by `EarthScene`, `SpaceScene`, and `AsteroidScene` — no new patterns to introduce.

---

## Goals

1. **Tech Tree button** — a button in the Research Feed header opens the modal.
2. **Phaser canvas modal** — Svelte backdrop + header; Phaser `<canvas>` fills the content area.
3. **Node layout** — technologies arranged left-to-right by complexity tier; nodes drawn as rounded rectangles with name, field bars, and stage indicator.
4. **Discovery fog** — unknown techs show a dim placeholder; rumoured techs show name + flavour hint; progress techs show live field bars; discovered techs show full detail and unlock list.
5. **Unlock preview** — discovered and in-progress nodes list unlocked cards and facilities.
6. **Signal-derived gating** — signal-derived techs hidden until `signal.eraStrength === 'structured'`; shown as a signal-icon node until then.
7. **Field colour coding** — consistent field colours across all progress bars and the existing HUD.

---

## Scope Constraints

- Era 1 techs only (12 nodes). Era 2 / Era 3 content is deferred.
- No new engine logic — the scene reads existing `PlayerState.techs`, `TechDef`, and `PlayerState.fields`.
- No research interaction — research remains passive; this is a read-only view.
- No dependency arrows in this phase (no `requiredTechIds` field yet). Layout is tier-based only. The Phaser approach makes adding arrows straightforward later.

---

## 1. Data & Types

No new engine types are needed. Data is passed into the Phaser scene via a `setData()` call from the Svelte component each time it changes (same pattern as `EarthScene.setCallbacks()`).

**Scene data interface** (defined in `src/phaser/TechTreeScene.ts`):

```ts
export interface TechTreeSceneData {
  techs:        TechState[];
  techDefs:     Map<string, TechDef>;
  fields:       FieldPoints;
  signal:       SignalState;
  cardDefs:     Map<string, CardDef>;
  facilityDefs: Map<string, FacilityDef>;
}
```

**Data sources** (all already available):

| Field | Source |
|---|---|
| `techs` | `gs.player.techs` |
| `techDefs` | `TECH_DEFS` (import in route) |
| `fields` | `gs.player.fields` |
| `signal` | `gs.signal` |
| `cardDefs` | `CARD_DEFS` |
| `facilityDefs` | `FACILITY_DEFS` |

`TECH_DEFS` must be imported in `+page.svelte` alongside the other `*_DEFS` constants and passed down to `ResearchFeed`.

---

## 2. Tier Layout

Technologies are grouped into **4 tiers** by the sum of their `baseRecipe` field values. Tiers are computed at render time from `TechDef.baseRecipe` so they generalise to future eras without code changes.

| Tier | Threshold (sum of base recipe) | Era 1 techs |
|------|-------------------------------|-------------|
| 1 | < 80 | `integratedCircuits`, `rocketGuidanceSystems`, `satelliteCommunications` |
| 2 | 80–130 | `microprocessors`, `personalComputing`, `geneticSequencing`, `globalPositioningNetwork` |
| 3 | 130–200 | `roboticsAutomation`, `internetProtocols`, `digitisedTelemetry` |
| 4 | > 200 | `signalPatternAnalysis`, `orbitalMechanics` |

Within each tier column, nodes are stacked vertically in `TECH_DEFS` insertion order. Tier columns are evenly spaced horizontally. Node positions are computed once in `create()` and stored on the scene for use in `update()` and future arrow drawing.

---

## 3. Node Visual States

Each node is drawn as a rounded rectangle (Phaser `Graphics.fillRoundedRect`). Content varies by `TechState.stage`:

### `unknown` (signal-derived, signal not yet `structured`)
- Dark dim fill (`0x0a1018`), no border.
- Single centred signal/wave icon drawn with `Graphics`.
- No name, no bars.

### `unknown` (standard)
- Dark dim fill, faint stroke.
- Centred `???` text in dim colour.
- No bars, no unlock list.

### `rumour`
- Slightly brighter fill, muted border.
- Tech name rendered in muted white.
- `TechDef.rumourText` rendered in italic-style smaller text beneath (Phaser bitmap font or wrapped `Text` object).
- No field bars (recipe not yet revealed to player).

### `progress`
- Mid-brightness fill, coloured border matching the dominant required field.
- Tech name in white.
- One horizontal progress bar per required field in `TechDef.baseRecipe`:
  - Width: `Math.min(1, fields[field] / recipe[field]) * BAR_WIDTH`
  - Colour: `FIELD_COLOURS[field]` (see §4)
  - Label: abbreviated field name to the left of each bar
- If `requiresSimultaneous === true`: small "⊕ SIMULTANEOUS" label below bars.
- Unlock list shown as `? card`, `? facility` placeholders.

### `discovered`
- Bright fill, amber/gold border (`0xd4a820`).
- Tech name in bright white.
- All field bars fully filled.
- Unlock list with real names from `cardDefs` and `facilityDefs`.
- Faint glow effect drawn as a large low-alpha circle behind the node.

---

## 4. Field Colour Coding

Defined as a constant in `TechTreeScene.ts`, reusable by future scenes:

```ts
export const FIELD_COLOURS: Record<string, number> = {
  physics:       0x6a9fd8,
  mathematics:   0x8a70c8,
  engineering:   0xc87840,
  biochemistry:  0x58a870,
  computing:     0x60b8a0,
  socialScience: 0xc86080,
};
```

---

## 5. Architecture

### Phaser scene lifecycle

`TechTreeScene` is **not** registered in the main `Phaser.Game` instance used by the map. It lives in its own dedicated `Phaser.Game` instance created when the modal opens and destroyed when the modal closes. This avoids polluting the main scene registry and means the tech tree has no lifecycle coupling with the map scenes.

```
Modal opens
  → new Phaser.Game({ scene: TechTreeScene, canvas: modalCanvasEl })
  → scene.create() — compute node positions, draw static background
  → scene.setData(data) — inject live state
  → scene.update() — redraws nodes each frame from latest data

Modal closes
  → game.destroy(true)
```

### Svelte component responsibilities

`TechTreeModal.svelte`:
- Renders backdrop div + header row ("TECH TREE" title + ✕ button).
- Holds a `<canvas bind:this={canvasEl}>` element.
- In `onMount`: creates the `Phaser.Game` instance, calls `scene.setData(data)`.
- In `$effect`: calls `scene.setData(data)` whenever `techs` or `fields` change (so the tree stays live if the player advances a turn while the modal is open — unlikely but correct).
- In `onDestroy`: calls `game.destroy(true)`.
- Traps Escape key; calls `onClose` prop.

### Data flow

```
+page.svelte
  → ResearchFeed (techDefs, techs, fields, signal, cardDefs, facilityDefs)
    → [TECH TREE button click]
    → TechTreeModal.svelte
      → TechTreeScene.setData(...)
        → renders nodes
```

---

## 6. Scene Layout Sketch

```
┌─ TECH TREE ─────────────────────────────────────────────────── [✕] ─┐
│  [Phaser canvas — full content area]                                  │
│                                                                       │
│   TIER 1            TIER 2            TIER 3            TIER 4        │
│                                                                       │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐  │
│  │ Integrtd │      │Microproc │      │Robotics  │      │≋ Signal  │  │
│  │ Circuits │      │essors    │      │          │      │  hidden  │  │
│  │ ENG ████ │      │ COM ░░░░ │      │  [???]   │      │          │  │
│  │ COM ████ │      │ MAT ░░░░ │      │          │      │          │  │
│  │ Unlocks: │      │          │      │          │      │          │  │
│  │ softwareG│      │          │      │          │      │          │  │
│  └──────────┘      └──────────┘      └──────────┘      └──────────┘  │
│  ┌──────────┐      ...                                                │
│  │ Rocket   │                                                         │
│  │ Guidance │                                                         │
│  │ RUMOURED │                                                         │
│  └──────────┘                                                         │
│                                                                       │
│  ● Discovered   ◐ In Progress   ○ Rumoured   ░ Unknown               │
└───────────────────────────────────────────────────────────────────────┘
```

The legend at the bottom is drawn by Phaser as part of the scene (not HTML).

---

## 7. Engine Note: Recipe Visibility

`TechState.recipe` contains the randomised per-run thresholds and is populated for all techs at game start. Fog-of-war is applied **only in the UI** by stage — no engine changes are needed:

| Stage | What is shown |
|-------|--------------|
| `unknown` | Nothing |
| `rumour` | Field names only; threshold values hidden (`?`) |
| `progress` | Full bars: `fields[f] / recipe[f]` |
| `discovered` | Bars fully filled; threshold values shown |

---

## 8. Implementation Order

1. **`src/engine/techTree.ts`** — pure helper: `getTechTier(def): 1|2|3|4`; exported for both scene and tests.
2. **`src/engine/techTree.test.ts`** — unit tests for `getTechTier` covering all 12 Era 1 techs.
3. **`src/phaser/TechTreeScene.ts`** — scene class: `TechTreeSceneData` interface, `setData()`, `create()` (layout), `update()` (redraw).
4. **`src/lib/components/TechTreeModal.svelte`** — Svelte wrapper: canvas element, `Phaser.Game` lifecycle, `setData` wiring, Escape key trap.
5. **`src/lib/components/ResearchFeed.svelte`** — add new props; add "TECH TREE" button; conditionally render `TechTreeModal`.
6. **`src/routes/+page.svelte`** — import `TECH_DEFS`; pass all required props to `ResearchFeed`.

---

## 9. Tests

One new test file for the engine helper:

**`src/engine/techTree.test.ts`**
- `getTechTier` returns correct tier for each of the 12 Era 1 techs.
- `getTechTier` returns tier 1 for a def with very low total recipe.
- `getTechTier` returns tier 4 for a def with very high total recipe.
- Empty recipe → tier 1 (edge case).

Manual review checklist:
- [ ] All 12 Era 1 techs appear in the correct tier column.
- [ ] Signal-derived tech (`signalPatternAnalysis`) shows signal icon until `signal.eraStrength === 'structured'`.
- [ ] Unknown techs show `???`; rumoured show name + flavour; progress show bars; discovered show full detail.
- [ ] Progress bars do not exceed full width.
- [ ] `requiresSimultaneous` marker appears on `signalPatternAnalysis` and `orbitalMechanics`.
- [ ] Discovered tech shows correct unlock names from `cardDefs` / `facilityDefs`.
- [ ] Modal closes on backdrop click and Escape key.
- [ ] `Phaser.Game` instance is destroyed on modal close (no memory leak).
- [ ] Tier layout readable at 1280×800 minimum.

---

## 10. Test Count Target

| Milestone | Tests |
|-----------|-------|
| Phase 15 complete | 319 |
| Phase 16 complete (target) | ~325 |

---

## 11. Files Changed / Created

| File | Status | Notes |
|------|--------|-------|
| `src/engine/techTree.ts` | TODO | **New** — `getTechTier` pure helper |
| `src/engine/techTree.test.ts` | TODO | **New** — tier computation tests |
| `src/phaser/TechTreeScene.ts` | TODO | **New** — Phaser scene: node layout, drawing, data injection |
| `src/lib/components/TechTreeModal.svelte` | TODO | **New** — Svelte modal chrome + Phaser.Game lifecycle |
| `src/lib/components/ResearchFeed.svelte` | TODO | Add TECH TREE button + new props |
| `src/routes/+page.svelte` | TODO | Import `TECH_DEFS`; pass to `ResearchFeed` |

---

## 12. Future-Proofing Notes

- **Dependency arrows**: when `requiredTechIds: string[]` is added to `TechDef`, the scene computes source/target node centres from the stored position map and draws bezier curves with `Graphics.strokePath()`. No structural change to the scene or component.
- **Pan / zoom**: enable Phaser's camera drag and pinch-to-zoom in `create()`. Nodes stay in world coordinates; only the camera moves.
- **Era 2 / 3 nodes**: the tier computation and layout loop are data-driven; adding more `TechDef` entries automatically populates new nodes.
- **Node click for detail drawer**: add `setInteractive()` to each node rectangle and emit a scene event; the Svelte wrapper listens and renders a detail panel in HTML beside the canvas.

---

## 13. Out of Scope (Deferred)

- Era 2 / Era 3 tech nodes
- Dependency arrows (requires `requiredTechIds` on `TechDef`)
- Pan / zoom
- Clicking nodes for a detail drawer
- Research field assignment (passive by design)
