# Phase 13 — New Game Flow

## Context

The game currently has no way to start a fresh run. Every session either loads a saved game from localStorage or falls back to a hardcoded demo state (`createDemoState()`) fixed at Turn 3 with pre-set cards, events, and board members. Players cannot choose their bloc, push factor, or seed. The summary screen's "PLAY AGAIN" button calls `resetGame()` which just reloads the same demo state. This phase replaces all of that with a proper new-game setup screen and a clean game initialisation flow.

---

## What Changes

### New: `src/routes/newgame/+page.svelte` ✓

A setup screen before the main game, following the Signal dark-monospace aesthetic.

Sections:
1. **Seed** — Pre-filled with a random 8-char hex string (generated from `Date.now()` + `Math.random()`). Editable text input. Refresh button to regenerate. Paste-friendly for sharing seeded runs.
2. **Bloc selection** — Horizontal cards (or stacked list) for each entry in `BLOC_DEFS`. Each card shows: name, willProfile badge (DEMOCRATIC / AUTHORITARIAN), victoryBias, and starting resource levels as small bars. One bloc is selected at a time (click to select, highlighted border).
3. **Push factor** — Two toggle buttons: `CLIMATE CHANGE` and `GEOPOLITICAL TENSION` with brief description lines.
4. **BEGIN MISSION →** — Calls `gameStore.startNewGame(seed, blocDefId, pushFactor)`, which navigates to `/`.

No form validation beyond requiring a bloc and push factor to be selected (both have defaults so the button is always enabled).

### Modified: `src/lib/stores/game.svelte.ts` ✓

**Add `startNewGame(seed, playerBlocDefId, pushFactor)`:** ✓
- Looks up the chosen bloc from `BLOC_DEFS`
- Builds a `GameConfig` from bloc fields: `willProfile`, `startingWill` (70% of `willCeiling`), `startingResources`, `startingFields`
- Calls `createGameState(config)` for the base state
- Populates map: `generateEarthTiles(3)`, `generateSpaceNodes()`, `generateBeltNodes()`, `generateBeltEdges()`
- Initialises NPC blocs: `initialiseBlocStates([...BLOC_DEFS.values()])`
- Seeds a starter deck (5 cards: `lobbying`, `publicAppeal`, `emergencyProcurement`, `coalitionBuilding`, `academicConference` — all in `'deck'` zone)
- Runs `executeDrawPhase(state, rng)` to deal the initial hand before setting phase to `'action'`
- Calls `clearSave()` to wipe any existing auto-save
- Sets `_state` and resets UI selection state
- Calls `goto('/')`

**Remove `createDemoState()`** ✓ — replaced by `startNewGame`.

**Remove `devAdvanceEra()`** ✓ — dev scaffold noted for removal since Phase 11.

**Update `resetGame()`** ✓ — instead of loading demo state, call `goto('/newgame')`.

**Update store initialisation:** ✓
```typescript
// Before:
const _savedState = autoLoad();
let _state = $state<GameState>(_savedState ?? createDemoState());

// After:
const _savedState = autoLoad();
let _state = $state<GameState | null>(_savedState ?? null);
```
`state` getter returns `GameState | null`. The main page handles the null case.

### Modified: `src/routes/+page.svelte` ✓

Add an `onMount` redirect: if `gameStore.state` is `null`, navigate to `/newgame`. This handles cold starts with no saved game. All component bindings are guarded with `gameStore.state &&` or the redirect ensures state exists before the page renders.

### Modified: `src/routes/summary/+page.svelte` ✓

Change "PLAY AGAIN" from `gameStore.resetGame()` to `goto('/newgame')` directly (or via `resetGame()` once that redirects).

### Modified: `src/lib/components/MapContainer.svelte` ✓

Remove the `DEV › ERA` button that calls `devAdvanceEra()`.

---

## Starter Deck

For every new game, the player receives these 5 cards (all zone `'deck'`):
- `lobbying` × 2
- `publicAppeal` × 1
- `emergencyProcurement` × 1
- `coalitionBuilding` × 1

IDs are generated as `${defId}-1`, `${defId}-2` etc. The first `executeDrawPhase` call (inside `startNewGame`) draws 4 of these into hand using the seeded RNG, leaving 1 in deck.

---

## File Map

| File | Change |
|---|---|
| `src/routes/newgame/+page.svelte` | ✓ **NEW** — setup screen |
| `src/lib/stores/game.svelte.ts` | ✓ Add `startNewGame`; remove `createDemoState` + `devAdvanceEra`; update `resetGame`; update init |
| `src/routes/+page.svelte` | ✓ Add null-state redirect to `/newgame` on mount |
| `src/routes/summary/+page.svelte` | ✓ "PLAY AGAIN" → `/newgame` |
| `src/lib/components/MapContainer.svelte` | ✓ Remove DEV ERA button |

---

## Key Reused Functions

- `createGameState(config)` — `src/engine/state.ts` (already exists)
- `initialiseBlocStates(blocs)` — `src/engine/blocs.ts` (already exists)
- `executeDrawPhase(state, rng)` — `src/engine/turn.ts` (already exists)
- `createRng(seed)` — `src/engine/rng.ts` (already exists)
- `clearSave()` — `src/engine/save.ts` (already exists)
- `generateEarthTiles`, `generateSpaceNodes`, `generateBeltNodes`, `generateBeltEdges` — `src/lib/stores/game.svelte.ts`
- `BLOC_DEFS` — `src/data/blocs.ts`

---

## Verification

1. ✓ `npm run lint` — zero errors after changes (type-check null-state handling carefully)
2. ✓ `npm run test:run` — 259 tests still passing (no engine changes)
3. Manual smoke test:
   - Cold start (no localStorage save) → redirects to `/newgame`
   - Select a bloc + push factor, click BEGIN MISSION → game starts at Turn 1, Action phase, with cards in hand
   - Seed is visible in HUD matching what was entered on setup screen
   - Complete a turn → auto-save writes to localStorage; reload → resumes from save
   - Summary screen "PLAY AGAIN" → `/newgame`, not demo state
   - `/newgame` has all 7 blocs selectable
   - Seeded run: enter same seed twice, pick same bloc/push factor → identical starting hand order
