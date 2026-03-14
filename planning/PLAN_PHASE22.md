# Phase 22 — Earth Map UI Polish

## Goal
Four small quality-of-life improvements to the Earth map UI, all sourced from FUTURE_PHASES.md.

## Changes

### 1. Bloc name in HUD ✅
- Added `blocName: string` prop to `HUD.svelte`
- Rendered after the era badge in the left section, styled in muted blue (`#6a8aaa`)
- `+page.svelte` passes `BLOC_DEFS.get(gs.player.blocDefId)?.name ?? ''`

### 2. Adjacency indicators on hex tiles ✅
- Added `getAdjacencyMap: () => Map<string, 'bonus' | 'penalty' | 'mixed'>` to `EarthSceneCallbacks`
- `MapContainer.svelte` derives the map using `computeAdjacencyEffects` (already imported from engine)
- `EarthScene.ts` renders a small triangle near the bottom of each tile:
  - Gold ▲ upward triangle for net bonus
  - Red ▼ downward triangle for net penalty
  - Both side-by-side for mixed
- Indicators only appear when adjacency effects are actually active (not merely defined)

### 3. Thematic loading overlay ✅
- `MapContainer.svelte`: `mapReady` state, set to `true` in the Phaser `game.events.once('ready', ...)` handler
- Overlay div shown while `!mapReady`, displaying `SYNCHRONISING GLOBAL UPLINK_` with blinking cursor
- Dark background matching the canvas colour (`#060a10`), monospace muted blue text

### 4. Facility overview panel ✅
- New component: `src/lib/components/FacilityOverview.svelte`
- Triggered by `≡ FACILITIES` button in the map tab bar (right-aligned, Earth tab only)
- Shows all player facilities grouped by type, alphabetically sorted
- Per-entry: tile type label, condition status (GOOD/FAIR/POOR/CRITICAL) if degraded
- Click-outside (overlay backdrop) or close button dismisses it

## Files Modified
- `src/lib/components/HUD.svelte` — blocName prop + display
- `src/routes/+page.svelte` — BLOC_DEFS import, blocName passed to HUD
- `src/lib/components/MapContainer.svelte` — adjacencyMap derived, loading overlay, facility overview wiring
- `src/phaser/EarthScene.ts` — getAdjacencyMap callback, triangle indicators in drawTile

## Files Created
- `src/lib/components/FacilityOverview.svelte`
- `planning/PLAN_PHASE22.md`

## Tests
All 369 tests pass. No new type errors introduced.
