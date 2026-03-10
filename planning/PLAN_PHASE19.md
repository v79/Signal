# Phase 19 — Narrative Interface

## Summary of decisions
- Narrative modals are **fully blocking** (no background interaction while open)
- All narrative is **close-only** (informational); only the new-game opening sequence has a **Skip** button
- Content lives in: `TechDef` (tech unlocks), `FacilityDef` (unique facility builds), `src/data/narrative.ts` (opening sequence, win/lose, era transitions, signal decode stages)
- All technology discoveries trigger a popup
- Major landmarks: signal decode stages, era transitions, first build of a unique facility
- Game tracks seen narratives in `GameState` (persisted in save envelope)
- Narrative choices and in-game action triggers are **deferred to a future phase**
- No art assets — placeholder coloured panels only

---

## New types (`src/engine/types.ts`)

```typescript
interface NarrativeSlide {
  text: string;
  imageColour?: string; // CSS colour string for placeholder panel
}

interface NarrativeDef {
  id: string;
  title: string;
  slides: NarrativeSlide[];
  skippable?: boolean; // true only for new-game opening sequence
}
```

Add to `TechDef`:
```typescript
narrative?: NarrativeDef;
```

Add to `FacilityDef`:
```typescript
unique?: boolean;         // can only be built once per run
narrative?: NarrativeDef; // shown on first (and only) build
```

Add to `GameState`:
```typescript
seenNarrativeIds: string[];    // prevents re-trigger after save/load
narrativeQueue: NarrativeDef[]; // pending modals, processed one at a time
```

---

## Sub-tasks

### 19.1 — Engine + data foundations ✅ COMPLETE
- Add `NarrativeSlide`, `NarrativeDef` types to `src/engine/types.ts`
- Add `narrative?` field to `TechDef` and `FacilityDef`
- Add `unique?` to `FacilityDef`; enforce in facility build logic (engine + store) — attempting to build a second unique facility is a no-op
- Add `seenNarrativeIds: string[]` and `narrativeQueue: NarrativeDef[]` to `GameState` and `createGameState`; update `serialiseGameState`, `deserialiseGameState`, and `validateSave`
- Write engine helper: `enqueueNarrative(state, def): GameState` — adds to queue only if `def.id` is not already in `seenNarrativeIds`

### 19.2 — `NarrativeModal.svelte` component ✅ COMPLETE
- Large but not fullscreen — approximately 80% of the viewport, centred, with a darkened backdrop blocking all background interaction
- Title + paginated slides with Next / Back navigation
- Placeholder image panel: a coloured rectangle, visible only when `imageColour` is set on the current slide
- Close button always present on the final slide
- Skip button rendered only when `skippable: true`
- On close or skip: mark narrative id as seen in `seenNarrativeIds`, dequeue, show next narrative in queue if any
- Rendered from `+page.svelte` whenever `narrativeQueue` is non-empty

### 19.3 — Narrative data (`src/data/narrative.ts`) ✅ COMPLETE
New standalone data file containing:
- **Opening sequence** (skippable): 3–5 slides setting the alt-history scene — 1970, the moon landing, the first satellite anomalies detected in the signal
- **Era transition narratives**: `earth→nearSpace`, `nearSpace→deepSpace`
- **Signal decode stage narratives**: one per decode stage
- **Win narrative**: wormhole activation
- **Loss narratives**: one per loss condition (funding collapse, political will collapse, etc.)

### ~~19.4 — Narrative text for tech and unique facility defs~~ ✅ COMPLETE
- Add `narrative` to all 12 `TECH_DEFS` entries in `src/data/technologies.ts`
- Identify which facilities should be `unique: true` and add `narrative` to those entries in `src/data/facilities.ts` (candidates: Deep Space Array, HQ, Heliopause Relay)
- Unique facilities that have already been built show their build button **disabled** with a tooltip explaining they can only be built once

### ~~19.5 — Trigger integration~~ ✅ COMPLETE
Wire `enqueueNarrative` into the appropriate points:
- **Tech discovery** (game store `advancePhase`): after world phase, compare before/after techs, enqueue narrative for each newly discovered tech with a narrative def
- **Signal decode stage** (game store `advancePhase`): on stage crossing 30% → `NARRATIVE_SIGNAL_STRUCTURED`, 70% → `NARRATIVE_SIGNAL_URGENT`
- **Unique facility completion** (game store `advancePhase`): detect newly added facilities after world phase tick; enqueue def.narrative if def.unique
- **Era transition** (game store `advancePhase`): on era change, enqueue `NARRATIVE_ERA_NEARSPACE` or `NARRATIVE_ERA_DEEPSPACE`
- Queue order: tech unlock → signal progress → unique facility → era transition
- **Win/lose** (`/summary` page): `NarrativeModal` shown on page load using `VICTORY_NARRATIVES`/`LOSS_NARRATIVES` lookup, dismissed with local state

### ~~19.6 — Opening sequence on `/newgame`~~ ✅ COMPLETE
- Before the bloc selection UI renders, show the opening `NarrativeDef` as a modal (skippable)
- Not gated by `seenNarrativeIds` — the game state does not exist yet at this point
- After close or skip, reveal the bloc selection UI as normal

---

## Explicitly out of scope for this phase
- Narrative choices and in-game action triggers
- Real artwork or image assets
- Narrative fields on `EventDef` (deferred until event system is more mature)
