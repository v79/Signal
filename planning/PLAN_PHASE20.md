# Phase 20 — Earth Era Balance

## Problem Statement

The Earth era currently punishes players too heavily and too early, frequently creating unrecoverable situations before the player has the tools to respond. Three root causes:

1. **Events fire uniformly** — the weighted pool treats a –35 materials `blockadeGeopolitical` identically to a minor `fundingCrisis`. Severe events appear far too often.
2. **No materials recovery path** — `emergencyAppeal` converts Will → Funding, but there is no equivalent for Materials. A materials death spiral is unrecoverable: can't build a mine (costs 20 materials) when you have no materials.
3. **Coastal flooding is instant** — `countdownTurns: 1` means the player is shown an event and immediately suffers its effect with zero response window.

Secondary issues confirmed from data:
- `blockadeGeopolitical` deals –35 materials in a single blow — one of the worst single hits in the game, weighted the same as milder events
- Up to 2 crisis events can land on the same turn, for combined damage exceeding starting material reserves
- South American Union and African Coalition blocs start with only 50–55 materials — barely enough to build a single mine before a crisis wipes them out

---

## Sub-tasks

### 20.1 — Event weight system ✅

**Files:** `src/engine/types.ts`, `src/engine/events.ts`, `src/data/events.ts`

Add `weight: number` to `EventDef`:

```typescript
export interface EventDef {
  // ... existing fields ...
  weight: number; // Selection probability relative to other events. Default 1.0.
}
```

Modify `selectNewEvents` / `getEligibleEvents` to use weighted random selection instead of uniform `rng.pick()`. The new selection loop:
1. Sum weights of all eligible events
2. Pick a random value in [0, totalWeight)
3. Walk the list accumulating weight until the threshold is crossed

Assign weights to all 10 existing events:

| Event | Current weight | New weight | Rationale |
|---|---|---|---|
| `fundingCrisis` | — | 1.0 | Common, manageable |
| `diplomaticOverture` | — | 1.2 | Positive — should appear often |
| `signalInterference` | — | 0.8 | Negative but not catastrophic |
| `signalBreakthrough` | — | 0.9 | Positive — welcome but not dominant |
| `politicalScandalMinor` | — | 0.7 | Moderately severe |
| `industrialAccident` | — | 0.6 | Significant materials hit |
| `coastalFlooding` | — | 0.5 | Tile destruction — rare |
| `scientificLeap` | — | 0.9 | Positive — reward for science investment |
| `blockadeGeopolitical` | — | 0.3 | Severe — should be rare |
| `deepSpaceAnomaly` | — | 1.0 | Era-gated, irrelevant here |

---

### ~~20.2 — Climate pressure scales event severity~~

**Files:** `src/engine/events.ts`, `src/engine/turn.ts`

Pass `climatePressure` into `selectNewEvents` and `getEligibleEvents`. For events tagged `['climate', ...]`, apply a weight multiplier:

```typescript
const climateMultiplier = 1 + (climatePressure / 100); // 1.0 at 0%, 2.0 at 100%
```

This creates an emergent difficulty curve: ignoring climate makes climate events increasingly likely, which further degrades the situation. The player feels the consequence without a hard cliff.

Only `climate`-tagged events receive the multiplier; all others remain at their base weight.

---

### 20.3 — Crisis concurrency cap ✅

**Files:** `src/engine/events.ts`

Prevent two crisis-tagged events landing on the same turn. In `getEligibleEvents`, if any currently-active event carries the `crisis` tag, exclude all other `crisis`-tagged events from the eligible pool for this turn.

Also extend the early-game protection window from 5 turns to **8 turns**, matching the time it takes the player to establish one or two facilities.

---

### 20.4 — Materials recovery standing action ✅

**Files:** `src/data/standingActions.ts`, `src/lib/stores/game.svelte.ts`

Add a new standing action: **Emergency Sourcing**

```typescript
{
  id: 'emergencySourcing',
  name: 'Emergency Sourcing',
  description: 'Redirect political capital to emergency raw material acquisition. Spend 25 Political Will, gain 20 Materials.',
  cost: { politicalWill: 25 },
  actionKey: 'emergencySourcing',
}
```

Implement `emergencySourcing()` in the game store, mirroring the existing `emergencyAppeal()` pattern:
- Requires `phase === 'action'` and `politicalWill >= 25`
- Deducts 25 Will, adds 20 Materials
- Adds a news item

This mirrors Emergency Appeal (Will → Funding) and gives the player a symmetric escape hatch.

---

### 20.5 — Coastal flooding countdown fix ✅

**File:** `src/data/events.ts`

Change `coastalFlooding.countdownTurns` from `1` to `2`.

A 1-turn countdown is effectively no warning — the event arrives and expires before the player can take any action. Two turns gives the player one action phase to respond or at minimum understand what happened.

---

### 20.6 — Starting resource review ✅

**File:** `src/data/blocs.ts`

Review all 7 bloc starting material values. Proposed changes:

| Bloc | Current materials | Proposed |
|---|---|---|
| North American Alliance | 60 | 70 |
| East Asian Consortium | 80 | 80 (no change) |
| South American Union | 55 | 65 |
| African Coalition | check | minimum 60 |
| European Federation | check | minimum 60 |
| Central Asian Bloc | check | minimum 60 |
| Pacific Island Network | check | minimum 55 |

The intent: every bloc should be able to absorb one `industrialAccident` (–20 materials) and still have enough left to build one facility. Current weakest blocs cannot.

---

### 20.7 — Resource Mine cost reduction ✅

**File:** `src/data/facilities.ts`

Reduce Resource Mine build cost from `{ materials: 20 }` to `{ materials: 12 }`.

The mine costs 20 materials to build and produces 8 materials/turn. When a player's materials are depleted by a crisis event, they cannot afford to rebuild their production capacity — the very resource needed to recover is the one that buys recovery. Reducing the floor to 12 materials ensures the mine is reachable from a depleted state, with Emergency Sourcing (20 materials) acting as the bridge.

---

## Postponed from Phase 20

- **20.2 Climate pressure scales event severity** — deferred; climate management requires further design thought before implementation.

## Out of scope for Phase 20

- Tile-specific event damage (coastal flooding destroying a specific tile's facility) — deferred; requires a targeting system
- Event frequency affected by Global Will — deferred; Global Will is not yet a meaningful tracked quantity
- Conflicting events (signal interference / signal breakthrough cannot coexist) — deferred to event system rework
- New positive events to balance the pool — the weight system achieves the same outcome without new content
