# Phase 29 — Era 2 Game Content: Near Space (Part 1)

## Goal

Era 2 infrastructure exists (SpaceScene renders nodes, SpaceNode type defined, era transition wired in `turn.ts`) but has almost no game content. Two facility stubs (`orbitalPlatform`, `lunarMine`) exist without upgrade paths or meaningful balancing. This phase delivers the core Era 2 gameplay loop: two new mechanics (Launch Capacity and Facility Upgrades), plus a full content layer (tech tree, facilities, cards, events).

Phase 30 will add the Moon Colony landmark that gates Era 3.

## Deliverables

- [x] 29.1 — Type extensions: `launchCapacity`, `launchAllocation`, `supplyCost`, `upgradesFrom`, `era` on `TechDef`
- [x] 29.2 — Near Space data: 8 techs, ~14 facility defs (upgrade chains), 6 cards, 8 events
- [x] 29.3 — Earth tech track data: 6 techs, 4 Earth facilities, 2 Earth cards
- [x] 29.4 — Engine: launch capacity computation and inactive facility skipping
- [x] 29.5 — Engine: facility upgrade action
- [x] 29.6 — Store: `toggleSpaceFacilitySupply`, `upgradeFacility` actions
- [x] 29.7 — UI: Near Space panel — launch capacity bar + supply toggles + upgrade button
- [x] 29.8 — Phaser: dim inactive space nodes
- [x] 29.9 — Tests: launch capacity logic, upgrade chain, inactive facility output

---

## Mechanic 1: Launch Capacity

Each `spaceLaunchCentre` on Earth provides **+3 launch units** per turn. Space facility defs have a `supplyCost` (1–2 units). During the Action Phase the player manually toggles supply on/off per facility in the Near Space panel. Unsupplied facilities produce no output that turn.

**UI sketch:**
```
Launch Capacity: ████░░  4/6

  LEO  Orbital Module       [ON] 2u
  LEO  Orbital Solar Array  [ON] 1u
  L2   Deep Space Relay     [ON] 1u
  🌙   Lunar Habitat        [OFF] 2u
  🌙   Lunar Mine           [ON] 1u
```

Over-allocation is blocked in the UI (toggling ON is disabled when remaining capacity < facility supply cost).

**Capacity sources:**

| Source | Units |
|--------|-------|
| `spaceLaunchCentre` (Earth facility) | +3 |
| `reusableLaunchSystems` tech (HQ bonus) | +2 |
| `nuclearThermalPropulsion` tech (HQ bonus) | +1 |
| `cislunarTransportNetwork` tech (HQ bonus) | +3 |

**State changes (`GameState`):**
- `launchCapacity: number` — recomputed at World Phase start from facilities + HQ bonuses
- `launchAllocation: Record<string, boolean>` — keyed by space node ID; player sets during Action Phase

**Engine flow:**
1. World Phase start: `recomputeLaunchCapacity(state)` writes `state.launchCapacity`
2. Facility output tick: space facilities where `launchAllocation[nodeId] === false` are skipped entirely
3. Earth facilities (`supplyCost` undefined or 0) are unaffected

---

## Mechanic 2: Facility Upgrade Paths

Each space node holds one facility but facilities can be upgraded through up to 3 tiers. This avoids repeating Earth's multi-slot model while giving the Near Space map depth.

**Data model:** `FacilityDef` gains `upgradesFrom?: string` — the ID of the facility this replaces.

Example chain:
```
orbitalModule (T1)  →  orbitalLaboratory (T2)  →  orbitalResearchStation (T3)
```

**Upgrade rules:**
- Upgrade triggered from the node detail panel ("Upgrade" button, visible when next tier's `requiredTechId` is discovered)
- Cost = next tier's `buildCost` (incremental, not cumulative)
- Duration = next tier's `buildTime`
- Existing facility stays active during construction (no downtime)
- Cannot demolish a space facility — only upgrade or abandon (abandon destroys it, no refund)

**Engine integration:** uses existing construction queue (`tickConstructionQueue`); no new queue needed. When upgrade completes, the node's `facilityId` is replaced with the new tier's ID.

---

## 29.1 — Type Extensions (`src/engine/types.ts`)

`GameState`:
```ts
launchCapacity: number;
launchAllocation: Record<string, boolean>;
```

`FacilityDef`:
```ts
supplyCost?: number;       // launch units/turn; undefined = Earth facility
upgradesFrom?: string;     // ID of the facility this upgrades from
```

`TechDef`:
```ts
era?: Era;                 // 'earth' | 'nearSpace' | 'deepSpace' — informational/filtering
```

---

## 29.2 — Tech Tree (`src/data/technologies.ts`)

8 new techs. All `era: 'nearSpace'`. Variance 0.25 unless noted.

| ID | Name | Prereqs | Base Recipe | Unlocks |
|----|------|---------|-------------|---------|
| `reusableLaunchSystems` | Reusable Launch Systems | `orbitalMechanics` | Eng 40, Physics 20, Computing 20 | HQ +2 launch capacity; opens T2 upgrade on `orbitalModule` |
| `advancedLifeSupport` | Advanced Life Support | `cryogenicPropulsion`, `geneticEngineering` | Biochem 40, Eng 30, Computing 20 | `lunarHabitat` facility; card `missionExtension` |
| `inSituResourceUtilization` | In-Situ Resource Utilization | `orbitalMechanics` | Eng 35, Biochem 25, Physics 15 | `lunarProcessingPlant` (T1); supply cost of Lunar Surface → 0 when Moon Colony Stage 2 complete (Phase 30) |
| `quantumSensing` | Quantum Sensing | `particlePhysicsDetectors` | Physics 60, Maths 40 | `deepSpaceRelay` T2 upgrade → `lunarObservatory`; card `signalBurst`; `signalDerived: true` |
| `nuclearThermalPropulsion` | Nuclear Thermal Propulsion | `cryogenicPropulsion` | Physics 50, Eng 40 | HQ +1 launch capacity; `deepSpaceRelay` (T1) |
| `autonomousSpaceConstruction` | Autonomous Space Construction | `reusableLaunchSystems`, `internetProtocols` | Computing 50, Eng 35, Maths 20 | HQ: all space `supplyCost` −1 (min 1); card `constructionDrone`; unlocks T3 upgrades |
| `lunarRegolithProcessing` | Lunar Regolith Processing | `inSituResourceUtilization` | Eng 45, Biochem 20, Maths 20 | `lunarProcessingPlant` T2 upgrade; extends `lunarMine` depletion timer; prerequisite for Moon Colony Stage 2 (Phase 30) |
| `cislunarTransportNetwork` | Cislunar Transport Network | `nuclearThermalPropulsion`, `autonomousSpaceConstruction` | Eng 55, Computing 35, Maths 30 | HQ +3 launch capacity; card `resourceTransfer`; prerequisite for Moon Colony Stage 3 (Phase 30) |

---

## 29.2 — Facilities (`src/data/facilities.ts`)

All space facilities: `era: 'nearSpace'`, no `allowedTileTypes` (placed on space nodes).

### Rename/patch existing stubs
- `orbitalPlatform` → rename to `orbitalModule`, adjust stats to match T1 below
- `lunarMine` → add `supplyCost: 2`

### LEO / L1 — Research chain

| Tier | ID | Name | Build Cost | Upkeep | Supply | Field Output | Requires |
|------|----|------|------------|--------|--------|--------------|---------|
| T1 | `orbitalModule` | Orbital Module | 60F · 40M | 5F · 3M/turn | 2 | Physics +4, Eng +3 | `orbitalMechanics` |
| T2 | `orbitalLaboratory` | Orbital Laboratory | +40F · 30M | 7F · 3M/turn | 2 | Physics +6, Eng +5, Maths +2 | `reusableLaunchSystems` |
| T3 | `orbitalResearchStation` | Orbital Research Station | +60F · 40M | 10F · 4M/turn | 2 | Physics +10, Eng +8, Maths +4, Computing +3 | `autonomousSpaceConstruction` |

### LEO — Power/income chain

| Tier | ID | Name | Build Cost | Upkeep | Supply | Resource Output | Field Output | Requires |
|------|----|------|------------|--------|--------|-----------------|--------------|---------|
| T1 | `orbitalSolarArray` | Orbital Solar Array | 50F · 35M | 2F/turn | 1 | Funding +10 | Physics +2 | `photovoltaicSolarCells` + `reusableLaunchSystems` |
| T2 | `advancedSolarArray` | Advanced Solar Array | +35F · 25M | 3F/turn | 1 | Funding +18 | Physics +3 | `autonomousSpaceConstruction` |

### Lunar Surface — Extraction chain

| Tier | ID | Name | Build Cost | Upkeep | Supply | Resource Output | Field Output | Requires | Notes |
|------|----|------|------------|--------|--------|-----------------|--------------|---------|-------|
| T1 | `lunarMine` | Lunar Mine | 30F · 50M | 5F · 3M/turn | 2 | Materials +14 (depletes) | Eng +2 | `orbitalMechanics` | Existing; add `supplyCost: 2` |
| T2 | `lunarProcessingPlant` | Lunar Processing Plant | +40F · 30M | 5F · 3M/turn | 1 | Materials +20 (not depleting) | Eng +4 | `lunarRegolithProcessing` | Supply cost → 0 with Moon Colony Stage 2 (ISRU) |

### Lunar Surface — Habitation chain

| Tier | ID | Name | Build Cost | Upkeep | Supply | Field Output | Requires |
|------|----|------|------------|--------|--------|--------------|---------|
| T1 | `lunarHabitat` | Lunar Habitat | 80F · 60M | 6F · 5M/turn | 2 | Biochem +4, SocSci +5 | `advancedLifeSupport` |
| T2 | `lunarResearchBase` | Lunar Research Base | +50F · 40M | 8F · 5M/turn | 2 | Biochem +7, SocSci +7, Physics +3 | `autonomousSpaceConstruction` |

### L2 — Signal/relay chain

| Tier | ID | Name | Build Cost | Upkeep | Supply | Signal/turn | Field Output | Requires |
|------|----|------|------------|--------|--------|-------------|--------------|---------|
| T1 | `deepSpaceRelay` | Deep Space Relay | 70F · 40M | 6F/turn | 1 | +8 | Physics +4, Computing +3 | `nuclearThermalPropulsion` + `satelliteCommunications` |
| T2 | `lunarObservatory` | Lunar Observatory | +60F · 40M | 8F/turn | 1 | +14 | Physics +8, Computing +5 | `quantumSensing` |

---

## 29.2 — Cards (`src/data/cards.ts`)

All `era: 'nearSpace'`.

| ID | Name | Effect | Counter | Unlocked By |
|----|------|--------|---------|-------------|
| `missionExtension` | Mission Extension | Double output of chosen space facility this turn (must be supplied) | — | `advancedLifeSupport` |
| `constructionDrone` | Construction Drone | Reduce next space facility build/upgrade time by 2 turns | — | `autonomousSpaceConstruction` |
| `signalBurst` | Signal Burst Analysis | Signal +15, Physics +8, Computing +5 | Counters `signalInterference` (full) | `quantumSensing` |
| `fuelDepotReserve` | Fuel Depot Reserve | +3 launch capacity this turn only | Counters `fuelShortage` (full) | Era 2 standing action (always available in nearSpace) |
| `resourceTransfer` | Resource Transfer | Materials +20 | — | `cislunarTransportNetwork` |
| `emergencyEVA` | Emergency EVA | Negate one orbital crisis effect | Counters `orbitalDebrisField`, `stationAirlock` (full) | Era 2 standing action (always available in nearSpace) |

---

## 29.2 — Events (`src/data/events.ts`)

| ID | Tags | Eras | Tier | Negative / Opportunity Effect | Counter |
|----|------|------|------|-------------------------------|---------|
| `orbitalDebrisField` | orbital, crisis | nearSpace | partialMitigation | Random LEO/L1 facility inactive 2 turns | Cost: Materials +25; full: `emergencyEVA` |
| `solarStorm` | solar, crisis | nearSpace, deepSpace | partialMitigation | Space output −50% 1 turn, Signal −10 | Cost: Political Will +15 |
| `fuelShortage` | logistics, crisis | nearSpace | fullCounter | Launch capacity −2 for 2 turns | `fuelDepotReserve` card |
| `lunarSeismicEvent` | geological, crisis | nearSpace | noCounter | Lunar Surface facilities offline 1 turn, Materials −15 | — |
| `signalCoherenceWindow` | signal | nearSpace, deepSpace | noCounter (beneficial) | Signal +25, Maths +15 | Opportunity: Funding −20 → Signal +10 more |
| `stationAirlock` | orbital, crisis | nearSpace | partialMitigation | Eng −15; LEO `supplyCost` +1 for 2 turns | Cost: Funding +20 |
| `globalSpaceCompetition` | diplomatic, bloc | nearSpace | partialMitigation | Political Will −20 | Cost: Political Will +10, Funding +10 |
| `climateRefugees` | climate, crisis | earth, nearSpace | noCounter | Political Will −15, Funding −15 | — (minClimate: 50) |

---

## 29.3 — Earth Technology Track (`src/data/technologies.ts`)

A third tech track focused on real-world advances of the 2020s–2040s. These remain grounded on Earth (era `'earth'` or `'nearSpace'`), complementing the space operations and signal tracks. They primarily improve Earth-side output, reduce climate damage, or unlock powerful late-game facilities. Variance 0.25 unless noted.

| ID | Name | Era | Prereqs | Base Recipe | Unlocks |
|----|------|-----|---------|-------------|---------|
| `advancedCoastalEngineering` | Advanced Coastal Engineering | earth | `fibreglassComposites` | Eng 40, Maths 25, SocSci 20 | `buildSeaWall` tile action (Phase 30); HQ Eng +1 |
| `highTempSuperconductors` | High-Temperature Superconductors | earth | `particlePhysicsDetectors` | Physics 60, Eng 40, Maths 25 | `magneticConfinementLab` facility; HQ Physics +2; reduces `fissionPowerStation` `climateImpact` by 0.1 (passive bonus) |
| `carbonCaptureTechnology` | Carbon Capture Technology | earth | `geneticEngineering`, `fibreglassComposites` | Biochem 50, Eng 35, SocSci 25 | `carbonCaptureStation` facility; `restoreHabitat` + `cleanIndustrialSite` tile actions (Phase 30) |
| `largeLaguageModels` | Large Language Models | earth | `internetProtocols`, `personalComputers` | Computing 70, Maths 40, SocSci 20 | `aiResearchCentre` facility; card `aiAssistance`; HQ Computing +3, SocSci +1 |
| `nuclearFusion` | Nuclear Fusion Power | nearSpace | `highTempSuperconductors`, `cryogenicPropulsion` | Physics 80, Eng 55, Maths 35 | `fusionReactor` facility (unique); HQ Physics +2. Tier 5 — very late Era 2. |
| `agenticAI` | Agentic AI Systems | nearSpace | `largeLaguageModels` | Computing 80, Maths 50, SocSci 20 | HQ all fields +1; card `autonomousResearch`. Tier 5 — pairs with `nuclearFusion` as the late Era 2 research capstone. |

### New Earth Facilities from this track

All `era: 'earth'`.

| ID | Name | Tile Types | Build Cost | Upkeep | Field Output | Climate | Requires |
|----|------|-----------|------------|--------|--------------|---------|---------|
| `magneticConfinementLab` | Magnetic Confinement Lab | industrial, highland | 80F · 40M | 10F/turn | Physics +6, Eng +4, Maths +3 | −0.05/turn | `highTempSuperconductors` |
| `aiResearchCentre` | AI Research Centre | urban | 70F · 20M | 12F/turn | Computing +12, Maths +8, SocSci +4 | — | `largeLaguageModels` |
| `fusionReactor` | Fusion Reactor | industrial | 120F · 80M | 15F/turn | Physics +4, Eng +3 | 0 (no climate impact) | `nuclearFusion`; unique |
| `carbonCaptureStation` | Carbon Capture Station | industrial, coastal | 60F · 30M | 10F/turn | Biochem +3, SocSci +2 | −0.3/turn | `carbonCaptureTechnology` |

Notes:
- `fusionReactor` is unique; produces Funding +20/turn and zero climate impact — a major late-game clean energy source
- `magneticConfinementLab` passively reduces climate via its `climateImpact: -0.05` (the first facility with a negative climate impact that isn't renewables)
- `carbonCaptureStation` is the most aggressive climate reducer but expensive to run

### New Earth Cards from this track

| ID | Name | Era | Effect | Unlocked By |
|----|------|-----|--------|-------------|
| `aiAssistance` | AI Research Assistance | earth | Computing +12, Maths +8, Physics +5 | `largeLaguageModels` |
| `autonomousResearch` | Autonomous Research Protocol | nearSpace | All research fields +4 this turn; Signal +5 | `agenticAI` |

---

## 29.4 — Engine: Launch Capacity (`src/engine/facilities.ts`, `src/engine/state.ts`)

**`src/engine/state.ts`:**
- `createGameState`: initialise `launchCapacity: 0`, `launchAllocation: {}`
- Add `recomputeLaunchCapacity(state: GameState): number` helper — sums `resourceOutput.launchCapacity` from all built Earth facilities plus HQ bonuses

**`src/engine/facilities.ts`:**
- `computeFacilityOutput`: add early-return if facility is a space facility and `launchAllocation[nodeId] === false`
- Space facilities identified by `def.supplyCost !== undefined && def.supplyCost > 0` (or by node type)

---

## 29.5 — Engine: Facility Upgrade (`src/engine/facilities.ts`)

- `canUpgradeFacility(state, nodeId): FacilityDef | null` — finds the facility def where `upgradesFrom === currentFacilityId` and `requiredTechId` is discovered; returns it or null
- Upgrade uses existing `startConstruction` path; on completion `node.facilityId` is set to the new def ID
- The in-progress construction def knows its `upgradesFrom`; the existing facility output runs normally until construction completes

---

## 29.5 — Store (`src/lib/stores/game.svelte.ts`)

New actions:
- `toggleSpaceFacilitySupply(nodeId: string)` — flips `launchAllocation[nodeId]`; blocked if toggling ON and remaining capacity < `supplyCost`
- `upgradeFacility(nodeId: string)` — starts construction of the next-tier facility def on the given node
- Derived: `remainingLaunchCapacity` = `launchCapacity` minus sum of supply costs of all ON-allocated facilities

---

## 29.6 — UI: Near Space Panel (`src/lib/components/MapContainer.svelte`)

Near Space tab changes:
- **Capacity bar** at top of panel: `Launch Capacity: ████░░ 4/6`
- **Per-node supply row**: node label, facility name, `[ON/OFF]` toggle button, supply cost in units
- Toggle ON disabled when remaining capacity would go negative
- **Node detail panel**: when a node is selected and `canUpgradeFacility` returns non-null, show "Upgrade → [next tier name]" button with cost summary

---

## 29.7 — Phaser: SpaceScene (`src/phaser/SpaceScene.ts`)

- Nodes where `launchAllocation[nodeId] === false` rendered at reduced alpha (≈ 0.4) with a grey tint
- Re-render triggered by `worldPhaseComplete` event (existing pattern)

---

## 29.8 — Tests

New test file `src/engine/launchCapacity.test.ts`:
- Capacity correctly sums from `spaceLaunchCentre` + HQ tech bonuses
- Inactive facility produces zero output
- Over-capacity allocation blocked
- Upgrade chain: `canUpgradeFacility` returns correct next tier; output switches on completion

---

## Files Modified

| File | Change |
|------|--------|
| `src/engine/types.ts` | `launchCapacity`, `launchAllocation` on `GameState`; `supplyCost?`, `upgradesFrom?` on `FacilityDef`; `era?` on `TechDef` |
| `src/engine/state.ts` | Initialise new fields; `recomputeLaunchCapacity` helper |
| `src/engine/facilities.ts` | Inactive skip; `canUpgradeFacility`; upgrade construction path |
| `src/engine/turn.ts` | World Phase: recompute capacity before output tick |
| `src/data/facilities.ts` | Rename `orbitalPlatform` → `orbitalModule`; patch `lunarMine`; add 12 Near Space defs + 4 Earth defs (`magneticConfinementLab`, `aiResearchCentre`, `fusionReactor`, `carbonCaptureStation`) |
| `src/data/technologies.ts` | Add 8 Near Space techs + 6 Earth track techs (14 total) |
| `src/data/cards.ts` | Add 6 Near Space cards + 2 Earth cards (`aiAssistance`, `autonomousResearch`) |
| `src/data/events.ts` | Add 8 Near Space/Earth events |
| `src/lib/stores/game.svelte.ts` | `toggleSpaceFacilitySupply`, `upgradeFacility`, `remainingLaunchCapacity` |
| `src/lib/components/MapContainer.svelte` | Capacity bar + supply toggles + upgrade button |
| `src/phaser/SpaceScene.ts` | Dim inactive nodes |

---

## Verification

```bash
npm run test:run     # Engine unit tests incl. new launchCapacity.test.ts
npm run lint         # Type-check all new interfaces
npm run dev          # Manual playthrough
```

**Manual checklist — Near Space mechanics:**
- [ ] Build `spaceLaunchCentre` → Near Space panel shows capacity bar (3 units)
- [ ] Discover `reusableLaunchSystems` → capacity increases to 5
- [ ] Toggle OFF a facility → no output in World Phase; resources/fields not incremented
- [ ] Toggle ON blocked when remaining capacity < facility supply cost
- [ ] Build `orbitalModule` → "Upgrade → Orbital Laboratory" button appears after `reusableLaunchSystems`
- [ ] Upgrade in progress → original facility still produces output
- [ ] `deepSpaceRelay` at L2 → signal decode rate increases
- [ ] Upgrade to `lunarObservatory` → signal decode increases further
- [ ] `solarStorm` event → space output halved, Signal −10
- [ ] `fuelShortage` event → capacity −2 for 2 turns; `fuelDepotReserve` counters it fully
- [ ] `climateRefugees` only fires when climate ≥ 50

**Manual checklist — Earth tech track:**
- [ ] `highTempSuperconductors` discovered → `magneticConfinementLab` appears in facility picker for industrial/highland tiles
- [ ] `largeLaguageModels` discovered → `aiResearchCentre` available for urban tiles; `aiAssistance` card added to deck pool
- [ ] `nuclearFusion` discovered → `fusionReactor` available; has zero `climateImpact`; unique (only one buildable)
- [ ] `carbonCaptureTechnology` discovered → `carbonCaptureStation` available; shows negative climate impact in tile tooltip
- [ ] `agenticAI` discovered → HQ bonuses visible (+1 all fields) in ResearchFeed; `autonomousResearch` card in pool
