# Phase 35 — Climate Management

## Context

The climate system has several known gaps that this phase addresses:

1. `industrialContamination` fires any time, creating irradiated tiles without nuclear context
2. The Space Launch Centre (SLC) can be destroyed by climate degradation, making the game unwinnable
3. Climate events don't scale in severity as pressure rises
4. "Clean Industrial Site" tile action has no completion news/feedback
5. The `computeClimateBreakdown()` data (biggest polluters) is only shown in a hover tooltip — low discoverability

Items deferred: events targeting specific map tiles, coastal flooding recession in Era 3, terrain restoration gated by climate %, Era 1 loss balance.
 
---

## Change diagram

```
35.1 Gate industrialContamination
  events.json  ─── add pushFactors: ["geopoliticalTension"] ──► events.ts (no change needed)
 
35.2 Protect SLC from climate degradation
  types.ts     ─── add climateImmune?: boolean to FacilityDef
  facilities.json ─ add "climateImmune": true to spaceLaunchCentre
  climate.ts   ─── generalize HQ check → skip facilities where def.climateImmune
 
35.3 Escalated climate events
  events.json  ─── add coastalFloodingMajor (minClimate: 60) + heatwave (minClimate: 50)
 
35.4 Clean Industrial Site news
  turn.ts      ─── after tickConstructionQueue, generate news for completedActions
                    where tileActionDefId has clearsDestroyedStatus: true
 
35.5 Biggest polluters panel
  HUD.svelte   ─── add click-to-toggle detail panel below climate bar
```
 
---

## 35.1 — Gate `industrialContamination` to geopolitical push factor

**Problem:** Irradiation implies nuclear/industrial contamination, yet the event fires on any push factor.

**Fix:** Restrict to `geopoliticalTension` via the existing `pushFactors` field on `EventDef`. No engine changes needed — `getEligibleEvents()` in `events.ts:46` already filters on `pushFactors`.

**Current state:** `"pushFactors": null` — fires on any push factor.

**File:** `src/data/events.json` line 143

Change:
```json
"pushFactors": null,
```
→
```json
"pushFactors": ["geopoliticalTension"],
```
 
---

## 35.2 — Protect SLC from climate degradation

**Problem:** `applyClimateDegradation()` in `climate.ts:55–59` excludes only `defId === 'hq'` from candidate tiles. If the SLC is on a forested/agricultural tile that degrades, it is destroyed.

The SLC `allowedTileTypes` in `facilities.json:518` is `["arid", "agricultural"]` — so `agricultural` tiles can degrade to dustbowl (climate.ts rules at pressure > 70). This is a real risk.

**Fix:** Add `climateImmune?: boolean` to `FacilityDef` and check it in `applyClimateDegradation`.

**Files and changes:**

### `src/engine/types.ts` — `FacilityDef` interface (around line 228)
Add after `climateImpact?: number;`:
```ts
/**
 * If true, this facility is immune to climate degradation events.
 * The tile it occupies is excluded from the degradation candidate pool.
 */
climateImmune?: boolean;
```

### `src/data/facilities.json` — `spaceLaunchCentre` (around line 533)
Add after `"climateImpact": 0.2,`:
```json
"climateImmune": true,
```

### `src/engine/climate.ts` — `applyClimateDegradation` (lines 55–59)
The candidate filter currently excludes HQ tiles. Extend it to also exclude tiles hosting any `climateImmune` facility:

Current:
```ts
const candidates = updatedTiles.filter((t) => {
  if (t.type !== rule.tileType) return false;
  if (t.destroyedStatus !== null) return false;
  if (t.facilitySlots.some((id) => id && updatedFacilities.find((f) => f.id === id)?.defId === 'hq')) return false;
  return true;
});
```

Replace with:
```ts
const candidates = updatedTiles.filter((t) => {
  if (t.type !== rule.tileType) return false;
  if (t.destroyedStatus !== null) return false;
  if (t.facilitySlots.some((id) => {
    if (!id) return false;
    const f = updatedFacilities.find((fac) => fac.id === id);
    if (!f) return false;
    const def = facilityDefs.get(f.defId);
    return f.defId === 'hq' || def?.climateImmune === true;
  })) return false;
  return true;
});
```

Note: `facilityDefs` is already a parameter of `applyClimateDegradation` (line 41), so no signature change needed.
 
---

## 35.3 — Escalated climate events

**Problem:** Events have fixed severity regardless of climate pressure. The existing `minClimate` field is already used (e.g. `coastalFlooding` has `minClimate: 25`). The simplest fix is adding harsher event variants with higher thresholds — no engine changes.

**Files:** `src/data/events.json` — add two new event entries to the JSON object.

### New event: `coastalFloodingMajor`
- Escalation of `coastalFlooding`
- `minClimate: 60`, `pushFactors: ["climateChange"]`
- Destroys a coastal tile AND has a larger resource hit
- `responseTier: "noCounter"` (same as `coastalFlooding` — these are unmitigable)

```json
"coastalFloodingMajor": {
  "id": "coastalFloodingMajor",
  "name": "Major Coastal Inundation",
  "description": "Accelerating sea level rise overwhelms coastal defences across multiple regions.",
  "flavourText": "There are no more warnings. There is only water.",
  "tags": ["climate", "crisis"],
  "eras": ["earth"],
  "pushFactors": ["climateChange"],
  "blocIds": null,
  "countdownTurns": 2,
  "weight": 0.4,
  "minClimate": 60,
  "responseTier": "noCounter",
  "negativeEffect": {
    "resources": { "funding": -25, "materials": -20, "politicalWill": -10 },
    "tileTypeTarget": "coastal",
    "destroyTileStatus": "flooded"
  },
  "positiveEffect": null
}
```

### New event: `heatwave`
- New event type
- `minClimate: 50`, `pushFactors: ["climateChange"]`
- Political Will drain + agricultural tile destruction
- `responseTier: "partialMitigation"` (costs Funding to mitigate)

```json
"heatwave": {
  "id": "heatwave",
  "name": "Extreme Heatwave",
  "description": "Sustained extreme temperatures collapse agricultural output and trigger political unrest.",
  "flavourText": "The thermometers ran out of range. The cameras did not.",
  "tags": ["climate", "crisis"],
  "eras": ["earth"],
  "pushFactors": ["climateChange"],
  "blocIds": null,
  "countdownTurns": 2,
  "weight": 0.5,
  "minClimate": 50,
  "responseTier": "partialMitigation",
  "negativeEffect": {
    "resources": { "politicalWill": -20, "materials": -10 },
    "tileTypeTarget": "agricultural",
    "destroyTileStatus": "dustbowl"
  },
  "positiveEffect": null,
  "mitigationCost": { "funding": 20 }
}
```
 
---

## 35.4 — "Clean Industrial Site" completion news

**Problem:** When a tile action with `clearsDestroyedStatus: true` completes, there is no news item. `tickConstructionQueue` returns `completedActions`, but `turn.ts` only processes the `completedActions` array for space facility supply notifications (around lines 308–328). Tile action completions are silently processed.

**File:** `src/engine/turn.ts`

**Fix:** After the construction queue block (around line 328), add news items for completed tile actions that clear destroyed status. The `tileActionDefs` map is already passed to `tickConstructionQueue` and is available in the turn scope.

Locate the block that processes `completedActions` (after the `unsuppliedOnCompletionNews` block). After it, add:

```ts
const tileActionCompletionNews: NewsItem[] = [];
for (const action of completedActions) {
  if (action.type !== 'tileAction' || !action.tileActionDefId) continue;
  const taDef = tileActionDefs.get(action.tileActionDefId);
  if (!taDef?.clearsDestroyedStatus) continue;
  tileActionCompletionNews.push({
    id: `tileaction-complete-${action.id}-t${nextTurn}`,
    turn: nextTurn,
    text: `${taDef.name} complete — tile restored to productive use.`,
    category: 'climate',
  });
}
```

Then include `tileActionCompletionNews` in the final `newsFeed` spread (search for the existing `[...degradationNews` in turn.ts and add it there).
 
---

## 35.5 — Biggest polluters detail panel in HUD

**Problem:** `computeClimateBreakdown()` data is only shown in a hover tooltip. It's hard to read and not discoverable.

**Fix:** Add a click-to-toggle detail panel that expands below the climate bar. The `climateBreakdown` prop is already passed to `HUD.svelte` (line 19).

**File:** `src/lib/components/HUD.svelte`

**Script changes:**
Add a `$state` toggle:
```ts
let climateDetailOpen = $state(false);
```

**Template changes — climate-group div** (around line 256–268):
Replace the `<Tooltip>` + inner `climate-group` with a button version that both shows the tooltip on hover and toggles the panel on click:

```svelte
<div class="climate-group">
  <Tooltip text={climateTooltip(climateBreakdown)} direction="below">
    <button
      class="climate-toggle"
      onclick={() => { climateDetailOpen = !climateDetailOpen; }}
      aria-expanded={climateDetailOpen}
      aria-label="Toggle climate breakdown"
    >
      <span class="label">CLIMATE</span>
      <div class="bar-track climate-track">
        <div
          class="bar-fill"
          style="width: {climatePressure}%; background: {climateColor(climatePressure)}"
        ></div>
      </div>
      <span class="value" style="color: {climateColor(climatePressure)}"
        >{climatePressure.toFixed(0)}%</span
      >
    </button>
  </Tooltip>
  {#if climateDetailOpen}
    <div class="climate-detail" role="region" aria-label="Climate breakdown">
      <div class="climate-detail-row">
        <span class="climate-detail-label">Base rate</span>
        <span class="climate-detail-value">+{climateBreakdown.base.toFixed(2)}/turn</span>
      </div>
      {#each climateBreakdown.entries as entry}
        <div class="climate-detail-row">
          <span class="climate-detail-label">{entry.label}</span>
          <span
            class="climate-detail-value"
            style="color: {entry.amount > 0 ? '#c87050' : '#4a9b7a'}"
          >{entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(2)}/turn</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

**Style additions:**
```css
.climate-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  color: inherit;
}
 
.climate-detail {
  position: absolute;
  top: 100%;
  left: 0;
  background: #0a1018;
  border: 1px solid #2a3a50;
  padding: 0.4rem 0.6rem;
  min-width: 14rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}
 
.climate-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}
 
.climate-detail-label {
  color: #6a7888;
}
 
.climate-detail-value {
  color: #c8d0d8;
  font-variant-numeric: tabular-nums;
}
```

The `climate-group` div needs `position: relative` added so the `climate-detail` dropdown anchors correctly.
 
---

## Files modified

| File | Change |
|---|---|
| `src/data/events.json` | Restrict `industrialContamination` to geopolitical push factor; add `coastalFloodingMajor` and `heatwave` events |
| `src/engine/types.ts` | Add `climateImmune?: boolean` to `FacilityDef` |
| `src/data/facilities.json` | Add `"climateImmune": true` to `spaceLaunchCentre` |
| `src/engine/climate.ts` | Extend HQ exclusion to also exclude `climateImmune` facilities |
| `src/engine/turn.ts` | Add tile action completion news for `clearsDestroyedStatus` actions |
| `src/lib/components/HUD.svelte` | Add click-to-toggle climate detail panel |

No engine changes needed for 35.1 (pushFactors already filtered) or 35.3 (minClimate already filtered).
 
---

## Verification

1. `npm run test` — all existing tests pass (no logic regressions)
2. `npm run lint` — no type errors (especially `climateImmune` on `FacilityDef`)
3. Manual: start a `climateChange` push factor game — `industrialContamination` should never appear in the event zone
4. Manual: start a `geopoliticalTension` game, build no nuclear plant — `industrialContamination` now appears (push factor gates it; the nuclear-facility gate from the draft was dropped in favour of the simpler push factor approach)
5. Manual: at climate pressure > 70, verify an agricultural SLC tile is excluded from dustbowl degradation candidates
6. Manual: queue "Clean Industrial Site" on an irradiated tile, advance turns — news item appears on completion
7. Manual: click the CLIMATE bar in HUD — detail panel expands with per-facility breakdown; click again to collapse
8. Manual: at climate > 60 with `climateChange`, verify `coastalFloodingMajor` can appear