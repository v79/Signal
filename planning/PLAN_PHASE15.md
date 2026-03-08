# Phase 15 — Bloc Maps, HQ, Construction Queue, Ongoing Actions

## Overview

Phase 15 makes the Earth map feel like a real strategic board rather than a generic procedural grid. It introduces bloc-specific stylised hex layouts, a mandatory HQ facility present from game start, tooltip overlays on hover, facility deletion, multi-turn construction/demolition, and a new Ongoing Actions panel in the UI.

---

## Goals

1. **Bloc-specific hex maps** ✅ — each of the 7 blocs has a predefined tile layout shaped to reflect its real-world geography in abstracted form.
2. **HQ facility** ✅ — always present at game start; provides a trickle of resources differentiated by bloc type.
3. **Hex hover tooltip** ✅ — mousing over any tile shows its type, existing facility, and per-turn resource output.
4. **Facility deletion** ✅ — clicking a tile that has a facility offers a demolish option (instant); HQ cannot be demolished.
5. **Multi-turn construction & demolition** — facilities take a configurable number of turns to build or demolish; partial state is tracked and rendered.
6. **Ongoing Actions panel** — a new UI panel lists active construction and demolition tasks with turns remaining and optional cancel.

---

## Scope Constraints

- No Era 2 or Era 3 content changes in this phase.
- No changes to the research, technology, card, or event systems.
- No new FacilityDefs beyond the HQ.
- No changes to the bloc NPC simulation.

---

## 1. Bloc-Specific Hex Maps ✅ DONE

### What was implemented

- New file `src/data/blocMaps.ts` defines `TileLayout` and `BLOC_MAPS` — a record mapping each bloc key to an array of `{ q, r, type }` entries.
- All 7 blocs have layouts of 24–30 tiles each, geographically inspired:
  - **northAmerica** — wide irregular spread; boreal north, industrial belt, agricultural plains, arid southwest, coastal east/west.
  - **eastAsia** — dense coastal east, urban-industrial core, highland interior, forested north.
  - **southAmerica** — forested Amazon interior, Andes highland, agricultural pampas, coastal rim.
  - **africaCoalition** — arid Sahara north, equatorial forest, agricultural east, coastal rim, Rift Valley highland.
  - **eurozone** — dense urban/industrial core, Alpine highland, agricultural periphery, Atlantic and Mediterranean coasts.
  - **southAsia** — Himalayan highland north, Ganges urban core, Deccan agricultural interior, peninsular coastal wrap.
  - **middlewEast** — arid-dominated interior, urban/industrial Gulf pockets, Zagros highland, coastal south and west.
- Each layout contract: exactly one `(0,0)` urban tile (HQ anchor), no duplicate coords, valid `TileType` values only.
- `generateEarthTilesForBloc(blocDefId)` replaces the old procedural `generateEarthTiles()`. Old function kept as a legacy alias used by some existing tests.
- All generated tiles initialise with `pendingActionId: null` (field added to `MapTile` for future construction queue).
- `startNewGame` updated to call `generateEarthTilesForBloc(playerBlocDefId)`.

### Tests

- `src/engine/blocMaps.test.ts` — 29 tests: layout validity (tile count, no duplicates, origin tile type, valid tile types) for all 7 blocs.

---

## 2. HQ Facility ✅ DONE

### What was implemented

- New `hq` entry in `src/data/facilities.ts`: `canDelete: false`, `buildTime: 0`, `buildCost: {}`, `upkeepCost: {}`. Not buildable by the player.
- `FacilityDef` type extended with `buildTime: number`, `deleteTime: number`, `canDelete: boolean`. All existing facility defs updated with appropriate values.
- `computeHqBonus(willProfile)` in `src/engine/facilities.ts` returns per-turn resource and field deltas:
  - **Democratic**: +2 Funding, +1 Will, +1 Computing, +1 SocialScience
  - **Authoritarian**: +2 Funding, +1 Will, +2 Materials
- HQ bonus wired into `executeWorldPhase` in `turn.ts` — applied after facility output, before board multipliers.
- At game start, a `FacilityInstance` (`id: 'hq-0,0'`, `defId: 'hq'`) is placed on the (0,0) tile in `startNewGame`.
- HQ excluded from `FacilityPicker` eligible list (filtered by `def.id !== 'hq'`) so player cannot build a second one. `buildFacility` store method also guards against it.
- EarthScene renders HQ distinctly: gold/amber fill circle, outer ring, and a small crosshair mark in the centre.
- Facility colour palette updated for all Era 1 facility types.

### Tests

- `src/engine/hq.test.ts` — 14 tests: HQ def properties, `computeHqBonus` by will profile, `generateEarthTilesForBloc` correctness.

---

## 3. Hex Hover Tooltip ✅ DONE

### What was implemented

- `EarthSceneCallbacks` extended with `onTileHover(coordKey: string | null)`.
- `EarthScene` emits hover changes on `pointermove` whenever `hoveredKey` changes.
- `gameStore` gains `hoveredTileKey` reactive state and `setHoveredTile()` setter.
- `MapContainer.svelte` wires the callback; tracks `mouseX`/`mouseY` via `onmousemove`; clears hover on `onmouseleave`.
- New `TileTooltip.svelte` renders when `hoveredTileKey` is non-null and no tile is selected:
  - Shows tile type label.
  - If a facility is present: shows facility name, net field output per turn, net resource output per turn (resource output minus upkeep), and productivity warning if below 100%.
  - If empty: shows "Empty — click to build".
  - Positioned at mouse cursor + (16px, 8px) offset, clamped to container bounds.
  - 150ms fade-in animation.
- `getTileSummary` helper added to `src/engine/facilities.ts` (used by tooltip data derivation directly in the component).

### Notes

- Adjacency effects are not currently included in the tooltip output — the tooltip reads directly from `FacilityDef` fields rather than computing full adjacency. This is intentional for now; a full adjacency-aware summary can be added later.
- Tooltip is hidden while FacilityPicker is open.

---

## 4. Facility Deletion ✅ DONE

### What was implemented

- `FacilityPicker.svelte` reworked: when the selected tile has a facility, it shows an "occupied" panel instead of the build list.
  - Occupied panel shows the facility name, description, outputs, and upkeep.
  - If `def.canDelete === true`: shows a red "DEMOLISH" button.
  - If `def.canDelete === false` (HQ): shows "Cannot be demolished" label.
- `onDemolish` prop added to `FacilityPicker`; called from `MapContainer` as `gameStore.demolishFacility(coordKey)`.
- `demolishFacility(coordKey)` store method: validates `canDelete`, removes the `FacilityInstance` from `player.facilities`, clears `tile.facilityId`. Currently instant (multi-turn demolition deferred to §5).
- `FacilityPicker` shows build time ("Build time: N turns" / "Instant") for each facility in the build list.

### Deferred

- Confirmation dialog before demolishing — deferred; demolition is currently one-click.
- Multi-turn demolition with visual feedback — deferred to §5 (construction queue).

---

## 5. Multi-Turn Construction Queue — TODO

### Plan

#### 5.1 New Types

Add to `src/engine/types.ts`:

```ts
export type OngoingActionType = 'construct' | 'demolish';

export interface OngoingAction {
  id: string;
  type: OngoingActionType;
  facilityDefId: string;
  coordKey: string;
  turnsRemaining: number;
  totalTurns: number;
}
```

Add `constructionQueue: OngoingAction[]` to `PlayerState`.

> Note: `pendingActionId: string | null` on `MapTile` is already in place from §1.

#### 5.2 buildFacility Queue Path

Update `gameStore.buildFacility(coordKey, defId)`:
- If `def.buildTime === 0`: create instance immediately (existing behaviour).
- If `def.buildTime > 0`: create `OngoingAction`, push to queue. Deduct cost up-front. Set `tile.pendingActionId = action.id`. Leave `tile.facilityId` null until complete.

#### 5.3 Queue Tick in Turn Engine

Add `tickConstructionQueue` to `src/engine/facilities.ts`, called from `executeWorldPhase`:
- Decrement `turnsRemaining` for each action.
- On completion: if `construct`, create `FacilityInstance` and set `tile.facilityId`; if `demolish`, remove instance and clear `tile.facilityId`. Clear `tile.pendingActionId` in both cases.

#### 5.4 demolishFacility Queue Path

Update `demolishFacility` to enqueue a `'demolish'` `OngoingAction` when `def.deleteTime > 0`, rather than removing instantly. Set `tile.pendingActionId`.

#### 5.5 EarthScene Visuals

When `tile.pendingActionId` is set:
- Construction: scaffold outline (dashed ring) in the facility's eventual colour, animated opacity pulse.
- Demolition: dim the facility circle with a red overlay.
- Arc progress indicator around the tile border, filling clockwise.

#### 5.6 Tests

- `src/engine/constructionQueue.test.ts` — enqueue, tick, complete for construct and demolish; instant build bypasses queue; cost deducted at enqueue.
- Update `turn.test.ts` to cover queue tick in World Phase.

---

## 6. Ongoing Actions Panel — TODO

### Plan

New component `src/lib/components/OngoingActionsPanel.svelte`:

```
┌─ Ongoing Actions ──────────────────────────────────┐
│ [Build] Research Campus         3 turns remaining  │
│         ████████░░░░░░░░  (progress bar)           │
│ [Demo]  Materials Mine          1 turn remaining   │
│         ████████████████                           │
└────────────────────────────────────────────────────┘
```

- Action type badge ("Build" / "Demo"), facility name, turns remaining, progress bar.
- Hidden when queue is empty.
- Mount in sidebar below Standing Actions panel.
- Stretch: Cancel button for construction (refunds 50% of build cost); not available for demolition once started.

---

## 7. Implementation Order (Remaining)

1. **Types** — Add `OngoingAction` to `types.ts`; add `constructionQueue` to `PlayerState`.
2. **buildFacility queue path** — Update store method; set `pendingActionId` on tile.
3. **Queue tick** — `tickConstructionQueue` in `facilities.ts`, wired into `executeWorldPhase`.
4. **demolishFacility queue path** — Convert from instant to queued.
5. **EarthScene visuals** — Scaffold pulse, demolition overlay, progress arc.
6. **OngoingActionsPanel** — New Svelte component + mount point.
7. **Tests** — `constructionQueue.test.ts`, update `turn.test.ts`.

---

## 8. Test Count

| Milestone | Tests |
|-----------|-------|
| Phase 14 complete | 264 |
| Phase 15 sections 1–4 | **307** |
| Phase 15 complete (target) | ~330 |

---

## 9. Files Changed / Created

| File | Status | Notes |
|------|--------|-------|
| `src/engine/types.ts` | ✅ Done | `pendingActionId` on `MapTile`; `buildTime`/`deleteTime`/`canDelete` on `FacilityDef` |
| `src/engine/facilities.ts` | ✅ Done | `computeHqBonus`, `getTileSummary`, `HqBonus`, `TileSummary` |
| `src/engine/turn.ts` | ✅ Done | HQ bonus wired into World Phase |
| `src/data/facilities.ts` | ✅ Done | HQ def; `buildTime`/`deleteTime`/`canDelete` on all defs |
| `src/data/blocMaps.ts` | ✅ Done | **New** — 7 bloc tile layouts |
| `src/lib/stores/game.svelte.ts` | ✅ Done | `generateEarthTilesForBloc`, HQ placement, `demolishFacility`, `hoveredTileKey` |
| `src/phaser/EarthScene.ts` | ✅ Done | `onTileHover` callback; HQ gold visual; full facility colour palette |
| `src/lib/components/FacilityPicker.svelte` | ✅ Done | Occupied panel with demolish; build time display; HQ excluded from build list |
| `src/lib/components/TileTooltip.svelte` | ✅ Done | **New** — hover tooltip |
| `src/lib/components/MapContainer.svelte` | ✅ Done | Tooltip mount, hover wiring, mouse tracking |
| `src/engine/blocMaps.test.ts` | ✅ Done | **New** — 29 layout validity tests |
| `src/engine/hq.test.ts` | ✅ Done | **New** — 14 HQ tests |
| `src/engine/types.ts` | TODO | Add `OngoingAction` type; `constructionQueue` on `PlayerState` |
| `src/engine/facilities.ts` | TODO | `tickConstructionQueue` |
| `src/engine/turn.ts` | TODO | Wire `tickConstructionQueue` |
| `src/lib/stores/game.svelte.ts` | TODO | Queue path for `buildFacility` and `demolishFacility` |
| `src/phaser/EarthScene.ts` | TODO | Construction/demolition visuals, progress arc |
| `src/lib/components/OngoingActionsPanel.svelte` | TODO | **New** — construction queue UI |
| `src/routes/+page.svelte` | TODO | Mount `OngoingActionsPanel` |
| `src/engine/constructionQueue.test.ts` | TODO | **New** |

---

## 10. Out of Scope (Deferred to Future Phases)

- Era 2 / Near Space content (Phase 16)
- Era 3 / Asteroid Belt content (Phase 17)
- Tech tree visualisation panel (FUTURE_PHASES.md)
- Game art / building icons on hex tiles (FUTURE_PHASES.md)
- Collapsible panels (FUTURE_PHASES.md)
- Narrative opening sequence (FUTURE_PHASES.md)
- Standing action multi-turn tracking beyond facility construction (FUTURE_PHASES.md)
- Demolish confirmation dialog
- Cancel-demolition mechanic
