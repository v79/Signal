# Phase 24 — Multi-Facility Hex Slots

## Context
The Earth map fills up too quickly and there are never enough urban tiles. Rather than complex tile conversion, we allow up to **3 facility slots per tile**. Large facilities (HQ, Deep Space Array) occupy all 3 slots; mid-size ones (Public University, Engineering Works) occupy 2; everything else takes 1. Players explicitly pick which slot to build or demolish in. Intra-tile adjacency bonuses apply between co-located facilities on the same tile.

---

## Design decisions

| Decision | Choice |
|----------|--------|
| Slot UI | Player picks slot explicitly (3 slot panels shown per tile) |
| Slot cost | HQ: 3, Deep Space Array: 3, Public University: 2, Engineering Works: 2, all others: 1 |
| Tile destruction | One random occupied slot destroyed; tile still marked destroyed; other slot facilities persist but produce nothing |
| Construction queue | One action at a time per tile (existing `pendingActionId` lock) |
| Intra-tile adjacency | Yes — same-tile facilities act as virtual adjacency neighbors |
| Contiguous slots | Multi-slot facilities require contiguous free slots |
| Duplicate facilities | A `defId` already present on a tile cannot be built there again |

---

## Data model changes

### `MapTile` (`src/engine/types.ts`)
```ts
// Remove:
facilityId: string | null;

// Add:
facilitySlots: [string | null, string | null, string | null];
// Multi-slot facilities repeat the same instance ID across all occupied slots.
// e.g. 2-slot facility in slots 1&2: [null, 'univ-3,1-t5', 'univ-3,1-t5']
```

### `FacilityDef` (`src/engine/types.ts`)
```ts
slotCost?: number;  // default 1; 2 or 3 for large facilities
```

### `OngoingAction` (`src/engine/types.ts`)
```ts
slotIndex: number;  // lowest slot index the action occupies
```

---

## Implementation steps

### Step 1 — Types (`src/engine/types.ts`)
Make all three changes above. This creates compile errors everywhere `facilityId` is used — let TypeScript drive the rest.

### Step 2 — Data (`src/data/facilities.ts`)
Add `slotCost` to the four large facilities:
- `hq`: `slotCost: 3`
- `deepSpaceArray`: `slotCost: 3`
- `publicUniversity`: `slotCost: 2`
- `engineeringWorks`: `slotCost: 2`

### Step 3 — Engine: `src/engine/facilities.ts`

**3a. Add local helper `getFacilitiesOnTile(tile, facilities)`**
Returns unique `FacilityInstance[]` for a tile (deduplicates multi-slot repeats by ID).

**3b. `computeAdjacencyEffects`**
- Build `Map<coordKey, FacilityInstance[]>` (multi-facility per tile).
- For each facility on each tile, check both hex neighbors AND same-tile peers (intra-tile adjacency).
- Intra-tile neighbors are `tileFacilities.filter(f => f.id !== currentFacility.id)`.

**3c. `computeFacilityOutput` / `computeResourceBreakdown`**
Change tile-active check from `tile.facilityId !== null` to `tile.facilitySlots.some(s => s !== null)`.

**3d. `tickConstructionQueue`**
- On **construct** complete: read `action.slotIndex` + `def.slotCost`; fill slots `[slotIndex .. slotIndex+slotCost-1]` with the new instance ID.
- On **demolish** complete: find instance ID from `tile.facilitySlots[action.slotIndex]`; clear all slots containing that ID; remove from facilities list.

**3e. Add `findContiguousFreeStart` helper**
```ts
export function findContiguousFreeStart(
  slots: [string|null, string|null, string|null],
  slotCost: number,
): number | null {
  for (let i = 0; i <= 3 - slotCost; i++) {
    if (slots.slice(i, i + slotCost).every(s => s === null)) return i;
  }
  return null;
}
```

### Step 4 — Engine: `src/engine/events.ts`

Tile destruction in `applyEventEffect` / `destroyTileAndFacility`:
1. Collect unique non-HQ `FacilityInstance[]` from `tile.facilitySlots`.
2. Pick **one** at random using `rng`.
3. Clear all slots containing that instance ID.
4. Remove that instance from `player.facilities`.
5. Mark `tile.destroyedStatus`.

HQ-exclusion filter: `t.facilitySlots.some(s => facilities.find(f=>f.id===s)?.defId==='hq')`.

### Step 5 — Engine: `src/engine/climate.ts`

Climate degradation destroys the tile entirely (not just one slot):
- HQ exclusion: slot-based scan.
- On degradation: clear **all** slots; remove all non-HQ facilities from those slots.

### Step 6 — Store: `src/lib/stores/game.svelte.ts`

**Tile generation** (both `generateEarthTilesForBloc` and fallback):
```ts
facilitySlots: [null, null, null],  // replaces facilityId: null
```

**HQ placement** in `startNewGame`:
```ts
facilitySlots: [hqFacilityId, hqFacilityId, hqFacilityId]
```

**`buildFacility(coordKey, defId, slotIndex)`** — add `slotIndex` param:
1. Validate tile exists, not destroyed, no pending action.
2. Reject if `defId` is already present on the tile (`getFacilitiesOnTile` includes it).
3. `slotCost = def.slotCost ?? 1`.
4. `start = findContiguousFreeStart(tile.facilitySlots, slotCost)` — if null, return.
5. Fill slots `[start .. start+slotCost-1]` with instance ID.
6. `OngoingAction.slotIndex = start` for multi-turn builds.

**`demolishFacility(coordKey, slotIndex)`** — add `slotIndex` param:
1. Look up `tile.facilitySlots[slotIndex]` → instance ID.
2. Instant: clear all slots with that ID, remove FacilityInstance.
3. Multi-turn: enqueue demolish action with `slotIndex`.

### Step 7 — Rendering: `src/phaser/EarthScene.ts`

Each tile is divided into **three equal rhombuses** (the isometric-cube look), one per slot. Every rhombus is scaled 80% toward its own centroid so the tile background shows through as gaps between them.

**Rhombus geometry** (flat-top hex, vertices v0–v5 at 60° increments from the right):

| Slot | Rhombus vertices | Centroid (relative to hex centre) |
|------|-----------------|-----------------------------------|
| 0 — upper-right | C, v4, v5, v0 | `(+R×0.25, −R×0.433)` |
| 1 — left        | C, v2, v3, v4 | `(−R×0.50,  0)` |
| 2 — bottom      | C, v0, v1, v2 | `(+R×0.25, +R×0.433)` |

where `R = HEX_SIZE` and `sqrt(3)/2 ≈ 0.433`.

**Shrink helper** — scale each vertex `P` of a rhombus toward its centroid `G` by factor `f = 0.80`:
```ts
function shrinkPoint(p: [number,number], g: [number,number], f = 0.80): [number,number] {
  return [g[0] + f * (p[0] - g[0]), g[1] + f * (p[1] - g[1])];
}
```

Resulting shrunk offsets relative to hex centre (R = HEX_SIZE, h = R × √3/2):

```ts
const SLOT_RHOMBUSES: [[number,number],[number,number],[number,number],[number,number]][] = [
  // slot 0: upper-right  (C, v4, v5, v0 shrunk toward centroid (+R/4, -h/2))
  [[ R*0.05, -h*0.20], [-R*0.35, -h*0.90], [ R*0.45, -h*0.90], [ R*0.85, -h*0.20]],
  // slot 1: left         (C, v2, v3, v4 shrunk toward centroid (-R/2, 0))
  [[-R*0.10,  0      ], [-R*0.50,  h*0.80], [-R*0.90,  0      ], [-R*0.50, -h*0.80]],
  // slot 2: bottom       (C, v0, v1, v2 shrunk toward centroid (+R/4, +h/2))
  [[ R*0.05,  h*0.20 ], [ R*0.85,  h*0.20], [ R*0.45,  h*0.90], [-R*0.35,  h*0.90]],
];
```

**Per-slot rendering in `drawTile`:**
- Collect unique occupied instance IDs from `tile.facilitySlots` (deduplicate).
- For each unique facility, determine which slot indices it occupies (`facilitySlots` entries matching its ID).
- For each slot index 0–2: draw the corresponding shrunk rhombus polygon.
  - Occupied slot: fill with `FACILITY_COLORS[defId]`, opacity 0.9.
  - Empty slot: no fill, faint dashed stroke (`#3a5878`, opacity 0.4) to indicate a free build slot.
- **HQ special case**: after drawing all three gold rhombuses, draw a white cross at the hex centre.
- **Condition indicator**: if `facility.condition < 1`, draw the rhombus fill at reduced opacity (e.g. `0.9 × condition`).

**`EarthSceneCallbacks`**: add `getFacilityDefs: () => Map<string, FacilityDef>` so `drawTile` can read `slotCost`.

### Step 8 — UI: `src/lib/components/FacilityPicker.svelte` (full redesign)

**New/changed props:**
```ts
onBuild: (defId: string, slotIndex: number) => void;
onDemolish: (slotIndex: number) => void;
facilityInstances: FacilityInstance[];  // replaces occupyingInstance
```

**New layout** (when tile is neither destroyed nor pending):

```
[SLOT 0]  Research Lab  [GOOD]  [DEMOLISH]
[SLOT 1]  (empty)               [BUILD...]
[SLOT 2]  (empty)               [BUILD...]
```

- Multi-slot facilities span their slots (e.g. "SLOTS 0–1" label); Demolish button only on the primary (lowest) slot.
- Clicking `BUILD...` sets `activeSlot`, shows facility list filtered by `findContiguousFreeStart(slots, def.slotCost) !== null && allowedTileTypes includes tile.type && defId not already present on tile`.
- Clicking a facility calls `onBuild(defId, findContiguousFreeStart(...))`.
- All slots locked (no button) if `tile.pendingActionId` is set.

### Step 9 — UI: `src/lib/components/TileTooltip.svelte`

Replace single `facility` derivation with:
```ts
const tileInstances = $derived.by<FacilityInstance[]>(() => {
  // dedupe facilitySlots by instance ID
});
```
Show each unique facility name; aggregate scaled field/resource output across all instances.
"Empty — click to build" hint only if `freeSlotCount > 0`.

### Step 10 — UI: `src/lib/components/MapContainer.svelte`

- Update `adjacencyMap` derivation to build `Map<coordKey, FacilityInstance[]>`.
- Wire `getFacilityDefs: () => FACILITY_DEFS` into `EarthSceneCallbacks`.
- Update `onBuild` / `onDemolish` call sites to pass `slotIndex`.

### Step 11 — `src/lib/components/FacilityOverview.svelte`
No structural change — iterates `FacilityInstance[]` which is unchanged.

### Step 12 — Save migration (`src/engine/save.ts` or load path in store)

Old saves have `facilityId: string | null`. Add `migrateSave` in the load path:
```ts
function migrateSave(state: any): GameState {
  for (const tile of state.map?.earthTiles ?? []) {
    if ('facilityId' in tile && !('facilitySlots' in tile)) {
      tile.facilitySlots = tile.facilityId
        ? [tile.facilityId, null, null]
        : [null, null, null];
      delete tile.facilityId;
    }
  }
  for (const action of state.player?.constructionQueue ?? []) {
    if (action.slotIndex === undefined) action.slotIndex = 0;
  }
  return state as GameState;
}
```

### Step 13 — Tests

**`constructionQueue.test.ts`**: `makeTile` → `facilitySlots: [null, null, null]`; `makeAction` → add `slotIndex: 0`; assertions `tile.facilityId` → `tile.facilitySlots[0]`.

**`facilities.test.ts`**: `makeTile(q, r, id?)` → put `id` in slot 0 if provided. Add new intra-tile adjacency test.

**`victory.test.ts`**: Update any inline `MapTile` literals.

---

## Files to modify

| File | Change |
|------|--------|
| `src/engine/types.ts` | `MapTile.facilitySlots`, `FacilityDef.slotCost`, `OngoingAction.slotIndex` |
| `src/data/facilities.ts` | `slotCost` on hq, deepSpaceArray, publicUniversity, engineeringWorks |
| `src/engine/facilities.ts` | `getFacilitiesOnTile` helper, `computeAdjacencyEffects` (intra-tile), `tickConstructionQueue` (slot fill/clear), `findContiguousFreeStart` helper |
| `src/engine/events.ts` | Single-slot destruction logic |
| `src/engine/climate.ts` | All-slot clear on climate tile destruction |
| `src/lib/stores/game.svelte.ts` | Tile generation, HQ placement, `buildFacility`/`demolishFacility` signatures |
| `src/phaser/EarthScene.ts` | Multi-circle rendering, slot position constants, `getFacilityDefs` callback |
| `src/lib/components/MapContainer.svelte` | Adjacency map update, new callback, `onBuild`/`onDemolish` wiring |
| `src/lib/components/FacilityPicker.svelte` | Full 3-slot panel redesign |
| `src/lib/components/TileTooltip.svelte` | Multi-instance aggregation |
| `src/engine/constructionQueue.test.ts` | Fixture updates |
| `src/engine/facilities.test.ts` | Fixture updates + intra-tile adjacency test |
| `src/engine/victory.test.ts` | Inline tile literal updates |
| `src/engine/save.ts` (or store) | `migrateSave` for old saves |

---

## Implementation order
1. `types.ts` — breaks everything, sets the target
2. `data/facilities.ts` — slotCost values
3. `engine/facilities.ts` — helpers, computeAdjacencyEffects, tickConstructionQueue
4. `engine/events.ts` — single-slot destruction
5. `engine/climate.ts` — full-tile slot clear
6. `stores/game.svelte.ts` — tile generation, store actions
7. `phaser/EarthScene.ts` — rendering
8. `components/MapContainer.svelte` — wiring
9. `components/FacilityPicker.svelte` — slot UI
10. `components/TileTooltip.svelte` — multi-facility tooltip
11. Tests + save migration

Run `npx tsc --noEmit` after each step.

---

## Test plan

1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all tests pass (expect ~15 fixture updates + 1 new intra-tile adjacency test)
3. Manual: start game → select a tile → confirm 3 slot panels shown
4. Manual: build a 1-slot facility in slot 1 → confirm slots 0 and 2 still show BUILD...
5. Manual: build a 2-slot facility (Public University) → confirm 2 contiguous slots fill; rendering shows medium centred circle
6. Manual: trigger a coastal flooding event → confirm only one slot's facility is destroyed on the target tile
7. Manual: import an old save → confirm `migrateSave` converts `facilityId` without crashing
8. Manual: co-locate Research Lab + Public University on same tile → confirm intra-tile adjacency bonus applies to output
