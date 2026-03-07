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

### Phase 3 — Research system ✅
- `research.ts`: seeded recipe generation (base ± variance), discovery stage transitions (unknown → rumour → progress → discovered), cross-field breakthrough detection ✅
- `requiresSimultaneous` distinction: breakthrough techs require ALL fields at 30% for rumour vs ANY field for standard techs ✅
- Research check wired into `turn.ts` World Phase; news feed entries generated for rumours, progress, and discoveries ✅
- 27 tests in `research.test.ts`; recipe seeding determinism and breakthrough detection verified ✅ (71 total)

### Phase 4 — Card system ✅
- `cards.ts`: drawCards (seeded shuffle + discard recycle), playCardFromHand, playCardAsCounter, bankCard/unbankCard (BANK_LIMIT=2), discardHand, addCardsToDeck, upgradeCard (zone-preserving), getActiveRestrictions/isActionRestricted ✅
- `events.ts`: getEligibleEvents (era/pushFactor/bloc filter), selectNewEvents (0–2/turn via RNG), tickEventCountdowns (auto-expire at 0), resolveEvent, applyEventEffect (resources/fields/restrictions), getEffectForResolution (mitigation scaling, counter nullification) ✅
- Full five-phase turn loop in `turn.ts`: executeEventPhase, executeDrawPhase, endBankPhase; Action+Bank phases are player-driven primitives ✅
- Card upgrades from tech discoveries wired into World Phase; PRNG call order documented in turn.ts ✅
- 51 new tests across `cards.test.ts` and `events.test.ts` (122 total) ✅

### Phase 6 — Svelte UI ✅
> Implemented before Phase 5 (no impact — the two phases are independent layers).
- `game.svelte.ts`: Svelte 5 rune-based game store; stub card/event/standing-action defs; full action handlers (playCard, bankCard, unbankCard, mitigateEvent, acceptEvent, declineEvent) ✅
- `HUD.svelte`: top bar — resources (Funding/Materials/Will), all six research fields, turn/year, era badge, phase badge, climate pressure bar, Will bar ✅
- `EventZone.svelte`: left panel — active events with countdown urgency colouring, response buttons per tier (mitigate/accept/decline/counter-hint), effect previews ✅
- `CardHand.svelte`: bottom panel — hand cards (play/bank) and bank cards (unbank), effect lines, counter tag indicator, bank decay notice ✅
- `StandingActions.svelte`: bottom-left — five standing action buttons, greyed when restricted or unaffordable, restriction lock icon ✅
- `ResearchFeed.svelte`: right panel — field progress bars (scaled to 200 pts), signal decode bar, scrollable news feed ✅
- `+page.svelte`: CSS grid layout (EventZone | map | ResearchFeed) + bottom row (StandingActions | CardHand) ✅

### Phase 5 — Earth map (Phaser) ✅
- `EarthScene.ts`: procedural flat-top hex grid (radius 3, 37 tiles), rendered with Phaser Graphics; type-based fill/stroke palette; productivity darkening; climate pressure red tint ✅
- Tile hit-testing via axial cube-rounding (accurate pixel → hex coordinate); hover highlight; click-to-select ✅
- Facility indicator: per-defId coloured circle; condition ring when degraded ✅
- `generateEarthTiles()` + deterministic `tileTypeForCoord()` in store (position-based hash, no RNG) ✅
- `game.svelte.ts`: added `STUB_FACILITY_DEFS` (5 types), `selectedCoordKey` UI state, `selectTile()`, `buildFacility()` (deducts cost, adds FacilityInstance, updates tile) ✅
- `FacilityPicker.svelte`: modal overlay showing eligible facilities for clicked tile type; affordability check; BUILD button commits to engine state ✅
- `MapContainer.svelte`: loads Phaser + EarthScene dynamically (SSR-safe); wires callbacks; hosts FacilityPicker overlay ✅
- `+page.svelte`: map-placeholder replaced by `<MapContainer>`; `build` standing action toggles tile selection ✅

### Phase 7 — Bloc simulation ✅
- `blocs.ts`: `initialiseBlocStates`, `simulateBlocs` (passive income, will drift via tickWill, field accumulation proportional to will, elimination checks), `checkBlocMergers` (news items when two blocs are weakened) ✅
- Elimination conditions: authoritarian will < willCollapsThreshold, universal will < 5, or resource exhaustion; news item generated on elimination ✅
- Periodic status news staggered per bloc (every 5 turns, offset by defId hash) ✅
- `blocs.ts` wired into `executeWorldPhase` (step 11); `blocDefs` parameter added; bloc news merged into player.newsFeed ✅
- `STUB_BLOC_DEFS` (4 blocs: NorthAmerica, EastAsia, SouthAmerica, AfricaCoalition) + `initialiseBlocStates` in game store; demo state includes live bloc simulation ✅
- `NewsTicker.svelte`: horizontally scrolling CSS-animated strip, duplicated content for seamless loop, aria-live for accessibility ✅
- 14 tests in `blocs.test.ts` (136 total) ✅

### Phase 8 — Board system ✅
- `board.ts`: `computeBoardModifiers`, `applyBoardFieldMultipliers`, `applyBoardResourceMultipliers` (multiplicative compounding across all active members) ✅
- `tickBoardAges` (retirement at 70, news item generated), `recruitBoardMember`, `removeBoardMember`, `getBoardAutoCounterTags`, `isBoardSlotVacant`, `getActiveMembers` ✅
- Board multipliers wired into `executeWorldPhase` (step 3 — applied to facility output before resource/field accumulation) ✅
- Board age ticking wired into `executeWorldPhase` (step 12 — retirement news merged into newsFeed) ✅
- `STUB_BOARD_DEFS` (7 members, one per role) + demo state seeded with 2 active members (chiefScientist, politicalLiaison) ✅
- `recruitMember(defId, startAge)` and `dismissMember(role)` in game store (cost: 15F + 10W) ✅
- `BoardPanel.svelte`: 7 collapsible role slots; active members show name/age/buffs/debuffs; vacant slots show recruit candidates ✅
- 25 tests in `board.test.ts` (147 total) ✅

### Phase 9 — Signal track ✅
- `signal.ts`: `computeSignalProgressDelta` (base + (physics+math)/50 + deepSpaceArrayCount×3), `computeEraStrength` (faint/structured/urgent by progress threshold), `tickSignalProgress`, `isSignalClimax` ✅
- `generateWormholeOptions`: 2 options if progress < 70, 3 if >= 70; correct option confidence hint scales with investment; seeded position via RNG ✅
- `commitSignalResponse`: locks state, sets `wormholeActivated` on correct answer; `didCrossStrengthThreshold` for news generation ✅
- Signal ticking wired into `executeWorldPhase` (step 14); strength-threshold crossings generate news feed entries ✅
- `deepSpaceArray` facility stub added; signal event stubs: `signalInterference` (earth) and `signalBreakthrough` (nearSpace/deepSpace) ✅
- `ResearchFeed.svelte`: wormhole climax UI with response option buttons, confidence hints, success/failure result ✅
- `getWormholeOptions()` and `commitWormholeResponse()` in game store ✅
- 30 tests in `signal.test.ts` (191 total) ✅

### Phase 10 — Near Space & Asteroid Belt ✅
- `SpaceScene.ts`: second Phaser scene; fixed node topology (LEO, L1, L2, Lunar Orbit, Lunar Surface); transit lines; Earth circle; same callback/hit-zone pattern as EarthScene ✅
- `AsteroidScene.ts`: node-graph renderer; 7 nodes (asteroid/jovianMoon/transitPoint/heliopause); unprospected nodes render as dim "?"; active/potential transit edges; dense star field ✅
- Scene switching via `game.scene.stop/start`; one Phaser Game instance holds all three scenes; each emits its own ready event for callback wiring ✅
- Scene tab bar in `MapContainer.svelte`: EARTH | NEAR SPACE | ASTEROID BELT; era-gated (locked with padlock icon); amber `DEV › ERA` button advances era without landmark projects (explicit dev scaffold, removed when Phase 11 lands) ✅
- `generateSpaceNodes()`, `generateBeltNodes()`, `generateBeltEdges()` in game store; `devAdvanceEra()`, `selectSpaceNode()`, `selectBeltNode()` actions; demo state populates all three map layers ✅

### Phase 11 — Victory & loss ✅
- `victory.ts`: checkers for all four victories (wormhole, ecologicalRestoration, economicHegemony, terraforming) and four loss conditions (climateCollapse, signalMisinterpretation, politicalCollapse, resourceExhaustion) ✅
- `checkVictoryConditions` wired into `executeWorldPhase` step 16 (after all state updates); losses take priority over simultaneous victories ✅
- `tickEarthWelfare` wired into World Phase step 15; decays with climate pressure, recovers with Earth-based facilities ✅
- `abandonedEarth` moral outcome appended to any victory when earthWelfareScore < 40 ✅
- `resourceExhaustion` added to `LossCondition` type (all three resource pools simultaneously ≤ 0) ✅
- `/summary` route: post-game summary with victory/loss banner, condition description, Abandoned Earth warning, stat table (turn/year/era/resources/fields), PLAY AGAIN button ✅
- `game.svelte.ts`: `advancePhase()` detects outcome after World Phase and navigates to `/summary`; `resetGame()` action clears all state ✅
- 37 tests in `victory.test.ts` (228 total) ✅

### Phase 12 — Save system & seeded runs ✅
- `GameState` serializes to JSON with `JSON.stringify` (no special handling needed if types are designed correctly) ✅
- `localStorage` auto-save on every World Phase ✅
- Export to file / import from file ✅
- Seed display on HUD; shareable seed string ✅

### Content pass (parallel with phases 2–12) ✅
- All facility definitions in `src/data/facilities.ts` ✅
- Technology list with base recipe shapes in `src/data/technologies.ts` — deferred (no TechDef content yet)
- Card definitions (normal use + counter use) in `src/data/cards.ts` ✅
- Event definitions with pool tags (bloc-specific, era-gated, push-factor-gated) in `src/data/events.ts` ✅
- All six bloc starting profiles in `src/data/blocs.ts` ✅ (7 blocs defined)

---

## Key risks

1. **Phaser SSR conflict** — guard all Phaser imports with `if (browser)` (SvelteKit's `$app/environment`) or use dynamic `import()` inside `onMount`.
2. **State sync between engine and Phaser** — Phaser scenes cannot subscribe to Svelte stores directly. Solution: a simple event emitter in `state.ts` that fires `'worldPhaseComplete'`; Phaser scenes listen to this and re-render tiles.
3. **PRNG call order** — tech recipe generation, event selection, bloc simulation, and climate events all draw from the same PRNG stream. The order must be fixed and documented, or seed reproducibility breaks. Define a canonical call order in `turn.ts` and test it.
4. **Hex adjacency performance** — pre-compute the adjacency table for all tiles at map load time and cache it. Do not recalculate on every tick.
