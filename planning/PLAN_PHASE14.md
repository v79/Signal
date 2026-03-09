# Phase 14 — Content Pass: Era 1 Technologies, 1970 Start & Signal Narrative

## Context

The engine fully supports the technology system (`TechDef`, `TechState`, `generateTechRecipes`,
`checkResearchProgress`, card upgrades on discovery) but `src/data/technologies.ts` does not exist.
This phase authors the Era 1 technology tree only. Future content passes will add Era 2 and Era 3
technologies.

### Full game timeline (all three eras)

| Era                      | Years      | Turns  | Content phase                |
| ------------------------ | ---------- | ------ | ---------------------------- |
| Era 1 — Earth            | 1970–2010  | 1–40   | **Phase 14** (this document) |
| Era 2 — Near Space (LEO) | ~2010–2055 | 41–85  | Phase 15 (future)            |
| Era 3 — Asteroid Belt    | ~2055–2100 | 86–130 | Phase 16 (future)            |

The full game, start to wormhole climax, spans roughly 130 turns / 130 years. Victory or loss can
cut it short in any era.

---

## Turn / Year Mapping (Era 1)

`turn.ts` advances `year` by 1 each World Phase. Setting `startYear: 1970` gives:

| Turn  | Year      | Approximate milestone                                 |
| ----- | --------- | ----------------------------------------------------- |
| 1     | 1970      | Game start — Apollo era, early space race             |
| 2     | 1971      | Signal first detected (news item)                     |
| 10    | 1979      | Tier 1 techs discoverable; first computing facilities |
| 20    | 1989      | Tier 2 techs; personal computing arrives              |
| 30    | 1999      | Tier 3 techs; internet protocols, signal pattern work |
| 38–40 | 2007–2009 | `orbitalMechanics` breakthrough — Era 2 gate opens    |

---

## 1. Year Change

**File:** `src/lib/stores/game.svelte.ts`

Change `startYear: 2025` → `startYear: 1970` in `startNewGame()`.

No other engine changes needed — `year` is cosmetic display only.

---

## 2. Signal First Detection — Narrative Hook

**File:** `src/lib/stores/game.svelte.ts` — inside `startNewGame()`, after `executeDrawPhase`

Pre-populate `next.player.newsFeed` with two narrative news items:

```typescript
const signalNews: NewsItem[] = [
  {
    id: 'signal-origin-0',
    turn: 1,
    text: '1970 — Programme initiated. Our remit: achieve strategic parity in space operations within the decade.',
  },
  {
    id: 'signal-origin-1',
    turn: 2,
    text: '1971 — CLASSIFIED. Radio telescope array has recorded a structured 21 cm transmission of apparent non-terrestrial origin. Signal source: beyond the heliopause. Repetition interval: 73.6 hours. Assessment: not natural. Distribution: programme directors only.',
  },
];
next = { ...next, player: { ...next.player, newsFeed: signalNews } };
```

This surfaces in the news ticker immediately on new game. No engine state changes — the signal track
starts at `decodeProgress: 0` as normal. The news items are narrative framing only.

---

## 3. Bloc Starting Values — 1970 Baseline

**File:** `src/data/blocs.ts`

Adjust `startingFields` to reflect 1970s-era knowledge baselines. Computing was nascent; physics
and engineering dominated the space-race powers. Resources stay roughly the same (abstract units).

| Bloc            | Old startingFields                              | New startingFields                             |
| --------------- | ----------------------------------------------- | ---------------------------------------------- |
| northAmerica    | engineering: 20, computing: 15                  | physics: 15, engineering: 20                   |
| eastAsia        | engineering: 25, mathematics: 10                | engineering: 25, physics: 8                    |
| southAmerica    | biochemistry: 15, socialScience: 10             | biochemistry: 12, socialScience: 10            |
| africaCoalition | socialScience: 12, biochemistry: 8              | socialScience: 10, biochemistry: 6             |
| eurozone        | socialScience: 18, physics: 12, mathematics: 10 | physics: 18, mathematics: 12, socialScience: 8 |
| southAsia       | mathematics: 20, computing: 14                  | mathematics: 15, engineering: 10               |
| middleEast      | engineering: 15, computing: 10                  | engineering: 12, physics: 5                    |

---

## 4. New File: `src/data/technologies.ts`

12 `TechDef` entries covering Era 1 (1970–2010). All have `era` framing appropriate for Earth.
Technologies for Near Space and Asteroid Belt are deferred to Phase 15 and Phase 16 respectively.

### Field accumulation reference (rough per-turn rates with active facilities)

| Field         | Main facility                                           | Rate with 1 facility | Rate with 2 |
| ------------- | ------------------------------------------------------- | -------------------- | ----------- |
| physics       | researchLab (3) + deepSpaceArray (5)                    | 3–5                  | 8–13        |
| mathematics   | researchLab (2), computingHub (3), publicUniversity (2) | 2–3                  | 5–8         |
| engineering   | engineeringWorks (4)                                    | 4                    | 8           |
| computing     | computingHub (6)                                        | 6                    | 12          |
| biochemistry  | bioResearchCentre (5)                                   | 5                    | —           |
| socialScience | publicUniversity (3), bioResearchCentre (2)             | 3–5                  | —           |

**Signal decode rate:** `0.25 + (physics + mathematics) / 50 + deepSpaceArrayCount × 3`
`'structured'` threshold: 30 decode pts. With early deepSpaceArray investment, reachable ~turn 8–15.

### Threshold design targets (40-turn Era 1)

- **Tier 1** (~30–60 pts): turns 5–12 (years 1975–1982) — early computing + rocket foundations
- **Tier 2** (~75–120 pts): turns 12–22 (years 1982–1992) — orbital era + digital tools
- **Tier 3** (~120–160 pts): turns 22–34 (years 1992–2004) — internet, robotics, signal work
- **Tier 4** (~180–200 pts, simultaneous): turns 30–40 (years 2000–2010) — Era 2 gate

---

### Tier 1 — Foundation Technologies (1975–1982)

**`integratedCircuits`**

- name: "Integrated Circuit Arrays"
- rumourText: "Miniaturised components are being tested that may replace entire banks of discrete transistors."
- baseRecipe: `{ engineering: 40, computing: 25 }`
- recipeVariance: 0.20
- requiresSimultaneous: false
- unlocksCards: `['softwareGrant']`
- unlocksFacilities: `[]`
- signalDerived: false

**`rocketGuidanceSystems`**

- name: "Precision Rocket Guidance"
- rumourText: "Navigation accuracy beyond the atmosphere may soon allow reliable orbital insertion on first attempt."
- baseRecipe: `{ physics: 35, mathematics: 30, engineering: 40 }`
- recipeVariance: 0.15
- requiresSimultaneous: false
- unlocksCards: `[]`
- unlocksFacilities: `[]`
- signalDerived: false

**`satelliteCommunications`**

- name: "Satellite Communications"
- rumourText: "A relay station in orbit could link every ground facility on the globe simultaneously."
- baseRecipe: `{ physics: 45, engineering: 50 }`
- recipeVariance: 0.20
- requiresSimultaneous: false
- unlocksCards: `['globalBroadcast']`
- unlocksFacilities: `[]`
- signalDerived: false

**`microprocessors`**

- name: "Microprocessor Architecture"
- rumourText: "A single chip carrying a complete instruction set has been demonstrated in prototype form."
- baseRecipe: `{ computing: 55, mathematics: 40 }`
- recipeVariance: 0.20
- requiresSimultaneous: false
- unlocksCards: `['computerModellingRun']`
- unlocksFacilities: `[]`
- signalDerived: false

---

### Tier 2 — Orbital Era Technologies (1982–1992)

**`personalComputing`**

- name: "Personal Computing"
- rumourText: "Desktop machines with sufficient power for scientific calculation may reach civilian researchers within years."
- baseRecipe: `{ computing: 80, socialScience: 45 }`
- recipeVariance: 0.25
- requiresSimultaneous: false
- unlocksCards: `['digitalCoordination']`
- unlocksFacilities: `[]`
- signalDerived: false

**`geneticSequencing`**

- name: "Genetic Sequencing Technology"
- rumourText: "The chemical language of DNA is almost legible — automated reading may be possible within a decade."
- baseRecipe: `{ biochemistry: 75, computing: 55 }`
- recipeVariance: 0.25
- requiresSimultaneous: false
- unlocksCards: `['biomedicalAdvance']`
- unlocksFacilities: `[]`
- signalDerived: false

**`globalPositioningNetwork`**

- name: "Global Positioning Network"
- rumourText: "A constellation of precision timing satellites could yield metre-accuracy navigation across the entire planet."
- baseRecipe: `{ mathematics: 85, physics: 65, computing: 60 }`
- recipeVariance: 0.15
- requiresSimultaneous: false
- unlocksCards: `[]`
- unlocksFacilities: `[]`
- signalDerived: false

**`roboticsAutomation`**

- name: "Robotics and Remote Automation"
- rumourText: "Articulated machines capable of sustained remote operation in hostile environments have passed field trials."
- baseRecipe: `{ engineering: 90, computing: 70 }`
- recipeVariance: 0.20
- requiresSimultaneous: false
- unlocksCards: `[]`
- unlocksFacilities: `[]`
- signalDerived: false
- _Note: full facility unlocks (asteroid miners) deferred to Phase 15/16 when those eras are in scope._

---

### Tier 3 — Digital Age & Signal Foundations (1992–2004)

**`internetProtocols`**

- name: "Global Internetwork Protocols"
- rumourText: "A common packet-routing standard may allow every research facility on Earth to share data in real time."
- baseRecipe: `{ computing: 130, mathematics: 95 }`
- recipeVariance: 0.20
- requiresSimultaneous: false
- unlocksCards: `['openSourceResearch']`
- unlocksFacilities: `[]`
- signalDerived: false

**`digitisedTelemetry`**

- name: "Digitised Space Telemetry"
- rumourText: "Standardised digital transmission formats for deep-space probes would dramatically improve the precision of signal analysis."
- baseRecipe: `{ physics: 120, computing: 100, mathematics: 85 }`
- recipeVariance: 0.15
- requiresSimultaneous: false
- unlocksCards: `['signalDeconvolution']`
- unlocksFacilities: `[]`
- signalDerived: false

**`signalPatternAnalysis`** ← signal-derived

- name: "Signal Pattern Analysis"
- rumourText: "The transmission is not random. The interval structure repeats at a period inconsistent with any known pulsar or natural source."
- baseRecipe: `{ computing: 150, mathematics: 125, physics: 100 }`
- recipeVariance: 0.10
- requiresSimultaneous: **true**
- unlocksCards: `[]`
- unlocksFacilities: `[]`
- signalDerived: **true**
- _Only enters the rumour pool once `signal.eraStrength >= 'structured'` (decodeProgress ≥ 30)._
- _With a deepSpaceArray and physics investment, 'structured' is reachable around turns 8–15 — this tech enters the pool early but its field thresholds mean discovery is still a late-game achievement._

---

### Tier 4 — Era Gate (2000–2010)

**`orbitalMechanics`**

- name: "Applied Orbital Mechanics"
- rumourText: "Sustained human habitation in low orbit is within theoretical reach — the mathematics now; the engineering must follow."
- baseRecipe: `{ physics: 200, mathematics: 140 }`
- recipeVariance: 0.15
- requiresSimultaneous: **true** ← cross-field breakthrough; both must clear simultaneously
- unlocksCards: `[]`
- unlocksFacilities: `['orbitalPlatform']`
- signalDerived: false
- _This is the Era 2 gate tech. Discovering it makes the orbitalPlatform facility available,_
  _signalling that Near Space operations are within reach. The player will still need a landmark_
  _project (Phase 15 scope) to formally transition the era._
- _Threshold design: physics 200 (achievable ~turn 20+ with deepSpaceArray) and mathematics 140_
  _(achievable ~turn 28–35 with computingHub + researchLab). The simultaneous requirement means_
  _the player must invest in both fields, not neglect mathematics for physics._

---

## 5. New Cards Unlocked by Technologies

**File:** `src/data/cards.ts` — append these 7 entries to `CARD_DEFS`. All `era: 'earth'`.

| id                     | name                          | effect                                                      | counterEffect                                                                       | unlocked by             |
| ---------------------- | ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| `softwareGrant`        | Software Development Grant    | fields: { computing: 10, mathematics: 5 }                   | null                                                                                | integratedCircuits      |
| `globalBroadcast`      | Global Broadcast              | resources: { politicalWill: 10, funding: 8 }                | countersEventTag: 'interference', cost: { politicalWill: 8 }, fullNeutralise: false | satelliteCommunications |
| `computerModellingRun` | Computer Modelling Run        | fields: { physics: 10, mathematics: 8, computing: 5 }       | null                                                                                | microprocessors         |
| `digitalCoordination`  | Digital Coordination Network  | fields: { computing: 8, socialScience: 6, mathematics: 4 }  | null                                                                                | personalComputing       |
| `biomedicalAdvance`    | Biomedical Advance            | fields: { biochemistry: 12, socialScience: 5 }              | null                                                                                | geneticSequencing       |
| `openSourceResearch`   | Open-Source Research Platform | fields: { computing: 10, socialScience: 8, mathematics: 6 } | null                                                                                | internetProtocols       |
| `signalDeconvolution`  | Signal Deconvolution Run      | signalProgress: 8, fields: { physics: 5, computing: 5 }     | countersEventTag: 'signal', additionalCost: {}, fullNeutralise: false               | digitisedTelemetry      |

Flavour text and descriptions to be written at implementation time, consistent with the cold, technical tone of the game.

---

## 6. Wiring TECH_DEFS into the Engine

### 6a. `startNewGame` in `game.svelte.ts`

Import `TECH_DEFS` from `../../data/technologies` and call `initialiseTechs`. Use a dedicated RNG
slice (`${seed}-techs`) separate from the draw-phase RNG (`${seed}-t1`) to preserve seed determinism.

```typescript
import { initialiseTechs } from '../../engine/research';
import { TECH_DEFS } from '../../data/technologies';

// Inside startNewGame, after createGameState:
const techRng  = createRng(`${seed}-techs`);
const drawRng  = createRng(`${seed}-t1`);
const techs    = initialiseTechs([...TECH_DEFS.values()], techRng);

let next: GameState = {
  ...base,
  player: { ...base.player, cards: starterCards, techs },
  blocs: initialiseBlocStates([...BLOC_DEFS.values()]),
  map: { ... },
};

next = executeDrawPhase(next, drawRng);
```

Add a comment in `turn.ts`'s PRNG call-order section:

```
// Seed initialisation (startNewGame only, not per-turn):
//   1. createRng(`${seed}-techs`)  → tech recipe generation
//   2. createRng(`${seed}-t1`)     → opening draw phase
```

### 6b. `advancePhase` in `game.svelte.ts`

Change line 376:

```typescript
// Before:
next = executeWorldPhase(next, FACILITY_DEFS, new Map(), BLOC_DEFS, BOARD_DEFS);

// After:
next = executeWorldPhase(next, FACILITY_DEFS, TECH_DEFS, BLOC_DEFS, BOARD_DEFS);
```

---

## 7. `signalDerived` Guard in Research Engine

**File:** `src/engine/research.ts`

Add `signalEraStrength` parameter to `checkResearchProgress`. Signal-derived techs must not enter
the rumour pool while the signal is still `'faint'`.

```typescript
export function checkResearchProgress(
  techs: TechState[],
  techDefs: Map<string, TechDef>,
  currentFields: FieldPoints,
  currentTurn: number,
  signalEraStrength: SignalEraStrength = 'faint', // default preserves all existing tests
): { updatedTechs; newDiscoveries; newRumours; newProgressTechs };
```

Inside the `unknown → rumour` promotion logic:

```typescript
const def = techDefs.get(tech.defId);
if (def?.signalDerived && signalEraStrength === 'faint') continue;
```

**File:** `src/engine/turn.ts` — pass `state.signal.eraStrength` as the fifth argument when calling
`checkResearchProgress` inside `executeWorldPhase`.

---

## 8. File Map

| File                            | Change                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/technologies.ts`      | **NEW** — 12 TechDef entries, Era 1 only                                                                                                              |
| `src/data/cards.ts`             | Add 7 new CardDef entries (all `era: 'earth'`)                                                                                                        |
| `src/data/blocs.ts`             | Adjust `startingFields` to 1970 baseline                                                                                                              |
| `src/lib/stores/game.svelte.ts` | Change `startYear` to 1970; wire `initialiseTechs` with dedicated RNG slice; pass `TECH_DEFS` to `executeWorldPhase`; add signal narrative news items |
| `src/engine/research.ts`        | Add `signalEraStrength` param (default `'faint'`) to `checkResearchProgress`                                                                          |
| `src/engine/turn.ts`            | Pass `state.signal.eraStrength` to `checkResearchProgress`; update PRNG call-order comment                                                            |

---

## 9. Deferred to later Phase (Era 2 — Near Space, ~2010–2055)

These technologies belong in the Near Space era and will be authored in Phase 15:

- `modularSpaceStation` — Modular Station Architecture (engineering + physics)
- `reusableLaunchVehicles` — Reusable Launch Vehicles (engineering + physics, simultaneous)
- `spaceBasedSolarPower` — Space-Based Solar Arrays (engineering + computing)
- `closedLoopLifeSupport` — Closed-Loop Life Support (biochemistry + engineering)
- `advancedPropulsion` — Advanced Propulsion Systems (physics + engineering) — unlocks heliopauseRelay, Era 3 gate

Cards deferred: `jointSpaceMission` (`era: 'nearSpace'`)

---

## 10. Deferred to later Phase (Era 3 — Asteroid Belt, ~2055–2100)

- `deepSpaceNavigation` — Autonomous Deep Space Navigation (mathematics + physics, simultaneous)
- `quantumProcessing` — Quantum Processing (computing + physics + mathematics, simultaneous, signal-derived)
- `asteroidProspecting` — Asteroid Prospecting Protocols (engineering + computing) — unlocks asteroidMiner

Cards deferred: `quantumDecryption` (`era: 'deepSpace'`)

---

## 11. Verification Checklist

1. `npm run lint` — zero errors; `research.ts` signature change must propagate (only called from
   `turn.ts` in production; update test call sites to pass the default explicitly or rely on default)
2. `npx vitest run` — all 259 existing tests still pass; add new tests:
   - `research.test.ts`: signal-derived tech stays `unknown` when `eraStrength === 'faint'`; promotes
     to `rumour` when strength is `'structured'` and field thresholds are met
   - `technologies.test.ts` (optional): all 12 TechDef entries pass structural validation (id set,
     baseRecipe non-empty, recipeVariance in 0–1, unlocksCards/unlocksFacilities are arrays)
3. Manual smoke test:
   - New game → HUD shows year **1970**, turn 1
   - News ticker shows 1970 programme-start item immediately; 1971 signal detection item visible
   - After ~8 turns with researchLab + computingHub: `integratedCircuits` enters rumour, then
     progress, then discovered; `softwareGrant` card appears in deck
   - `orbitalMechanics` stays locked until BOTH physics ≥ 200 AND mathematics ≥ 140 simultaneously
   - `signalPatternAnalysis` stays `unknown` while `eraStrength === 'faint'`; enters rumour pool
     once signal decode hits 30
   - After discovering `digitisedTelemetry`: `signalDeconvolution` card appears in deck; playing it
     advances decode progress by 8 and counters `signal`-tagged events

---

## Design Notes

- **Era 1 is entirely Earth-bound.** No Near Space or Deep Space facilities are accessible before
  `orbitalMechanics` is discovered and the era transition is completed (landmark project, Phase 15).
- **`roboticsAutomation` intentionally has no facility unlock** in this phase — asteroid miners are
  Era 3 content. The tech still provides research field value by unlocking future cards (Phase 15).
- **The simultaneous requirement on `orbitalMechanics`** is the central late-game pressure of Era 1:
  the player can invest heavily in physics (via deepSpaceArray) and neglect mathematics, but then
  they cannot open the Near Space era. This mirrors the historical tension between rocket engineering
  and the mathematical theory of orbital mechanics.
- **Do not add a direct "Research" action** — accumulation comes only from facilities and cards.
- **Bloc `startingFields`** are balance values; tune after playtesting without engine changes.
- **Phase 15 and 16 will add their own `TechDef` arrays**, appended to the Map or kept in separate
  files and merged. No architecture decision needed now.
