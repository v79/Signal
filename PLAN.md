# Signal — Implementation Plan

## Architecture Overview

### Layer separation

Three distinct layers, each with clear responsibilities:

```
src/engine/     # Pure TypeScript — game logic, zero framework deps
src/data/       # Content definitions — facilities, techs, cards, events, blocs
src/phaser/     # Phaser scenes — map rendering only
src/lib/        # Svelte components + stores — all UI overlays
src/routes/     # SvelteKit pages
```

The **engine** is the single source of truth. It never imports Svelte or Phaser. This means all logic is trivially testable with Vitest and the entire `GameState` is a plain JSON-serializable object (enabling the save system and seeded runs for free).

**Svelte stores** wrap engine state so UI components react to changes. **Phaser scenes** subscribe to state changes via a lightweight event emitter and re-render when the World Phase resolves.

### Phaser + SvelteKit integration

Phaser conflicts with SSR (it uses browser APIs). The `MapContainer.svelte` component dynamically imports Phaser and mounts it in a `<div>` only on the client. Svelte UI overlays (card hand, HUD, event zone) sit in a `<div>` layered above the canvas with `pointer-events` managed carefully so clicks reach Phaser when the map is active.

### Seeded PRNG

A `mulberry32` PRNG initialised from the seed hash drives all randomness: tech recipe generation, climate degradation scheduling, bloc simulation, event selection, card draw order. PRNG calls must happen in a fixed, documented order per phase — this discipline is what makes seeded runs reproducible.

---

## Module plan (`src/engine/`)

| Module | Responsibility |
|---|---|
| `types.ts` | All TypeScript interfaces — `GameState`, `Facility`, `Technology`, `Card`, `Event`, `Bloc`, `BoardMember`, etc. |
| `rng.ts` | Seedable PRNG; `createRng(seed)` returns a stateful generator |
| `state.ts` | `createGameState(config)` factory; root state shape |
| `resources.ts` | Resource tick: Funding, Materials, Will; bloc-type Will modifiers |
| `research.ts` | Field accumulation from facilities + played cards; recipe checking; discovery stage transitions; cross-field breakthrough detection |
| `cards.ts` | Deck management; draw; bank (with decay); counter resolution; standing action restriction state |
| `events.ts` | Event pool management; countdown tick; event resolution tiers |
| `facilities.ts` | Facility effect computation; adjacency bonus/penalty table; mine depletion |
| `projects.ts` | Project availability checks; completion reward application; landmark project era gates |
| `map.ts` | Hex tile state; adjacency lookup (pre-computed); climate degradation scheduling and application |
| `blocs.ts` | NPC bloc simulation step; decline/elimination; merger event generation |
| `board.ts` | Character lifecycle (age, retire, resign, die); buff/debuff application pipeline |
| `signal.ts` | Decoding progress track; era signal strength; wormhole climax option generation |
| `victory.ts` | All victory and loss condition checks; Abandoned Earth metric |
| `turn.ts` | Five-phase orchestrator: calls each subsystem in order |

---

## Implementation phases

### Phase 1 — Foundation ✅
- Scaffold SvelteKit + Vite project ✅
- Add Phaser as a client-only dynamic import (`MapContainer.svelte`) ✅
- Configure Vitest ✅
- Implement `rng.ts` (mulberry32 + djb2 string hashing) with 10 tests ✅
- Define all TypeScript interfaces in `types.ts` ✅
- Implement `state.ts` factory (`createGameState`, `serialise/deserialise`) ✅

### Phase 2 — Engine core (no rendering) ✅
- `resources.ts`: resource tick, Will volatility model (democratic vs authoritarian drift rates, ceilings) ✅
- `facilities.ts`: facility output scaled by condition + tile productivity, hex adjacency computation, mine depletion ✅
- `turn.ts`: World Phase orchestrator (facilities → resources → Will → depletion → climate pressure) ✅
- 34 tests across `facilities.test.ts` and `resources.test.ts` (44 total) ✅

### Phase 3 — Research system
- `research.ts`: field accumulation from facility output, seeded recipe generation with stable "shapes" (base thresholds randomised ±20%), discovery stage transitions, cross-field breakthrough detection
- Vitest: recipe seeding is deterministic, breakthrough detection fires correctly

### Phase 4 — Card system
- `cards.ts`: deck, draw, bank (cap 2, decay 1 Funding/card/turn), counter mechanic, standing action restriction flags
- `events.ts`: event pool, countdown tick, three response tiers
- Full turn loop in `turn.ts`: Event → Draw → Action → Bank → World

### Phase 5 — Earth map (Phaser)
- `EarthScene.ts`: load Tiled hex JSON, render tiles with type-based colour/saturation palette
- Facility placement: click tile → select facility type → validate → commit to engine state
- Climate degradation: tile visual state updates each World Phase
- Adjacency bonus highlight on facility hover

### Phase 6 — Svelte UI
- `HUD.svelte`: resources, research fields, turn/year counter, era indicator
- `CardHand.svelte`: drawn cards, drag-to-play or click-to-play
- `EventZone.svelte`: active events with countdown, counter/mitigate/accept/decline actions
- `StandingActions.svelte`: always-visible toolbar, greyed out when restricted
- `ResearchFeed.svelte`: Rumour and Progress notifications as they fire

### Phase 7 — Bloc simulation
- `blocs.ts`: per-turn simulation step; weighted decision rules; decline thresholds
- Bloc elimination and merger event generation
- News ticker component (Svelte)
- Diplomatic event cards appear in Event Zone

### Phase 8 — Board system
- `board.ts`: character pool; lifecycle events; buff/debuff applied as multipliers/modifiers in `resources.ts` and `research.ts`
- Character acquisition events wired into event pool
- Board panel UI (Svelte)

### Phase 9 — Signal track
- `signal.ts`: decoding progress fed by Physics + Mathematics + Deep Space Array count; era strength levels; wormhole climax generates 2–3 candidate response options (count and confidence determined by signal investment)
- Signal events wired into event pool per era

### Phase 10 — Near Space & Asteroid Belt
- `SpaceScene.ts`: second Phaser scene, distance-based adjacency, no climate degradation
- `AsteroidScene.ts`: node graph renderer (custom Phaser Graphics, not tilemap)
- Scene switching triggered by landmark project completions

### Phase 11 — Victory & loss
- `victory.ts`: checkers for all four victories and four loss conditions, called at end of World Phase
- Post-game summary screen (Svelte route)
- Abandoned Earth metric tracked throughout (Earth welfare score alongside space investment)

### Phase 12 — Save system & seeded runs
- `GameState` serializes to JSON with `JSON.stringify` (no special handling needed if types are designed correctly)
- `localStorage` auto-save on every World Phase
- Export to file / import from file
- Seed display on HUD; shareable seed string

### Content pass (parallel with phases 2–12)
- All facility definitions in `src/data/facilities.ts`
- Technology list with base recipe shapes in `src/data/technologies.ts`
- Card definitions (normal use + counter use) in `src/data/cards.ts`
- Event definitions with pool tags (bloc-specific, era-gated, push-factor-gated) in `src/data/events.ts`
- All six bloc starting profiles in `src/data/blocs.ts`

---

## Key risks

1. **Phaser SSR conflict** — guard all Phaser imports with `if (browser)` (SvelteKit's `$app/environment`) or use dynamic `import()` inside `onMount`.
2. **State sync between engine and Phaser** — Phaser scenes cannot subscribe to Svelte stores directly. Solution: a simple event emitter in `state.ts` that fires `'worldPhaseComplete'`; Phaser scenes listen to this and re-render tiles.
3. **PRNG call order** — tech recipe generation, event selection, bloc simulation, and climate events all draw from the same PRNG stream. The order must be fixed and documented, or seed reproducibility breaks. Define a canonical call order in `turn.ts` and test it.
4. **Hex adjacency performance** — pre-compute the adjacency table for all tiles at map load time and cache it. Do not recalculate on every tick.
