# Phase 23 — Earth Map: Live Map & Climate Systems

## Context
Four concrete Earth map improvements from FUTURE_PHASES.md. The items left after Phase 22 split into two groups: UI/UX (panning) and engine systems (tile-targeted events with facility destruction, facility pollution, climate-driven tile degradation). Two items — urban tile expansion and multi-facility hexes — remain deferred as they require larger design work.

---

## 23.1 — Map Panning / Scrolling ✅

Implemented in `src/phaser/EarthScene.ts`. Right-mouse drag pans the map; bounded so the map can't be lost off-screen. Left click still selects tiles. Context menu suppressed on the canvas.

---

## 23.2 — Tile-Targeted Events with Facility Destruction

Currently `applyEventEffect` has a `// deferred` comment for `destroyTile`. The `coastalFlooding` event hardcodes coordKey `'2,-1'`.

### Engine: `src/engine/types.ts`

Add to `EventEffect`:
```ts
/**
 * When set, dynamically pick a random eligible tile of this type
 * (non-destroyed, not the HQ tile) when applying the effect.
 */
tileTypeTarget?: TileType;
/** Status to apply to the targeted tile. Defaults to 'flooded'. */
destroyTileStatus?: TileDestroyedStatus;
```

Remove the existing `destroyTile?: { coordKey: string; status: TileDestroyedStatus }` field, or keep it for backwards compat but prefer the new fields.

### Engine: `src/engine/events.ts`

`applyEventEffect` signature gains a `rng: () => number` parameter (follow the pattern from `turn.ts`).

Implement `tileTypeTarget` + `destroyTileStatus`:
```ts
if (effect.tileTypeTarget) {
  const status = effect.destroyTileStatus ?? 'flooded';
  const eligible = mapTiles.filter(
    t => t.type === effect.tileTypeTarget && t.destroyedStatus === null
  );
  // Exclude HQ tile
  const candidates = eligible.filter(t => {
    const f = player.facilities.find(f => f.id === t.facilityId);
    return !f || f.defId !== 'hq';
  });
  if (candidates.length > 0) {
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    const chosenKey = `${chosen.coord.q},${chosen.coord.r}`;
    // Destroy the tile
    updatedMapTiles = updatedMapTiles.map(t =>
      `${t.coord.q},${t.coord.r}` === chosenKey ? { ...t, destroyedStatus: status } : t
    );
    // Remove any facility on the tile
    if (chosen.facilityId) {
      updatedPlayer = {
        ...updatedPlayer,
        facilities: updatedPlayer.facilities.filter(f => f.id !== chosen.facilityId),
      };
      updatedMapTiles = updatedMapTiles.map(t =>
        t.facilityId === chosen.facilityId ? { ...t, facilityId: null } : t
      );
    }
  }
}
```

Also implement the existing `destroyTile` field (hardcoded coordKey path) for backwards compatibility.

`EventEffectResult` must return `mapTiles` — fix the current stub that returns the original unchanged tiles.

Update call site in `turn.ts` to pass the turn RNG.

### Data: `src/data/events.ts`

Update `coastalFlooding`:
```ts
negativeEffect: {
  tileTypeTarget: 'coastal',
  destroyTileStatus: 'flooded',
}
```

Add two new events:
- `drought` — tags: `['climate', 'crisis']`, tileTypeTarget: `'forested'` or `'agricultural'`, destroyTileStatus: `'dustbowl'`, `noCounter`, era: earth, pushFactor: `climateChange`
- `industrialContamination` — tags: `['crisis', 'industrial']`, tileTypeTarget: `'industrial'`, destroyTileStatus: `'irradiated'`, `partialMitigation`, era: earth

---

## 23.3 — Facility Climate Impact (Pollution & Healing)

### Engine: `src/engine/types.ts`

Add to `FacilityDef`:
```ts
/**
 * Net climate pressure change per World Phase contributed by this facility.
 * Positive = pollution; negative = mitigation. Omit for climate-neutral.
 */
climateImpact?: number;
```

### Data: `src/data/facilities.ts`

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

Replace the fixed `CLIMATE_PRESSURE_PER_TURN` usage:
```ts
const facilityClimateImpact = state.player.facilities.reduce((sum, inst) => {
  const def = facilityDefs.get(inst.defId);
  return sum + (def?.climateImpact ?? 0);
}, 0);

const newClimatePressure = Math.min(
  100,
  Math.max(0, state.climatePressure + CLIMATE_PRESSURE_PER_TURN + facilityClimateImpact)
);
```

`CLIMATE_PRESSURE_PER_TURN` remains as the baseline. `facilityDefs` is already available in `executeWorldPhase`.

---

## 23.4 — Climate-Driven Tile Degradation

### New file: `src/engine/climate.ts`

```ts
export function applyClimateDegradation(
  tiles: MapTile[],
  climatePressure: number,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  rng: () => number,
): { changed: boolean; tiles: MapTile[]; facilities: FacilityInstance[]; newsText: string }
```

**Degradation probability per turn by climate level:**

| Climate | Trigger | Status |
|---------|---------|--------|
| >40 | forested → dustbowl (3%) | dustbowl |
| >60 | forested → dustbowl (6%), agricultural → dustbowl (3%) | dustbowl |
| >80 | all above + coastal → flooded (4%), agricultural → dustbowl (6%) | flooded / dustbowl |

Per degradation:
1. Pick one candidate tile at random from eligible non-destroyed tiles of the target type
2. Skip HQ tile
3. Mark `tile.destroyedStatus`
4. If tile has a facility whose `allowedTileTypes` doesn't include the new effective tile state — remove it from `player.facilities`, clear `tile.facilityId`
5. Return news text: `"A [type] tile has been lost to [drought/flooding]"`

### Engine: `src/engine/turn.ts`

Add as Step 12 (after climate pressure update):
```ts
const degradation = applyClimateDegradation(
  updatedTiles,
  newClimatePressure,
  updatedPlayer.facilities,
  facilityDefs,
  rng,
);
if (degradation.changed) {
  updatedTiles = degradation.tiles;
  updatedPlayer = { ...updatedPlayer, facilities: degradation.facilities };
  updatedPlayer = addNewsItem(updatedPlayer, {
    turn: state.turn, text: degradation.newsText, category: 'climate',
  });
}
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `tileTypeTarget`, `destroyTileStatus` to `EventEffect`; `climateImpact` to `FacilityDef` |
| `src/engine/events.ts` | Implement tile destruction in `applyEventEffect`; add `rng` param; fix `EventEffectResult` |
| `src/engine/turn.ts` | Pass RNG to `applyEventEffect`; add facility climate impact; call `applyClimateDegradation` |
| `src/data/events.ts` | Update `coastalFlooding`; add `drought` and `industrialContamination` |
| `src/data/facilities.ts` | Add `climateImpact` to 7 facility defs |
| `src/engine/climate.ts` | **New** — `applyClimateDegradation` |

---

## Deferred

- **Urban tile expansion** — needs a design decision (facility, card, or tech unlock?)
- **Map churn** — evaluate after 23.2/23.4 provide natural tile destruction churn
- **Multi-facility hexes** — major architecture change, separate phase if pursued

---

## Test Plan

1. `npx vitest run` — all existing tests pass
2. New unit tests for `applyEventEffect` with `tileTypeTarget` — tile destroyed, facility removed, HQ immune
3. New unit tests for `applyClimateDegradation` — probability thresholds, facility removal on incompatible tile
4. New unit tests for climate impact — facility `climateImpact` sums correctly in World Phase
5. Manual: advance turns with mines, verify `climatePressure` rises faster than baseline
6. Manual: wait for `coastalFlooding`, confirm a random coastal tile is destroyed (not always `'2,-1'`)
