# Phase 33 — Near Space Interactivity: Build Actions, Node Picker, Launch Constraints

## Goal

Make the Near Space map fully playable. Currently the player can see the four orbital nodes and toggle supply on existing facilities, but there is no way to initiate the first build on an empty node. This phase adds the facility build action for space nodes, a dedicated node detail/picker UI, enforced launch capacity constraints, and lunar mine depletion.

## Prerequisites

- Phase 29 complete (launch capacity, upgrade system, all nearSpace facility/tech data)
- Phase 32 complete (tech tree Era 2 display)

---

## Deliverables

- [x] 33.1 — `buildSpaceFacility` store action + validation
- [x] 33.2 — `SpaceNodePicker.svelte` component
- [x] 33.3 — Wire `SpaceNodePicker` into `MapContainer`
- [x] 33.4 — Launch capacity constraint enforcement in build UI
- [x] 33.5 — Lunar mine depletion
- [ ] 33.6 — Tests

---

## 33.1 — `buildSpaceFacility` Store Action

New action in `src/lib/stores/game.svelte.ts`:

```ts
buildSpaceFacility(nodeId: string, defId: string): void
```

### Validation (in order — fail silently on first block, or surface error in UI):

1. Node exists in `state.map.spaceNodes`
2. Node's `facilityId` is `null` (empty)
3. No construction queue entry already targeting this `spaceNodeId`
4. `def.requiredTechId` is `null` or present in discovered techs
5. Player can afford `def.buildCost`
6. `def.supplyCost ?? 0` ≤ `remainingLaunchCapacity` (capacity check — **key new constraint**)
7. Action cap not exceeded (`actionsThisTurn < maxActionsPerTurn`)

### On success:
- Deduct `def.buildCost` from `state.player.resources`
- Push to `state.player.constructionQueue`:
  ```ts
  {
    id: `space-build-${nodeId}-${Date.now()}`,
    type: 'construct',
    facilityDefId: defId,
    spaceNodeId: nodeId,
    turnsRemaining: def.buildTime,
    totalTurns: def.buildTime,
  }
  ```
- Increment `actionsThisTurn`
- Add news item: `"Construction begun: [facility name] at [node label]"`

Note: `buildTime === 0` is not expected for space facilities (all have `buildTime >= 2`) but the engine handles it via the existing `tickConstructionQueue` instant-complete path.

---

## 33.2 — `SpaceNodePicker.svelte`

New component in `src/lib/components/SpaceNodePicker.svelte`. Analogous to `FacilityPicker.svelte` but designed for the single-facility-per-node space model.

### Props:

```ts
{
  node: SpaceNode;
  facilityDefs: Map<string, FacilityDef>;
  playerResources: Resources;
  discoveredTechIds: ReadonlySet<string>;
  techNames: ReadonlyMap<string, string>;
  constructionQueue: OngoingAction[];
  launchCapacity: number;
  remainingCapacity: number;
  actionsThisTurn: number;
  maxActionsPerTurn: number;
  onBuild: (defId: string) => void;
  onClose: () => void;
}
```

### Layout: left-anchored panel, same visual style as `FacilityPicker`

#### Section 1 — Node Info Header
- Node label (e.g. "LEO — Low Earth Orbit")
- Node type badge (e.g. "lowEarthOrbit")
- Launch cost to reach this node: `{node.launchCost}M`

#### Section 2 — Current State
Three mutually exclusive states:

**A. Empty, not under construction:**
> `[ VACANT ]` — no facility built

**B. Under construction:**
> `⚙ [facility name] — [turnsRemaining] turn(s) remaining`
> No build options shown (slot occupied).

**C. Occupied:**
> `[facility name]`
> Key stats: field output, resource output, supply cost
> Supply status: `SUPPLIED` / `UNSUPPLIED`
> If upgradeable: "↑ Upgrade → [next tier name] — [cost] — [time] turns"
> (Upgrade button calls existing `onUpgrade` — this will be threaded in from the parent; see 33.3)

#### Section 3 — Available to Build (only shown when node is vacant and not under construction)

List of all `FacilityDef` entries where:
- `def.era === 'nearSpace'`
- `def.allowedNodeTypes` includes `node.type` (see note below on new field)

Each entry shows:
- Name
- Build cost (`60F · 40M`)
- Build time (`3 turns`)
- Supply cost (`2 launch units`)
- Field/resource output summary (same helper as `FacilityPicker`)
- Required tech name if locked (greyed out row, lock icon + tech name)

**Disabled states (row greyed, button disabled):**
- Tech not yet discovered
- Cannot afford build cost
- Supply cost would exceed remaining launch capacity → label: `"CAPACITY FULL — [used]/[total]"`
- Action cap reached

**Build button:** `BUILD →` per eligible facility def.

### Node type filtering — new `allowedNodeTypes` field on `FacilityDef`

`FacilityDef` (in `src/engine/types.ts`) gains:
```ts
allowedNodeTypes?: SpaceNodeType[];
```

`SpaceNodeType` is the type of `SpaceNode.type` — already defined as a string union in types. If `allowedNodeTypes` is absent or empty, the facility is Earth-only (uses `allowedTileTypes` as today). If present, it appears in the space picker.

Update `src/data/facilities.json` for all `nearSpace` facilities to include `allowedNodeTypes`:

| Facility | Node types |
|----------|-----------|
| `orbitalModule`, `orbitalLaboratory`, `orbitalResearchStation` | `lowEarthOrbit` |
| `orbitalSolarArray`, `advancedSolarArray`, `solarPowerSatellite` | `lowEarthOrbit`, `lagrangePoint` |
| `deepSpaceRelay`, `lunarObservatory` | `lagrangePoint` |
| `lunarMine`, `lunarProcessingPlant`, `lunarHabitat`, `lunarResearchBase`, `lunarColonyHub` | `lunarSurface` |

---

## 33.3 — Wire `SpaceNodePicker` into `MapContainer`

In `src/lib/components/MapContainer.svelte`:

1. Add derived value `selectedSpaceNode`:
   ```ts
   const selectedSpaceNode = $derived(
     gameStore.selectedSpaceNodeId != null && gameStore.state
       ? (gameStore.state.map.spaceNodes.find((n) => n.id === gameStore.selectedSpaceNodeId) ?? null)
       : null,
   );
   ```

2. Mount `SpaceNodePicker` inside `.map-container` when `selectedSpaceNode && activeTab === 'space'`, analogous to the existing `FacilityPicker` block:
   ```svelte
   {#if selectedSpaceNode && activeTab === 'space' && gameStore.state}
     <SpaceNodePicker
       node={selectedSpaceNode}
       facilityDefs={FACILITY_DEFS}
       playerResources={gameStore.state.player.resources}
       discoveredTechIds={...}
       techNames={...}
       constructionQueue={gameStore.state.player.constructionQueue}
       launchCapacity={gameStore.state.launchCapacity}
       remainingCapacity={gameStore.remainingLaunchCapacity}
       actionsThisTurn={gameStore.state.actionsThisTurn ?? 0}
       maxActionsPerTurn={...}
       onBuild={(defId) => gameStore.buildSpaceFacility(gameStore.selectedSpaceNodeId!, defId)}
       onClose={() => gameStore.selectSpaceNode(null)}
     />
   {/if}
   ```

3. `SpaceOverview` still exists and is still opened via `≡ ASSETS`. It handles the fleet-level view (capacity bar, all nodes at a glance, supply toggles, upgrade buttons). `SpaceNodePicker` is the per-node detail view opened by clicking a node. They can coexist.

4. Close `SpaceNodePicker` when the player switches away from the space tab (already handled by the `activeTab === 'space'` condition, but also call `gameStore.selectSpaceNode(null)` inside `switchTab` when leaving the space tab).

---

## 33.4 — Launch Capacity Constraint Enforcement

The supply-cost capacity check already exists in `SpaceOverview` for supply toggles (`canToggleOn`). Phase 33 extends it to the build action.

### Engine side (`src/lib/stores/game.svelte.ts`):

`buildSpaceFacility` checks `def.supplyCost ?? 0 <= gameStore.remainingLaunchCapacity` before proceeding (see 33.1).

### UI side (`SpaceNodePicker`):

When `def.supplyCost > remainingCapacity`, show the build row as disabled with a specific label explaining why: `"CAPACITY FULL (${remainingCapacity} / ${def.supplyCost} needed)"`.

This makes the constraint legible — the player understands they must either unsupply another facility, build more Space Launch Centres, or research `reusableLaunchSystems` / `cislunarTransportNetwork`.

### `SpaceOverview` upgrade button:

Upgrade doesn't consume additional launch capacity (the node already has the supply allocated). No change needed there.

---

## 33.5 — Lunar Mine Depletion

`lunarMine` has `depletes: true`. The Earth mine depletion path in `src/engine/facilities.ts` (`computeFacilityOutput`) already scales output by `condition` (0–100) when `def.depletes === true`. The gap: `tickDepletion` (or equivalent) must also run for space facilities.

### Changes to `src/engine/facilities.ts`:

The existing `tickDepletion` function (or inline depletion logic in `tickConstructionQueue` / turn orchestration) likely only runs for Earth facilities. Extend it to also iterate `state.map.spaceNodes`, find any space facility instance whose `def.depletes === true`, and apply the same per-turn condition decrease.

Depletion rate: same as Earth mines (`condition -= 4` per turn, facility removed at `condition <= 0`, news item fires).

Check: `computeFacilityOutput` already skips unsupplied space facilities — depletion should also skip them (no wear if not running).

### Depletion produces a news item:

- At condition 50: `"Warning: Lunar Mine resources running low."`
- At condition 0 (exhausted): `"Lunar Mine at [node label] has been exhausted and removed."`

---

## 33.6 — Tests

New test file `src/engine/spaceActions.test.ts` (or extend `facilities.test.ts`):

- `buildSpaceFacility` — success path: node becomes occupied, resources deducted, queue entry added
- `buildSpaceFacility` — blocked when node occupied
- `buildSpaceFacility` — blocked when under construction
- `buildSpaceFacility` — blocked when supply cost exceeds remaining capacity
- `buildSpaceFacility` — blocked when tech not discovered
- `buildSpaceFacility` — blocked when cannot afford
- Lunar mine depletion: condition decreases each turn; facility removed at 0; unsupplied nodes do not deplete
- Launch capacity: `recomputeLaunchCapacity` returns correct total with multiple Space Launch Centres + tech bonuses

---

## Deferred (not Phase 33)

- **Signal output wiring** — `deepSpaceRelay`/`lunarObservatory` signal output into `signal.decodeProgress`. Deferred pending design decision on signal track pacing.
- **Moon Colony / ISRU** — Phase 30.1–30.3 remain unimplemented; not in scope here.
- **Facility abandon/replace** — intentionally deferred; space facility commitment should feel more consequential than Earth decommission.
- **Space tile actions** — no nearSpace tile action defs exist; not needed yet.

---

## Files Modified

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `allowedNodeTypes?: SpaceNodeType[]` to `FacilityDef` |
| `src/data/facilities.json` | Add `allowedNodeTypes` to all 14 nearSpace facilities |
| `src/engine/facilities.ts` | Extend depletion tick to space facility instances |
| `src/lib/stores/game.svelte.ts` | Add `buildSpaceFacility(nodeId, defId)` action |
| `src/lib/components/SpaceNodePicker.svelte` | New component |
| `src/lib/components/MapContainer.svelte` | Mount `SpaceNodePicker` on selected space node; deselect on tab leave |
| `src/engine/spaceActions.test.ts` | New test file (or extend `facilities.test.ts`) |

---

## Verification

```bash
npm run test:run     # All space action tests pass
npm run lint
npm run dev
```

**Manual checklist:**
- [ ] Click an empty space node on the Near Space tab → `SpaceNodePicker` opens showing node info and available facilities
- [ ] Facilities are filtered to the correct node type (e.g. only `orbitalModule` etc. on LEO, not lunar facilities)
- [ ] Tech-locked facilities shown greyed with lock label; unlocked ones show full cost
- [ ] Click BUILD → resources deducted, construction queue entry created, node shows "under construction" in picker
- [ ] Building a facility that would exceed launch capacity is blocked with a clear message
- [ ] After construction completes, picker shows current facility with stats and supply toggle
- [ ] Upgrade button visible when tech is discovered; clicking it initiates upgrade
- [ ] Open `≡ ASSETS` alongside a selected node — both panels are usable simultaneously
- [ ] Supply toggle in `SpaceOverview` still works as before
- [ ] Lunar mine depletes over time; exhaustion news item fires; facility is removed from node
- [ ] Switching away from the space tab deselects the node and closes the picker
