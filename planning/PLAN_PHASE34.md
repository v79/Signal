# Phase 34 — Signal Progress Caps

## Goal

The signal decode bar advances too fast, and there is no obvious incentive for the player to invest in nearSpace facilities early in Era 2. This phase addresses both problems with two interlocking mechanics:

1. **Hard tech-gated caps** — signal progress cannot exceed a ceiling until the player discovers specific signal-derived technologies in each era.
2. **Era 2 facility lock** — when the player transitions to nearSpace, signal ticking **pauses entirely** until they build a specific nearSpace facility. This makes the facility-build a clear, urgent first action in Era 2.

### Cap table

| Gate tech | Cap removed |
|---|---|
| `signalPatternAnalysis` (Era 1, tier 4) — already exists | lifts cap from **33%** |
| `interstellarSignalDecryption` (Era 2, tier 4) — new | lifts cap from **66%** |
| Era 3 tech — future phase | lifts cap from **100%** |

### Facility lock table

| Era | Signal ticks? | Condition |
|---|---|---|
| `earth` | Yes, always | Deep Space Arrays and BASE_PROGRESS apply normally |
| `nearSpace` | **No** — paused | Until at least one `signalRelayStation` facility is built |
| `nearSpace` (after build) | Yes | Resumes; cap still applies per gate table above |
| `deepSpace` | TBD | Future phase |

Until `signalPatternAnalysis` is discovered, the signal decode bar cannot exceed ~33%. Until the Era 2 signal tech is discovered, it cannot exceed ~66%. Separately, signal ticking pauses on entering nearSpace until the player builds a `signalRelayStation`.

---

## New Technology: `deepSpaceRelayNetwork` (Era 1, tier 5, signal-derived)

A new signal-derived **Era 1 Tier 5** tech. This is the capstone Era 1 technology that represents the organisational and engineering commitment to deploy signal-relay infrastructure into near space. It exists primarily to unlock `signalRelayStation`.

There are currently no Era 1 Tier 5 techs (the existing future-phase note in `FUTURE_PHASES.md` anticipated this slot).

| Field | Value |
|---|---|
| `id` | `deepSpaceRelayNetwork` |
| `name` | Deep Space Relay Network |
| `era` | _(none — Era 1)_ |
| `tier` | `5` |
| `signalDerived` | `true` |
| `requiredTechIds` | `signalPatternAnalysis`, `internetProtocols` |
| `baseRecipe` | `physics: 40, engineering: 60, computing: 50, mathematics: 30` |
| `recipeVariance` | `0.2` |
| `unlocksFacilities` | `signalRelayStation` |
| `unlocksCards` | `[]` |
| `unlocksProjects` | `[]` |

**Narrative:** The programme has committed to deploying a continuous relay network from cislunar space to the inner edge of the heliopause region. Ground-based analysis was always going to hit a wall — the signal's origin is too distant and its structure too compressed. The relay network is the bridge.

**rumourText:** "Ground-based observatories are approaching the theoretical limit of what they can resolve from the signal. The next step would require infrastructure beyond the atmosphere."

---

## New Facility: `signalRelayStation` (nearSpace)

A cheap, fast-to-build nearSpace facility unlocked by `deepSpaceRelayNetwork`. Its primary mechanical role is **re-enabling signal ticking** after the Era 2 pause. It also provides a small ongoing signal contribution (similar to a Deep Space Array but from space).

| Field | Value |
|---|---|
| `id` | `signalRelayStation` |
| `name` | Signal Relay Station |
| `era` | `nearSpace` |
| `description` | A dedicated signal analysis relay positioned in cislunar space, maintaining continuous contact with the outer-solar-system transmission. |
| `buildTime` | `1` turn |
| `cost` | `{ materials: 20, funding: 30 }` |
| `supplyUpkeep` | `1` |
| `requiredTechId` | `deepSpaceRelayNetwork` |
| `allowedNodeTypes` | `cislunarPoint`, `trojanPoint` (broad — player shouldn't have to hunt for a valid slot) |
| `output` | Physics +2, Mathematics +2 per turn (same shape as a Deep Space Array, but lighter) |

The low build cost and 1-turn construction mean an engaged player can have it running within their first or second nearSpace turn, which is the intent.

---

## New Technology: `interstellarSignalDecryption` (nearSpace, tier 4)

A new signal-derived tech is required in the nearSpace tier-4 slot. There are currently **no** signal-derived tier-4 nearSpace techs (only `quantumSensing` at tier 3).

**Proposed definition:**

| Field | Value |
|---|---|
| `id` | `interstellarSignalDecryption` |
| `name` | Interstellar Signal Decryption |
| `era` | `nearSpace` |
| `tier` | `4` |
| `signalDerived` | `true` |
| `requiredTechIds` | `quantumSensing`, `cislunarTransportNetwork` |
| `baseRecipe` | `physics: 120, mathematics: 100, computing: 80` |
| `recipeVariance` | `0.25` |
| `unlocksCards` | TBD — possibly a powerful signal analysis card |
| `unlocksFacilities` | `[]` |
| `unlocksProjects` | TBD |

**Narrative flavour:** The deep-space sensor network, operating at quantum sensitivity, has resolved the signal's nested encoding structure. The operational core — the part that describes *activation* rather than provenance — is now legible. What was noise is now instruction.

**rumourText:** "Quantum sensor arrays in cislunar space are detecting coherent substructure within the signal layers that ground-based analysis consistently classified as noise."

---

## Implementation Plan

### 34.0 — Add `signalRelayStation` facility to `src/data/facilities.ts` ✅

Add the new nearSpace facility definition with `requiredTechId: 'deepSpaceRelayNetwork'`, low cost, 1-turn build, and a small Physics/Math output. Its signal contribution flows through its field output (Physics/Math), not through `EARTH_SIGNAL_ARRAY_DEF_IDS` — see naming decision in blocker 7.

### 34.1 — Add `computeSignalCap()` to `signal.ts` ✅

Add a pure function that maps a set of discovered tech IDs to the applicable decode ceiling:

```typescript
export const SIGNAL_CAPS = {
  era1Gate: 'signalPatternAnalysis',
  era2Gate: 'interstellarSignalDecryption',
} as const;

export function computeSignalCap(discoveredTechIds: ReadonlySet<string>): number {
  if (!discoveredTechIds.has(SIGNAL_CAPS.era1Gate)) return 33;
  if (!discoveredTechIds.has(SIGNAL_CAPS.era2Gate)) return 66;
  return 100;
}
```

This function is the single source of truth for cap thresholds. Era 3 will extend it later.

### 34.2 — Add `isSignalPaused()` and extend `tickSignalProgress()` signature ✅

Add a helper to `signal.ts`:

```typescript
/** IDs of nearSpace/deepSpace facilities whose presence re-enables signal ticking. */
export const NEAR_SPACE_RELAY_DEF_IDS: ReadonlySet<string> = new Set([
  'signalRelayStation',
]);

/**
 * Returns true when the signal tick should produce zero progress this turn.
 * Currently: the player is in nearSpace (or later) but has no relay facility built.
 */
export function isSignalPaused(era: Era, facilities: FacilityInstance[], facilityDefs: Map<string, FacilityDef>): boolean {
  if (era === 'earth') return false;
  return !facilities.some((f) => {
    const def = facilityDefs.get(f.defId);
    return def !== undefined && NEAR_SPACE_RELAY_DEF_IDS.has(def.id);
  });
}
```

Modify `tickSignalProgress()` to accept `era` and `cap`:

```typescript
export function tickSignalProgress(
  signal: SignalState,
  fields: FieldPoints,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  era: Era,      // ← new
  cap: number,   // ← new
): SignalState
```

Inside, return early with no change if `isSignalPaused(era, facilities, facilityDefs)`. Otherwise clamp from `Math.min(100, ...)` to `Math.min(cap, ...)`.

### 34.3 — Apply the cap and pause in `turn.ts` (step 16) ✅

Compute the discovered tech set, derive the cap, clamp signal after project rewards (which also bypass the tick), then pass era and cap into the tick:

```typescript
const discoveredTechIds = new Set(
  state.techs.filter((t) => t.stage === 'discovered').map((t) => t.defId),
);
const signalCap = computeSignalCap(discoveredTechIds);

// Clamp signal-after-projects so one-time project boosts can't bypass the cap.
// Also enforce the pause — projects can't jump the relay-lock either.
const isPaused = isSignalPaused(state.era, newFacilities, facilityDefs);
const clampedSignalAfterProjects: SignalState = {
  ...signalAfterProjects,
  decodeProgress: isPaused
    ? signalAfterProjects.decodeProgress          // freeze if paused
    : Math.min(signalCap, signalAfterProjects.decodeProgress),
};

const newSignal = tickSignalProgress(
  clampedSignalAfterProjects,
  newFields,
  newFacilities,
  facilityDefs,
  state.era,
  signalCap,
);
```

### 34.4 — Add both new techs to `technologies.json` ✅

- `deepSpaceRelayNetwork` — Era 1 tier 5, unlocks `signalRelayStation`, requires `signalPatternAnalysis` + `internetProtocols`
- `interstellarSignalDecryption` — nearSpace tier 4, lifts 66% cap, requires `quantumSensing` + `cislunarTransportNetwork`

Full definitions per the tech tables above.

### 34.5 — Show cap markers on `SignalTrack.svelte` ✅

The progress bar should render a visual notch or marker at 33% and 66% when the corresponding gate tech has **not yet** been discovered. A locked gate marker (distinct from the current progress colour) communicates the ceiling to the player.

- Pass the current cap (or both gate states) as a prop or derive from the game store
- Render markers as thin vertical lines or labelled ticks on the bar

### 34.6 — Update tests in `signal.test.ts` ✅

All existing `tickSignalProgress` calls need the two new arguments. Add:

- `computeSignalCap` with no gates discovered → 33
- `computeSignalCap` with era1Gate only → 66
- `computeSignalCap` with both gates → 100
- `isSignalPaused` returns false when era is `earth`
- `isSignalPaused` returns true when era is `nearSpace` and no relay facility exists
- `isSignalPaused` returns false when era is `nearSpace` and relay facility is present
- `tickSignalProgress` with cap=33 stops at 33 even with high fields
- `tickSignalProgress` returns unchanged signal when paused (nearSpace, no relay)
- `tickSignalProgress` advances normally when relay is present in nearSpace

---

## Blockers & Challenges

### 1. Two separate code paths award signal progress
`tickSignalProgress` (continuous tick) and the project reward handler in `projects.ts` both increment `decodeProgress`. The project path bypasses the tick entirely. **The clamp in step 34.3 above handles this** — project rewards are clamped before the tick, and the pause check also blocks project boosts during the relay lock — but if the project system is ever called in other contexts (e.g., tests, direct save manipulation), neither the cap nor the pause will be applied. The clamp must live in `turn.ts`, not buried inside `tickSignalProgress` alone.

### 2. `tickSignalProgress` signature change breaks all existing tests
The function gains two required parameters (`era`, `cap`). Every existing call site in `signal.test.ts` must be updated. Low-risk but requires a full grep sweep.

### 3. The relay-lock must be communicated to the player
When signal ticking pauses at the Era 2 transition, the player needs to understand *why*. Two things are needed:
- A news item generated on the World Phase when the pause begins (similar to strength-threshold news): "Signal relay contact lost. Build a Signal Relay Station in cislunar space to re-establish contact."
- A UI indicator on `SignalTrack.svelte` distinguishing "capped" (progress bar hits a marker) from "paused" (bar shows a lock or dormant state).

### 4. Player feedback when capped (separate from paused)
The cap marker on `SignalTrack.svelte` (step 34.5) needs a tooltip or label identifying *which tech* is blocking progress. Two distinct visual states are needed: **paused** (relay not built) and **capped** (relay built, tech gate not cleared).

### 5. Era-strength thresholds interact with the cap
Currently `structured` triggers at 30% and `urgent` triggers at 70%. With the cap at 33%, players can reach `structured` but will plateau there until `signalPatternAnalysis` is cleared. `urgent` only unlocks after the 66% cap is lifted. This is intentional but needs to be reflected in news flavour text — the player shouldn't interpret "structured" as a sign that `urgent` is around the corner.

### 6. Era 3 gate is unimplemented
`computeSignalCap` returns 100 once both Era 1 and Era 2 gates are cleared. The Era 3 gate will require extending `computeSignalCap` and adding a deepSpace tech. The `isSignalPaused` function will also need extending when the deepSpace era is implemented — a second relay-lock will likely apply there too.

### 7. Naming: `EARTH_SIGNAL_ARRAY_DEF_IDS` and `NEAR_SPACE_RELAY_DEF_IDS` ✅ resolved
The old `DEEP_SPACE_ARRAY_DEF_IDS` name implied these facilities were *in* deep space, when they are earth-era ground facilities. Renamed in `signal.ts` to `EARTH_SIGNAL_ARRAY_DEF_IDS`. The new nearSpace set is `NEAR_SPACE_RELAY_DEF_IDS`. Both names now make era explicit. The relay facility's signal contribution flows through its field output (Physics/Math) rather than the `ARRAY_BONUS` mechanism — the `ARRAY_BONUS` path remains earth-era only, keeping the two eras' signal contributions structurally distinct. Save compatibility deliberately broken; old saves will need a new game.

### 8. Era 1 Tier 5 is a new tier position
`deepSpaceRelayNetwork` will be the only Tier 5 Era 1 tech. The `FUTURE_PHASES.md` already noted that "each Era should have a tier 5 technology that represents the end of the era" — so this is anticipated. However, the research recipe must be balanced carefully: it should feel like a capstone, discoverable only after Tier 4 techs are well established. The prerequisite chain (`signalPatternAnalysis` → `deepSpaceRelayNetwork`) ensures this sequencing.

---

## Cap Values

| State | Cap |
|---|---|
| Neither gate tech discovered | 33% |
| Only `signalPatternAnalysis` discovered | 66% |
| Both gate techs discovered | 100% (no cap) |
| Era 3 gate (future) | TBD — likely 90% or 95% |

---

## Files Touched

| File | Change |
|---|---|
| `src/engine/signal.ts` | Add `SIGNAL_RELAY_DEF_IDS`, `computeSignalCap()`, `isSignalPaused()`; extend `tickSignalProgress()` signature |
| `src/engine/turn.ts` | Compute `discoveredTechIds`, `signalCap`, `isPaused`; clamp project boosts; pass `era` + `cap` to tick; generate relay-loss news item |
| `src/engine/signal.test.ts` | Update all `tickSignalProgress` calls; add cap, pause, and relay tests |
| `src/data/technologies.json` | Add `deepSpaceRelayNetwork` (Era 1 tier 5) and `interstellarSignalDecryption` (nearSpace tier 4) |
| `src/data/facilities.ts` | Add `signalRelayStation` facility definition |
| `src/lib/components/SignalTrack.svelte` | Render cap markers (33%, 66%) and paused/locked state on progress bar |
