# Phase 30 — Era 2 Game Content: Moon Colony, Earth Tile Actions & Pressure (Part 2)

## Goal

Complete the Era 2 content layer introduced in Phase 29. Three parallel threads: (1) the Moon Colony landmark that gates Era 3, (2) a new **tile action system** enabling Earth-side terrain manipulation (urbanisation, habitat restoration, sea walls), and (3) escalating Earth climate pressure events. Also adds the Director of Lunar Operations board role and Era 2 → Era 3 narrative transition.

## Prerequisites

- Phase 29 complete (Launch Capacity, Facility Upgrades, all Phase 29 techs including `carbonCaptureTechnology` and `advancedCoastalEngineering`)
- `lunarRegolithProcessing` tech (Phase 29) gates Moon Colony Stage 2
- `cislunarTransportNetwork` tech (Phase 29) gates Moon Colony Stage 3
- `carbonCaptureTechnology` tech (Phase 29) gates restore/clean tile actions
- `advancedCoastalEngineering` tech (Phase 29) gates sea wall tile action

## Deliverables

- [ ] 30.1 — Moon Colony landmark project (3 stages, era gate)
- [ ] 30.2 — Earth tile action system: `TileActionDef`, engine, UI
- [ ] 30.3 — Tile action definitions: `urbanize`, `restoreHabitat`, `cleanIndustrialSite`, `buildSeaWall`
- [ ] 30.4 — Earth climate escalation events
- [ ] 30.5 — Director of Lunar Operations board role
- [ ] 30.6 — Era 2 → Era 3 narrative transition sequence
- [ ] 30.7 — ISRU supply-cost reduction (Lunar Surface → 0 on Colony Stage 2)
- [ ] 30.8 — Tier 3 facility upgrades (final research-slot upgrades)
- [ ] 30.9 — Tests and balance pass

---

## 30.1 — Moon Colony Landmark Project

Three-stage landmark (mirrors the Orbital Station structure from Phase 26).

Triggered when the player completes the `lunarHabitat` facility. The board (Chief Scientist or Director of Lunar Operations, once appointed) proposes the project via a `boardProposalMoonColony` event, analogous to `boardProposalOrbitalStation`.

Authorization cost: **40 Political Will + 60 Funding**

| Stage | ID | Name | Cost | Build Time | Requires | Completion Effect |
|-------|----|------|------|------------|----------|-------------------|
| 1 | `moonColony_stage1` | Habitat Expansion | 80F · 60M | 3 turns | `advancedLifeSupport` | News item; Political Will +20; opens `lunarResearchBase` upgrade |
| 2 | `moonColony_stage2` | Surface Infrastructure | 60F · 50M | 3 turns | `lunarRegolithProcessing` | Lunar Surface supply costs → 0 (ISRU fully operational); news item |
| 3 | `moonColony_stage3` | Self-Sustaining Colony | 50F · 40M | 4 turns | `cislunarTransportNetwork` | **Era 3 unlocked**; Political Will +40; "Director of Lunar Operations" board seat opens; narrative sequence |

**Competitor pressure:** If the player defers beyond a threshold turn, a `globalSpaceCompetition` event fires with increased weight (rival bloc announces lunar ambitions), draining Will.

**Narrative on Stage 3 completion:**
> *"The lunar colony is self-sustaining. For the first time in human history, a permanent settlement exists beyond Earth. The signal — sharper from the surface, stripped of ionospheric noise — is showing structure. Your analysts have begun to suspect it isn't transmitting to Earth at all."*

---

## 30.2 — Tile Action System

### New type: `TileActionDef` (`src/engine/types.ts` + new `src/data/tileActions.ts`)

```ts
interface TileActionDef {
  id: string;
  name: string;
  description: string;
  requiredTechId: string | null;
  buildCost: Partial<Resources>;
  buildTime: number;                        // turns
  appliesTo: TileType[];                    // tile types this action can target
  appliesToDestroyed?: TileDestroyedStatus; // restrict to damaged tiles only
  transformsTo?: TileType;                  // new tile type on completion
  clearsDestroyedStatus?: boolean;          // removes flooded/dustbowl/irradiated
  seaWallProtection?: boolean;              // flag: immune to future flooding
  climateEffect?: number;                   // one-time climate pressure delta on completion
}
```

`MapTile` gains: `seaWallProtected: boolean` (initialised `false`). Used by the `coastalFlooding` event handler to skip protected tiles.

### Extend `OngoingAction` (`src/engine/types.ts`)

```ts
type OngoingActionType = 'construct' | 'demolish' | 'tileAction';  // add tileAction

interface OngoingAction {
  // ...existing fields...
  tileActionDefId?: string;  // set when type === 'tileAction'
}
```

### Engine: `tickConstructionQueue` (`src/engine/facilities.ts`)

Add a `tileAction` completion branch:
- Look up `TileActionDef` by `tileActionDefId`
- Apply `transformsTo` → update `tile.type`
- Apply `clearsDestroyedStatus` → set `tile.destroyedStatus = null`
- Apply `seaWallProtection` → set `tile.seaWallProtected = true`
- Apply `climateEffect` → update `state.climatePressure`
- Clear `tile.pendingActionId`

### Store action (`src/lib/stores/game.svelte.ts`)

`enqueueTileAction(coordKey: string, tileActionDefId: string)` — validates tech lock, cost, tile compatibility, no pending action; deducts resources; pushes `OngoingAction` with `type: 'tileAction'`.

### UI: `FacilityPicker.svelte`

Add a **"TILE ACTIONS"** section below the facility list. Same affordability/tech-gate/availability filter logic. Each action shows name, build time, cost, and a brief description. Clicking enqueues via `enqueueTileAction`.

---

## 30.3 — Tile Action Definitions (`src/data/tileActions.ts`)

| ID | Name | Applies To | Cost | Time | Requires | Effect |
|----|------|-----------|------|------|---------|--------|
| `urbanize` | Urbanise | forested, agricultural, highland (undamaged only) | 50F · 20W (Political Will) | 1 turn | — (available Era 1 onwards) | Tile → `urban`; climate +0.05 |
| `restoreHabitat` | Restore Habitat | dustbowl, flooded (destroyed tiles) | 40F · 20M | 3 turns | `carbonCaptureTechnology` | Clears destroyed status; tile → `forested`; climate −2 |
| `cleanIndustrialSite` | Clean Industrial Site | irradiated (destroyed tiles) | 30F · 15M | 2 turns | `carbonCaptureTechnology` | Clears `irradiated` status; tile → `industrial` (usable again) |
| `buildSeaWall` | Build Sea Wall | coastal (undamaged) | 50M · 30F | 1 turn | `advancedCoastalEngineering` | Sets `seaWallProtected: true`; no type change |

Notes:
- `urbanize` uses Political Will as cost (in `buildCost.politicalWill`), not Materials — it's a planning/governance action
- `restoreHabitat` and `cleanIndustrialSite` require `carbonCaptureTechnology` (Phase 29 Earth tech track)
- `buildSeaWall` requires `advancedCoastalEngineering` (Phase 29 Earth tech track)
- `coastalFlooding` event handler checks `tile.seaWallProtected` before destroying a tile; protected tiles are skipped
- Climate deltas from `restoreHabitat` are small but meaningful — the primary climate solution is still clean energy facilities

---

## 30.4 — Earth Climate Escalation Events

Two new high-severity Earth events, activated only when climate pressure is severe. These reinforce the resource squeeze and motivate shifting investment to space.

| ID | Tags | Eras | Tier | Effect | Condition |
|----|------|------|------|--------|-----------|
| `megadrought` | climate, crisis | earth, nearSpace | noCounter | Materials −25; destroys 2 random forested/agricultural tiles permanently (dust bowl) | minClimate: 40 |
| `globalEconomicPressure` | climate, crisis | earth, nearSpace | noCounter | Funding −25, Political Will −30 (public demand to prioritise Earth over space) | minClimate: 60 |

These join the existing climate events (`coastalFlooding`, `drought`) which already gate on `minClimate`. Together they create a steady escalation:
- Climate 20+: drought fires
- Climate 25+: coastal flooding fires
- Climate 40+: megadrought fires
- Climate 60+: globalEconomicPressure fires

---

## 30.5 — Director of Lunar Operations (`src/data/board.ts`)

New board member slot, unlocked when Moon Colony Stage 3 completes (alongside era transition). Three seeded candidates generated per run.

```
Role: directorOfLunarOperations
Buff 1: Lunar facility output +20%
Buff 2: Moon Colony project stage costs −10F each
Debuff: Earth-side SocialScience −2 per turn (focus shift)
Flavour: Former mission commander; age 42–58
```

Added to `BOARD_DEFS` in `src/data/board.ts`. Slot becomes available in `GameState.board` alongside era transition news item.

---

## 30.6 — Era 2 → Era 3 Narrative Transition

When Moon Colony Stage 3 completes, the turn orchestrator triggers:
1. `state.era` → `'deepSpace'`
2. Political Will +40
3. News item: colony narrative text
4. New board slot: Director of Lunar Operations
5. Phaser: Asteroid Belt scene becomes interactive (currently rendered but inert)
6. Standing actions panel refreshes to show Era 3 standing actions

Transition sequence (shown as a narrative modal, same pattern as Orbital Station completion):
- Title: *"Humanity's Second Home"*
- Body: colony narrative text (above)
- Subtitle: *"The asteroid belt is now within reach. The signal is waiting."*

---

## 30.7 — ISRU Supply-Cost Reduction

When Moon Colony Stage 2 completes, apply:
```ts
state.launchAllocation = { ...state.launchAllocation }
// All Lunar Surface nodes: supplyCost effectively 0
// Implemented via a GameState flag: state.isruOperational = true
```

Engine change in `facilities.ts`: if `isruOperational === true`, skip supply-cost check for facilities on `lunarSurface` type nodes.

Add `isruOperational: boolean` to `GameState` (initialised `false`).

---

## 30.8 — Tier 3 Facility Upgrades

Two remaining T3 upgrades deferred from Phase 29 (require Moon Colony context to feel motivated):

**Lunar Surface — Habitation T3**

| Tier | ID | Name | Build Cost | Upkeep | Supply | Field Output | Requires |
|------|----|------|------------|--------|--------|--------------|---------|
| T3 | `lunarColonyHub` | Lunar Colony Hub | +70F · 50M | 10F · 5M/turn | 0 | Biochem +10, SocSci +10, Physics +5, Eng +4 | Moon Colony Stage 3 + `cislunarTransportNetwork` |

**LEO / L1 — Power T3**

| Tier | ID | Name | Build Cost | Upkeep | Supply | Resource Output | Field Output | Requires |
|------|----|------|------------|--------|--------|-----------------|--------------|---------|
| T3 | `solarPowerSatellite` | Solar Power Satellite | +50F · 35M | 4F/turn | 0 | Funding +30 | Physics +5 | `cislunarTransportNetwork` |

Both T3 facilities have `supplyCost: 0` — they're self-sustaining at this stage of development.

---

## 30.9 — Tests and Balance Pass

- Unit tests: Moon Colony stage progression, ISRU flag, era gate
- E2E test: reach Era 3 via Moon Colony landmark
- Balance review: launch capacity curve vs. facility supply costs; ensure player is supply-constrained by mid-Era 2 but not frustratingly bottlenecked

---

## Files Modified

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `isruOperational: boolean`, `seaWallProtected: boolean` on `MapTile`; `tileActionDefId?` on `OngoingAction`; extend `OngoingActionType` |
| `src/engine/state.ts` | Initialise `isruOperational: false`; `seaWallProtected: false` on all tiles |
| `src/engine/facilities.ts` | ISRU supply-cost skip for lunar nodes; `tileAction` completion branch in `tickConstructionQueue` |
| `src/engine/turn.ts` | Moon Colony stage completion → era gate; `isruOperational` on Stage 2; board slot on Stage 3 |
| `src/engine/events.ts` | `coastalFlooding` handler skips tiles where `seaWallProtected === true` |
| `src/data/tileActions.ts` | New file: `TILE_ACTION_DEFS` Map — 4 action defs |
| `src/data/projects.ts` | Add Moon Colony 3-stage project defs + `boardProposalMoonColony` |
| `src/data/events.ts` | Add `megadrought`, `globalEconomicPressure`, `boardProposalMoonColony` |
| `src/data/board.ts` | Add Director of Lunar Operations def |
| `src/data/facilities.ts` | Add `lunarColonyHub`, `solarPowerSatellite` (T3 defs) |
| `src/lib/stores/game.svelte.ts` | `enqueueTileAction`; `isruOperational`; board slot unlock |
| `src/lib/components/FacilityPicker.svelte` | Add "TILE ACTIONS" section; filter/display tile action defs |
| `src/lib/components/MapContainer.svelte` | Show T3 upgrade buttons when Moon Colony Stage 3 complete |
| `src/phaser/SpaceScene.ts` | Enable Asteroid Belt node interactivity on Era 3 unlock |

---

## Verification

```bash
npm run test:run     # Moon Colony progression, ISRU, era gate, tile actions, sea wall protection
npm run test:e2e     # Full playthrough to Era 3
npm run lint
npm run dev
```

**Manual checklist — Moon Colony:**
- [ ] Complete `lunarHabitat` → board proposal event fires for Moon Colony
- [ ] Authorize Moon Colony (40 Will + 60 Funding) → Stage 1 project appears
- [ ] Stage 2 completes → lunar supply costs drop to 0; `isruOperational` flag set
- [ ] Stage 3 completes → Era 3 unlocked; narrative modal shown; Asteroid Belt becomes interactive
- [ ] Director of Lunar Operations board seat visible and fillable

**Manual checklist — Tile Actions:**
- [ ] Select any forested/agricultural tile → FacilityPicker shows "TILE ACTIONS" section with `urbanize`
- [ ] `urbanize` costs Political Will (not Materials); tile type changes to urban after 1 turn
- [ ] Select a dustbowl tile → `restoreHabitat` appears (requires `carbonCaptureTechnology`)
- [ ] `restoreHabitat` takes 3 turns; destroyed status cleared, tile → forested on completion
- [ ] `buildSeaWall` on coastal tile (requires `advancedCoastalEngineering`); `seaWallProtected: true` after completion
- [ ] `coastalFlooding` event fires → protected coastal tiles are NOT destroyed
- [ ] `cleanIndustrialSite` clears irradiated status back to industrial

**Manual checklist — Climate escalation:**
- [ ] `megadrought` event fires when climate ≥ 40 (destroys 2 tiles as dustbowl)
- [ ] `globalEconomicPressure` fires when climate ≥ 60 (large Will + Funding drain)

**Manual checklist — T3 upgrades:**
- [ ] `lunarColonyHub` upgrade available after Stage 3 + `cislunarTransportNetwork`; supply cost 0
- [ ] `solarPowerSatellite` T3 upgrade available; supply cost 0
