# Phase 15 — Bloc Maps, HQ, Construction Queue, Ongoing Actions

## Overview

Phase 15 makes the Earth map feel like a real strategic board rather than a generic procedural grid. It introduces bloc-specific stylised hex layouts, a mandatory HQ facility present from game start, tooltip overlays on hover, facility deletion, multi-turn construction/demolition, and a new Ongoing Actions panel in the UI.

---

## Goals

1. **Bloc-specific hex maps** — each of the 7 blocs has a predefined tile layout shaped to reflect its real-world geography in abstracted form.
2. **HQ facility** — always present at game start; provides a trickle of resources differentiated by bloc type.
3. **Hex hover tooltip** — mousing over any tile shows its type, existing facility, per-turn resource output, and any adjacency effects.
4. **Facility deletion** — clicking a tile that has a facility offers a demolish option in addition to the current build UI.
5. **Multi-turn construction & demolition** — facilities take a configurable number of turns to build or demolish; partial state is tracked and rendered.
6. **Ongoing Actions panel** — a new UI panel lists active construction and demolition tasks with turns remaining and optional cancel.

---

## Scope Constraints

- No Era 2 or Era 3 content changes in this phase.
- No changes to the research, technology, card, or event systems.
- No new FacilityDefs beyond the HQ.
- No changes to the bloc NPC simulation.

---

## 1. Bloc-Specific Hex Maps

### 1.1 Data Format

Replace the procedural tile generation in `game.svelte.ts` with a static layout per bloc.

Each layout is an array of `{ q: number; r: number; type: TileType }`. The blob defines a region of 20–35 tiles shaped abstractly after the bloc's geography (e.g. North America is wide and irregular; South Asia is a peninsula cluster; EU is dense central core with coastline edges).

Add `src/data/blocMaps.ts`:

```ts
export interface TileLayout {
  q: number;
  r: number;
  type: TileType;
}

export const BLOC_MAPS: Record<string, TileLayout[]> = {
  northAmerica: [...],   // wide irregular, mix of urban/industrial/forested/arid
  eastAsia: [...],       // coastal-heavy east edge, urban core, highland west
  southAmerica: [...],   // forested interior, coastal rim, agricultural south
  africa: [...],         // large, arid centre, agricultural edges, coastal rim
  eu: [...],             // dense, mixed urban/industrial, coastal west
  southAsia: [...],      // peninsular cluster, coastal, agricultural
  middleEast: [...],     // arid-dominated, urban pockets, coastal south
};
```

Design rules per layout:
- Always include exactly one urban tile at axial origin (0, 0). This is where the HQ is placed.
- Layouts should be 24–36 tiles.
- Use tile types to communicate geography: forested = Canada/Siberia/Amazon, arid = Sahara/Arabian Peninsula/Australian interior, coastal = sea-adjacent, highland = Andes/Himalayas/Alps, agricultural = plains/steppes/farmland, industrial = Rust Belt/Ruhr/heavy industry regions.
- No two tiles at the same (q, r).

### 1.2 Initialisation Change

In `initialiseGameState()` (in `game.svelte.ts` or `state.ts`):
- Look up the player's bloc ID to find their layout in `BLOC_MAPS`.
- Convert each `TileLayout` entry into a `MapTile` with `facilityId: null`, `destroyedStatus: null`, `productivity: 1`.
- Remove the existing procedural generation loop.

### 1.3 Phaser Rendering

No Phaser changes needed beyond what already exists — `EarthScene` already renders whatever tile list it receives. Tile colours are already keyed on `TileType`.

---

## 2. HQ Facility

### 2.1 FacilityDef

Add a new entry to `src/data/facilities.ts`:

```ts
{
  id: 'hq',
  name: 'Headquarters',
  description: 'The organisational centre of your programme. Cannot be demolished.',
  era: 'earth',
  allowedTileTypes: ['urban'],
  buildCost: {},             // free — placed automatically
  upkeepCost: {},            // no upkeep
  buildTime: 0,              // instant (placed at init, not via queue)
  deleteTime: 0,
  canDelete: false,
  fieldOutput: {},           // varies by bloc (applied via HQ bonus, see §2.2)
  resourceOutput: {},        // varies by bloc
  adjacencyBonuses: [],
  adjacencyPenalties: [],
  depletes: false,
  requiredTechId: null,
}
```

### 2.2 Bloc-Type HQ Bonuses

The HQ per-turn output is not fixed on the FacilityDef — it is computed dynamically in the resource tick based on the player's `blocType`:

| Bloc type | Funding/turn | Will/turn | Materials/turn | Computing/turn | SocialScience/turn |
|-----------|-------------|-----------|----------------|----------------|--------------------|
| Democratic | +2 | +1 | — | +1 | +1 |
| Authoritarian | +2 | +1 | +2 | — | — |

Implement this in `src/engine/facilities.ts` as a `computeHqBonus(blocType)` function called during the resource accumulation step of `executeWorldPhase`.

### 2.3 Placement at Game Start

In `initialiseGameState()`, after tiles are generated, find the tile at (0, 0) (always urban by layout contract) and:
1. Create a `FacilityInstance` with `defId: 'hq'`, `id: 'hq-0,0'`, `condition: 1`, `builtTurn: 0`.
2. Set `tile.facilityId = 'hq-0,0'`.

### 2.4 Rendering

The HQ tile should render distinctly in the EarthScene:
- Gold/amber fill circle instead of the default facility indicator colour.
- A subtle crown or star glyph drawn with Phaser Graphics (simple pixel art, 3–4 lines of drawLine calls).

---

## 3. Hex Hover Tooltip

### 3.1 Data Flow

`EarthScene` already tracks `hoveredKey` and calls `cb.onTileHover(coordKey | null)` on pointermove (add this callback if not present). `MapContainer.svelte` receives the callback and sets a Svelte store value `hoveredTileKey`.

### 3.2 Tooltip Component

New component: `src/lib/components/TileTooltip.svelte`

Triggered when `hoveredTileKey` is non-null. Positioned near the mouse cursor (tracked via a `pointermove` event listener on the MapContainer div).

Content:
```
[Tile type icon] Highland
──────────────────────────────
Facility: Deep Space Array
  Output: +3 Physics / turn
  Upkeep: -1 Funding / turn
  Adjacency bonus: +1 Physics if adjacent to Research Campus
──────────────────────────────
No destroyed status
Productivity: 87%
```

If no facility: show tile type and "Empty — click to build."

Resource and field values are computed by a `getTileSummary(state, coordKey)` helper in `src/engine/facilities.ts`.

### 3.3 Positioning

- Tooltip renders as an absolutely-positioned div inside the `MapContainer` container div.
- Offset 16px right and 8px down from current mouse position.
- Clamp to container bounds so it never overflows the edge.
- 200ms appear delay (CSS transition) to avoid flicker on rapid mouse movement.

---

## 4. Facility Deletion

### 4.1 UI Changes

`FacilityPicker.svelte` currently shows an "OCCUPIED" disabled button when a tile has a facility. Change this:
- If the facility is the HQ (`defId === 'hq'`): show "HQ — Cannot demolish" (greyed, non-interactive).
- Otherwise: show a red "Demolish" button below the facility summary.
- Confirm dialog before enqueuing: "Demolish [name]? This will take [N] turns and cannot be cancelled once started."

### 4.2 Engine Method

New store action `gameStore.demolishFacility(coordKey: string)`:
1. Find the `FacilityInstance` on the tile.
2. Look up `FacilityDef.deleteTime` (number of turns).
3. If `deleteTime === 0`: remove immediately (update tile and delete instance).
4. Otherwise: push an `OngoingAction` of type `'demolish'` to the construction queue. Mark the tile with `facilityId` still set but add a `demolishing: true` flag to the instance or tile (see §5 for types).

### 4.3 Tile Visual During Demolition

In `EarthScene`, when a tile's facility is in a `'demolishing'` state, render the facility circle with a red cross-hatch overlay (two diagonal lines in red at ~50% opacity). Progress ring (arc) shows completion.

---

## 5. Multi-Turn Construction Queue

### 5.1 New Types

Add to `src/engine/types.ts`:

```ts
export type OngoingActionType = 'construct' | 'demolish';

export interface OngoingAction {
  id: string;                    // unique action id
  type: OngoingActionType;
  facilityDefId: string;
  coordKey: string;              // tile location
  turnsRemaining: number;
  totalTurns: number;            // for progress bar
}
```

Add to `PlayerState`:
```ts
constructionQueue: OngoingAction[];
```

### 5.2 FacilityDef Changes

Add two fields to `FacilityDef`:
```ts
buildTime: number;   // turns to construct (0 = instant)
deleteTime: number;  // turns to demolish (0 = instant, 1–3 for complex facilities)
canDelete: boolean;  // false for HQ
```

Assign sensible values to existing Era 1 facilities:
| Facility | buildTime | deleteTime |
|----------|-----------|-----------|
| Research Campus | 2 | 1 |
| Materials Mine | 1 | 1 |
| Solar Farm | 2 | 1 |
| Deep Space Array | 3 | 2 |
| HQ | 0 (init) | — |

### 5.3 Queue Processing in Turn Engine

In `executeWorldPhase` (at the start of the World step, after other ticks):

```ts
function tickConstructionQueue(state: PlayerState, tiles: MapTile[], instances: Map<string, FacilityInstance>): void {
  for (const action of [...state.constructionQueue]) {
    action.turnsRemaining -= 1;
    if (action.turnsRemaining <= 0) {
      if (action.type === 'construct') {
        // complete: create FacilityInstance, set tile.facilityId
      } else {
        // complete: remove FacilityInstance, clear tile.facilityId
      }
      state.constructionQueue = state.constructionQueue.filter(a => a.id !== action.id);
    }
  }
}
```

Build cost is deducted up-front when the action is enqueued (same as current instant-build behaviour). If the player cannot afford it, the action is rejected before enqueuing.

### 5.4 buildFacility Store Method Change

Update `gameStore.buildFacility(coordKey, defId)`:
- If `def.buildTime === 0`: create instance immediately (existing behaviour).
- If `def.buildTime > 0`: create an `OngoingAction`, push to queue. Deduct cost. Set a `constructing: true` marker on the tile (e.g., `facilityId` = a sentinel like `'__constructing__${defId}'`).

### 5.5 Tile State During Construction

Options for tracking "tile is under construction":
- Reserve `facilityId` with a convention like `'__wip__${actionId}'`.
- Or add `pendingActionId: string | null` to `MapTile`.

**Prefer the second option** — it is cleaner:
```ts
// In MapTile:
pendingActionId: string | null;  // non-null during construction/demolition
```
Tile's `facilityId` remains null during construction and is only set on completion.

During demolition, `facilityId` still points to the instance but `pendingActionId` is also set.

### 5.6 EarthScene Construction Visual

When `tile.pendingActionId` is set:
- Construction: draw a scaffold outline (dashed ring) in the facility's eventual colour. Animated opacity pulse.
- Demolition: dim the facility indicator with a red overlay.
- A thin arc progress indicator drawn around the tile border, filling clockwise as turns tick. Percentage computed from `(totalTurns - turnsRemaining) / totalTurns`.

Data for this is passed via the existing tile callback. Add `constructionProgress` field to the tile rendering data if needed.

---

## 6. Ongoing Actions Panel

### 6.1 Component

New component: `src/lib/components/OngoingActionsPanel.svelte`

Positioned below the Standing Actions panel or as a collapsible section within it.

Layout:
```
┌─ Ongoing Actions ──────────────────────────────────┐
│ [Build] Research Campus         3 turns remaining  │
│         ████████░░░░░░░░  (progress bar)           │
│ [Demo]  Materials Mine          1 turn remaining   │
│         ████████████████                           │
└────────────────────────────────────────────────────┘
```

Displays:
- Action type badge: "Build" (blue) or "Demo" (red).
- Facility name.
- Turns remaining.
- Progress bar.
- (Phase 15 stretch) Cancel button for construction only (not demolition once started). Cancelling a construction refunds 50% of the build cost.

### 6.2 Integration

- Add `ongoingActions` derived value to `gameStore` computed from `constructionQueue`.
- Mount `OngoingActionsPanel` in `+page.svelte` or `MapContainer.svelte` sidebar.
- Panel is hidden (or shows "No active construction") when queue is empty.

---

## 7. Implementation Order

Complete steps in this order to allow incremental testing:

1. **Types** — Add `OngoingAction`, `pendingActionId` to `MapTile`, `buildTime`/`deleteTime`/`canDelete` to `FacilityDef`, `constructionQueue` to `PlayerState`. No logic yet.

2. **BLOC_MAPS data** — Define all 7 bloc tile layouts in `src/data/blocMaps.ts`. Write unit tests asserting each layout has exactly one `(0,0)` urban tile and no duplicate coords.

3. **Initialisation** — Update `initialiseGameState()` to use bloc maps. Place HQ facility on (0,0). Update tests.

4. **HQ resource bonus** — Add `computeHqBonus` to `facilities.ts`. Wire into World Phase resource tick. Write tests.

5. **FacilityDef updates** — Add `buildTime`/`deleteTime`/`canDelete` to all existing defs and update the HQ def.

6. **buildFacility queue path** — Update store method to create `OngoingAction` for non-instant builds. Write tests for queue state.

7. **Queue tick** — Implement `tickConstructionQueue` in turn engine. Write tests asserting facility appears after correct number of turns.

8. **demolishFacility** — Add store action and engine logic. Write tests.

9. **EarthScene visuals** — Construction scaffold pulse, demolition overlay, progress arc.

10. **Hex hover tooltip** — Add `onTileHover` callback, `TileTooltip.svelte`, mouse tracking.

11. **OngoingActionsPanel** — Wire up the new panel component.

12. **FacilityPicker demolish button** — Add to existing component.

---

## 8. Tests

All new engine logic requires Vitest tests:

- `blocMaps.test.ts` — layout validity (no dupes, origin tile exists, tile count in range)
- `hq.test.ts` — HQ placed at init, correct resource bonus by bloc type, HQ not in facility picker
- `constructionQueue.test.ts` — enqueue, tick, complete for both construct and demolish; instant build bypasses queue; cost deducted at enqueue
- Update `turn.test.ts` — queue ticks each World Phase
- Update `facilities.test.ts` — new fields present on all defs

Target: ~260 → ~290 tests after Phase 15.

---

## 9. Files Changed / Created

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `OngoingAction`, `pendingActionId` on `MapTile`, `constructionQueue` on `PlayerState` |
| `src/engine/facilities.ts` | Add `computeHqBonus`, `getTileSummary`, `tickConstructionQueue` |
| `src/engine/turn.ts` | Call `tickConstructionQueue` in World Phase |
| `src/data/facilities.ts` | Add HQ def, add `buildTime`/`deleteTime`/`canDelete` to all defs |
| `src/data/blocMaps.ts` | **New** — bloc tile layouts |
| `src/lib/stores/game.svelte.ts` | Update `initialiseGameState`, `buildFacility`, add `demolishFacility` |
| `src/phaser/EarthScene.ts` | Add `onTileHover` callback, construction/demolition visuals, progress arc |
| `src/lib/components/FacilityPicker.svelte` | Add demolish button, hide build for HQ |
| `src/lib/components/TileTooltip.svelte` | **New** — hover tooltip |
| `src/lib/components/OngoingActionsPanel.svelte` | **New** — construction queue UI |
| `src/lib/components/MapContainer.svelte` | Mount tooltip, wire hover callback |
| `src/routes/+page.svelte` | Mount OngoingActionsPanel |
| `src/engine/tests/blocMaps.test.ts` | **New** |
| `src/engine/tests/hq.test.ts` | **New** |
| `src/engine/tests/constructionQueue.test.ts` | **New** |

---

## 10. Out of Scope (Deferred to Future Phases)

- Era 2 / Near Space content (Phase 16)
- Era 3 / Asteroid Belt content (Phase 17)
- Tech tree visualisation panel (FUTURE_PHASES.md)
- Game art / building icons on hex tiles (FUTURE_PHASES.md)
- Collapsible panels (FUTURE_PHASES.md)
- Narrative opening sequence (FUTURE_PHASES.md)
- Standing action multi-turn tracking beyond facility construction (FUTURE_PHASES.md)
- Cancel-demolition mechanic (can add in a patch)
