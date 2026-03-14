# Phase 23 — Earth Map: Live Map & Climate Systems

## Context
Four concrete Earth map improvements from FUTURE_PHASES.md. The items left after Phase 22 split into two groups: UI/UX (panning) and engine systems (tile-targeted events with facility destruction, facility pollution, climate-driven tile degradation). Two items — urban tile expansion and multi-facility hexes — remain deferred as they require larger design work.

---

## 23.1 — Map Panning / Scrolling

**File:** `src/phaser/EarthScene.ts` only.

Add camera offset state. Render all tiles relative to `(cx + camOffsetX, cy + camOffsetY)` instead of bare `(cx, cy)`.

### Changes

Add to class:
```ts
private camOffsetX = 0;
private camOffsetY = 0;
private dragOriginX = 0;
private dragOriginY = 0;
private isDragging = false;
private dragMoved = false;
private readonly DRAG_THRESHOLD = 5; // px
```

In `create()`, replace/extend pointer input:
```ts
this.input.on('pointerdown', (ptr) => {
  this.dragOriginX = ptr.x - this.camOffsetX;
  this.dragOriginY = ptr.y - this.camOffsetY;
  this.isDragging = true;
  this.dragMoved = false;
});
this.input.on('pointermove', (ptr) => {
  if (!this.isDragging) return;
  const dx = ptr.x - this.dragOriginX - this.camOffsetX;
  const dy = ptr.y - this.dragOriginY - this.camOffsetY;
  if (!this.dragMoved && Math.hypot(dx, dy) > this.DRAG_THRESHOLD) this.dragMoved = true;
  if (this.dragMoved) {
    this.camOffsetX = ptr.x - this.dragOriginX;
    this.camOffsetY = ptr.y - this.dragOriginY;
    this.clampCamera();
  }
});
this.input.on('pointerup', (ptr) => {
  if (!this.dragMoved) {
    // treat as click
    const key = this.hitTest(ptr.x, ptr.y);
    if (key && this.cb) this.cb.onTileClick(key);
  }
  this.isDragging = false;
});
```

Remove the existing `pointerdown` click handler (it was separate — merge into `pointerup` with `!dragMoved` guard).

`clampCamera()` — compute bounds from tile extents:
```ts
private clampCamera(): void {
  const tiles = this.cb?.getTiles() ?? [];
  if (tiles.length === 0) return;
  const qs = tiles.map(t => t.coord.q);
  const rs = tiles.map(t => t.coord.r);
  // world coords of extreme tiles (before offset)
  const margin = HEX_SIZE * 1.5;
  const minX = Math.min(...qs.map(q => HEX_SIZE * 1.5 * q)) - margin;
  const maxX = Math.max(...qs.map(q => HEX_SIZE * 1.5 * q)) + margin;
  const minY = Math.min(...rs.map((r, i) => HEX_SIZE * (Math.sqrt(3)/2 * qs[i] + Math.sqrt(3) * r))) - margin;
  const maxY = Math.max(...rs.map((r, i) => HEX_SIZE * (Math.sqrt(3)/2 * qs[i] + Math.sqrt(3) * r))) + margin;
  // The viewport centre is the "natural" (0,0) of the map; offset must keep map visible
  const hw = this.scale.width / 2;
  const hh = this.scale.height / 2;
  this.camOffsetX = Math.min(hw - minX, Math.max(-hw - maxX, this.camOffsetX));  // rough clamp
  this.camOffsetY = Math.min(hh - minY, Math.max(-hh - maxY, this.camOffsetY));
}
```

`hexCenter()` — add offsets:
```ts
return {
  x: cx + this.camOffsetX + HEX_SIZE * (1.5 * q),
  y: cy + this.camOffsetY + HEX_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
};
```

`hitTest()` — subtract offsets before inverse:
```ts
const cx = px - this.scale.width / 2 - this.camOffsetX;
const cy = py - this.scale.height / 2 - this.camOffsetY;
```

---

## 23.2 — Tile-Targeted Events with Facility Destruction

Currently `applyEventEffect` has a `// deferred` comment for `destroyTile`. The `coastalFlooding` event hardcodes coordKey `'2,-1'`.

### Engine: `src/engine/types.ts`

Add to `EventEffect`:
```ts
/**
 * When set, dynamically pick a random eligible tile of this type
 * (non-destroyed, not the HQ tile). Replaces a hardcoded coordKey.
 */
tileTypeTarget?: TileType;
```

### Engine: `src/engine/events.ts`

`applyEventEffect` needs:
- A seeded RNG parameter (add `rng: () => number` to signature — follow the pattern from `turn.ts`)
- Implementation of `destroyTile` + `tileTypeTarget`:

```ts
if (effect.destroyTile || effect.tileTypeTarget) {
  const status = effect.destroyTile?.status ?? 'flooded'; // default
  let targetKey: string | undefined = effect.destroyTile?.coordKey;

  if (effect.tileTypeTarget) {
    const eligible = mapTiles.filter(
      t => t.type === effect.tileTypeTarget && t.destroyedStatus === null && t.facilityId !== 'hq-instance-id'
    );
    // exclude HQ tile
    const nonHq = eligible.filter(t => {
      const f = player.facilities.find(f => f.id === t.facilityId);
      return !f || f.defId !== 'hq';
    });
    if (nonHq.length > 0) {
      const chosen = nonHq[Math.floor(rng() * nonHq.length)];
      targetKey = `${chosen.coord.q},${chosen.coord.r}`;
    }
  }

  if (targetKey) {
    updatedMapTiles = updatedMapTiles.map(t =>
      `${t.coord.q},${t.coord.r}` === targetKey
        ? { ...t, destroyedStatus: status }
        : t
    );
    // Remove any facility on the destroyed tile
    const destroyedTile = updatedMapTiles.find(t => `${t.coord.q},${t.coord.r}` === targetKey);
    if (destroyedTile?.facilityId) {
      updatedPlayer = {
        ...updatedPlayer,
        facilities: updatedPlayer.facilities.filter(f => f.id !== destroyedTile.facilityId),
      };
      updatedMapTiles = updatedMapTiles.map(t =>
        t.facilityId === destroyedTile.facilityId ? { ...t, facilityId: null } : t
      );
    }
  }
}
```

The function signature becomes:
```ts
export function applyEventEffect(
  effect: EventEffect,
  player: PlayerState,
  mapTiles: MapTile[],
  currentTurn: number,
  rng: () => number,
): EventEffectResult
```

Update `turn.ts` call site to pass the turn's RNG.

`EventEffectResult` needs `mapTiles` in the return (currently it's in the type but only the original is returned). Fix: return `updatedMapTiles`.

### Data: `src/data/events.ts`

Update `coastalFlooding`:
```ts
negativeEffect: {
  tileTypeTarget: 'coastal',
  destroyTile: { coordKey: '', status: 'flooded' }, // coordKey ignored when tileTypeTarget set
}
```

Or cleaner — change `destroyTile` to optional and just use `tileTypeTarget`:
```ts
negativeEffect: {
  tileTypeTarget: 'coastal',
  destroyTileStatus: 'flooded', // new simpler field alongside tileTypeTarget
}
```

Actually keep it simple: extend `EventEffect` with:
```ts
/** Used with tileTypeTarget — the destroyed status to apply. Defaults to 'flooded'. */
destroyTileStatus?: TileDestroyedStatus;
```

And remove the `destroyTile: { coordKey: ... }` field from coastalFlooding.

Add two new events:
- `drought` — tags: `['climate', 'crisis']`, tileTypeTarget: `'forested'` or `'agricultural'`, status: `'dustbowl'`, noCounter, era: earth
- `industrialContamination` — tags: `['crisis', 'industrial']`, tileTypeTarget: `'industrial'`, status: `'irradiated'`, partialMitigation, era: earth

---

## 23.3 — Facility Climate Impact (Pollution & Healing)

### Engine: `src/engine/types.ts`

Add to `FacilityDef`:
```ts
/**
 * Net climate pressure change per World Phase, contributed by this facility.
 * Positive = pollution (raises pressure); negative = mitigation (lowers pressure).
 * Omit or 0 for climate-neutral facilities.
 */
climateImpact?: number;
```

### Data: `src/data/facilities.ts`

Add `climateImpact` to relevant facilities:

| Facility | climateImpact | Rationale |
|----------|--------------|-----------|
| mine | +0.4 | Extractive, heavy industry |
| engineeringWorks | +0.3 | Manufacturing emissions |
| solarFarm | -0.3 | Displaces fossil generation |
| offshoreWindFarm | -0.3 | Clean energy |
| bioResearchCentre | -0.1 | Carbon sequestration research |
| agriculturalResearchStation | +0.1 | Fertilisers, land use |
| computingHub | +0.1 | Power consumption |

### Engine: `src/engine/turn.ts` — Step 11

Replace the fixed `CLIMATE_PRESSURE_PER_TURN`:
```ts
// Sum climate contributions from active facilities
const facilityClimateImpact = state.player.facilities.reduce((sum, inst) => {
  const def = facilityDefs.get(inst.defId);
  return sum + (def?.climateImpact ?? 0);
}, 0);

const newClimatePressure = Math.min(
  100,
  Math.max(0, state.climatePressure + CLIMATE_PRESSURE_PER_TURN + facilityClimateImpact)
);
```

`CLIMATE_PRESSURE_PER_TURN` stays as the baseline industrial-era floor. The net per-facility impact is additive. Early game (few facilities) pressure rises slowly; mid-game with many polluting facilities it rises much faster; clean-energy blocs can partially offset it.

`executeWorldPhase` already receives `facilityDefs` as a parameter — confirm this or add it.

---

## 23.4 — Climate-Driven Tile Degradation

High climate pressure probabilistically degrades tiles each World Phase.

### Engine: `src/engine/turn.ts`

Add a new step after the climate pressure update (new Step 12, push wormhole check to 13):

```ts
// Step 12 — climate tile degradation
// At high climate pressure, randomly degrade one tile per turn
const degradedTiles = applyClimateDegradation(
  updatedTiles,
  newClimatePressure,
  updatedPlayer.facilities,
  rng,
);
if (degradedTiles.changed) {
  updatedTiles = degradedTiles.tiles;
  updatedPlayer = {
    ...updatedPlayer,
    facilities: degradedTiles.facilities,
  };
  // Add news item describing the degradation
  updatedPlayer = addNewsItem(updatedPlayer, {
    turn: state.turn,
    text: degradedTiles.newsText,
    category: 'climate',
  });
}
```

### New function: `src/engine/climate.ts` (new file)

```ts
export function applyClimateDegradation(
  tiles: MapTile[],
  climatePressure: number,
  facilities: FacilityInstance[],
  rng: () => number,
): { changed: boolean; tiles: MapTile[]; facilities: FacilityInstance[]; newsText: string }
```

**Degradation rules (probabilistic):**
- Climate 40–60: forested → `dustbowl`, probability 3% per turn
- Climate 60–80: forested → `dustbowl` at 6%; agricultural → `dustbowl` at 3%
- Climate >80: all of above + coastal → `flooded` at 4%; agricultural → `dustbowl` at 6%

When a tile degrades:
1. Set `tile.destroyedStatus` to the appropriate status
2. If the tile has a facility whose `allowedTileTypes` does NOT include the new effective tile type, remove that facility from `player.facilities` and clear `tile.facilityId`
3. Return news text: `"A [type] tile has been lost to [drought / flooding]"`

**HQ tile is never destroyed by climate degradation.**

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/phaser/EarthScene.ts` | Pan/scroll: camera offset, drag detection, clamp |
| `src/engine/types.ts` | Add `tileTypeTarget`, `destroyTileStatus` to `EventEffect`; `climateImpact` to `FacilityDef` |
| `src/engine/events.ts` | Implement `destroyTile` + `tileTypeTarget` in `applyEventEffect`; add `rng` param |
| `src/engine/turn.ts` | Pass RNG to `applyEventEffect`; add facility climate impact to pressure calc; call `applyClimateDegradation` |
| `src/data/events.ts` | Update `coastalFlooding`; add `drought` and `industrialContamination` events |
| `src/data/facilities.ts` | Add `climateImpact` to 7 facility defs |
| `src/engine/climate.ts` | **New** — `applyClimateDegradation` function |

---

## Deferred (not Phase 23)

- **Urban tile expansion** — needs a design decision: is it a facility (Urban Planning Centre), a card, a project, or a tech unlock? Deferred until content pass.
- **Map churn / too easy to fill up** — the tile destruction mechanics above (23.2, 23.4) provide natural churn. Evaluate after implementing; may not need a separate mechanic.
- **Multi-facility hexes** — major architecture change (rendering, data model, build logic). Separate phase if pursued.

---

## Test Plan

1. `npx vitest run` — all existing tests pass
2. New unit tests for `applyEventEffect` with `tileTypeTarget` — verify tile destroyed, facility removed, HQ immune
3. New unit tests for `applyClimateDegradation` — verify probability thresholds, facility removal on incompatible tile
4. New unit tests for climate impact — verify facility `climateImpact` sums correctly in World Phase
5. Manual: start game, drag map — confirm pan is bounded and click still selects tiles
6. Manual: advance turns with mines on map, verify `climatePressure` rises faster than baseline
7. Manual: wait for `coastalFlooding` event, confirm a random coastal tile is destroyed (not always '2,-1')
