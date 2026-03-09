# Phase 15 — Bloc Maps, HQ, Construction Queue, Ongoing Actions

## Overview

Phase 15 makes the Earth map feel like a real strategic board rather than a generic procedural grid. It introduces bloc-specific stylised hex layouts, a mandatory HQ facility present from game start, tooltip overlays on hover, facility deletion, multi-turn construction/demolition, and a new Ongoing Actions panel in the UI.

---

## Goals

1. **Bloc-specific hex maps** ✅ — each of the 7 blocs has a predefined tile layout shaped to reflect its real-world geography in abstracted form.
2. **HQ facility** ✅ — always present at game start; provides a trickle of resources differentiated by bloc type.
3. **Hex hover tooltip** ✅ — mousing over any tile shows its type, existing facility, and per-turn resource output.
4. **Facility deletion** ✅ — clicking a tile that has a facility offers a demolish option (instant); HQ cannot be demolished.
5. **Multi-turn construction & demolition** ✅ — facilities take a configurable number of turns to build or demolish; partial state is tracked and rendered.
6. **Ongoing Actions panel** ✅ — a new UI panel lists active construction and demolition tasks with turns remaining.

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

## 5. Multi-Turn Construction Queue ✅ DONE

### What was implemented

- `OngoingAction` type and `OngoingActionType` added to `src/engine/types.ts`.
- `constructionQueue: OngoingAction[]` added to `PlayerState`; initialised to `[]` in `createPlayerState`.
- `buildFacility`: if `def.buildTime === 0` → instant (existing path); if `> 0` → enqueue `OngoingAction`, deduct cost up-front, set `tile.pendingActionId`.
- `demolishFacility`: if `def.deleteTime === 0` → instant; if `> 0` → enqueue `'demolish'` action, set `tile.pendingActionId`.
- `tickConstructionQueue` added to `src/engine/facilities.ts` — pure function, no mutation:
  - Decrements `turnsRemaining` for each action.
  - On completion: `'construct'` → creates `FacilityInstance`, sets `tile.facilityId`; `'demolish'` → removes instance, clears `tile.facilityId`. Both clear `tile.pendingActionId`.
  - Returns `{ updatedQueue, updatedFacilities, updatedTiles, completedActions }`.
- Wired as step 0 of `executeWorldPhase` in `turn.ts` — runs before adjacency and output so newly completed facilities contribute in the same turn. `map.earthTiles` and `constructionQueue` updated in assembled state.
- EarthScene visuals (via `getQueue` callback):
  - **Construction**: pulsing scaffold ring in facility colour + clockwise progress arc.
  - **Demolition**: red filled circle + X cross-hatch + draining arc (remaining proportion).

### Tests

- `src/engine/constructionQueue.test.ts` — 12 tests: decrement, completion, tile updates, multi-action, demolish removal, edge cases.

---

## 6. Ongoing Actions Panel ✅ DONE

### What was implemented

- New `src/lib/components/OngoingActionsPanel.svelte`:
  - Shows BUILD/DEMO colour-coded badge, facility name, progress bar, turns remaining.
  - Only rendered when `queue.length > 0`.
- Mounted in `src/routes/+page.svelte` below `StandingActions` inside a new `.left-actions` column wrapper.
- `FacilityPicker` shows a "Construction/Demolition in progress…" panel (with hint text) when `tile.pendingActionId` is set, instead of the build list or occupied panel.

---

## 7. Phase 15 Complete

All planned sections implemented. Phase 15 is done.

---

## 8. Test Count

| Milestone             | Tests   |
| --------------------- | ------- |
| Phase 14 complete     | 264     |
| Phase 15 sections 1–4 | 307     |
| Phase 15 complete     | **319** |

---

## 9. Files Changed / Created

| File                                            | Status  | Notes                                                                                                                                        |
| ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/types.ts`                           | ✅ Done | `pendingActionId` on `MapTile`; `buildTime`/`deleteTime`/`canDelete` on `FacilityDef`; `OngoingAction`; `constructionQueue` on `PlayerState` |
| `src/engine/facilities.ts`                      | ✅ Done | `computeHqBonus`, `getTileSummary`, `tickConstructionQueue`                                                                                  |
| `src/engine/turn.ts`                            | ✅ Done | HQ bonus + queue tick wired into World Phase                                                                                                 |
| `src/engine/state.ts`                           | ✅ Done | `constructionQueue: []` initialised                                                                                                          |
| `src/data/facilities.ts`                        | ✅ Done | HQ def; `buildTime`/`deleteTime`/`canDelete` on all defs                                                                                     |
| `src/data/blocMaps.ts`                          | ✅ Done | **New** — 7 bloc tile layouts                                                                                                                |
| `src/lib/stores/game.svelte.ts`                 | ✅ Done | `generateEarthTilesForBloc`, HQ placement, `demolishFacility`, `hoveredTileKey`, queue paths                                                 |
| `src/phaser/EarthScene.ts`                      | ✅ Done | `onTileHover`, `getQueue` callbacks; HQ gold visual; facility colour palette; construction/demolition overlays                               |
| `src/lib/components/FacilityPicker.svelte`      | ✅ Done | Occupied panel with demolish; build time display; HQ excluded; pending panel                                                                 |
| `src/lib/components/TileTooltip.svelte`         | ✅ Done | **New** — hover tooltip                                                                                                                      |
| `src/lib/components/OngoingActionsPanel.svelte` | ✅ Done | **New** — construction queue UI                                                                                                              |
| `src/lib/components/MapContainer.svelte`        | ✅ Done | Tooltip + `getQueue` callback mount, hover/mouse tracking, `onDemolish` wiring                                                               |
| `src/routes/+page.svelte`                       | ✅ Done | `OngoingActionsPanel` mounted in `.left-actions` wrapper                                                                                     |
| `src/engine/blocMaps.test.ts`                   | ✅ Done | **New** — 29 layout validity tests                                                                                                           |
| `src/engine/hq.test.ts`                         | ✅ Done | **New** — 14 HQ tests                                                                                                                        |
| `src/engine/constructionQueue.test.ts`          | ✅ Done | **New** — 12 construction queue tests                                                                                                        |

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
