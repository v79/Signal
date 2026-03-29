# Phase 28 — Bloc Simulation: Diplomatic Integration

## Goal

Blocs currently exist as stat containers that silently evolve each turn, producing only generic news
items. Phase 28 turns them into world actors: they generate diplomatic events in the EventZone, their
eliminations become player choices, and their status is visible in a new Bloc Status panel.

## Deliverables

- [x] 28.1 — EventDef / BlocDef type extensions; drawEvent bloc gating
- [x] 28.2 — Diplomatic and pressure event definitions (7 new events)
- [x] 28.3 — Elimination narrative event (bloc collapse → player choice)
- [x] 28.4 — Bloc Status Panel UI (new BLOCS tab in map area)
- [x] 28.5 — Gulf Consortium as Petro-State (extra will decay, negative events)

## 28.1 — Type Extensions and Event Gating

### `src/engine/types.ts` changes
- `EventDef`: add `npcBlocId?: string`, `blocMinWill?: number`, `blocEventType?: string`
- `BlocDef`: add `isPetroState?: boolean`

### `src/engine/events.ts` changes
- `getEligibleEvents`: add optional `blocs: BlocState[]` and `recentlyFiredDefIds: Set<string>` params
- Filter: skip event if `npcBlocId` bloc is eliminated
- Filter: skip event if `blocMinWill` > bloc's current will
- Filter: skip event if defId is in `recentlyFiredDefIds`
- `selectNewEvents`: add optional `blocs: BlocState[]` param; build `recentlyFiredDefIds` from events
  with `arrivedTurn` within the last 10 turns

### `src/engine/blocs.ts` changes
- `BlocSimResult`: add `pendingEventInstances: EventInstance[]`
- Elimination: push `EventInstance` for `blocElimination` def alongside the news item
- Petro-state decay: apply −2 will/turn for blocs with `isPetroState: true`

### `src/engine/turn.ts` changes
- `executeEventPhase`: pass `state.blocs` into `selectNewEvents`
- World Phase: destructure `pendingEventInstances` from `simulateBlocs`; merge into `eventsAfterWorld`

## 28.2 — Event Definitions (`src/data/events.json`)

| id | Bloc | Type | Effect |
|----|------|------|--------|
| `bloc_materials_eastAsia` | eastAsia | diplomatic | Accept: +30 Mat −10W / Expire: −5W |
| `bloc_materials_northAmerica` | northAmerica | diplomatic | Accept: +20 Mat +15F −10W / Expire: −5W |
| `bloc_research_eurozone` | eurozone | diplomatic | Accept: +5 Phy +3 Math −15W / Expire: no effect |
| `bloc_research_southAmerica` | southAmerica | diplomatic | Accept: +6 Biochem −10W / Expire: no effect |
| `bloc_pressure_middleEast` | middleEast | pressure | fullCounter / Expire: −25F |
| `bloc_pressure_middleEast_2` | middleEast | pressure | noCounter / Expire: −15W |
| `bloc_achievement` | (any) | pressure | noCounter / Expire: −10W |
| `blocElimination` | (none) | elimination | noCounter, weight 0 / Accept: −30F +25Mat +5Eng / Expire: no effect |

Diplomatic events use the existing `noCounter + positiveEffect` pattern (ACCEPT button shows in EventZone).
Costs embedded in positiveEffect (e.g. `funding: -10, materials: 30`).

## 28.3 — Elimination Event

`blocElimination` EventDef with `weight: 0` (never drawn randomly, injected by `simulateBlocs`).
The player sees an ACCEPT button to pay 30 Funding and receive 25 Materials + 5 Engineering field.
If ignored, the event expires with no harm.

## 28.4 — Bloc Status Panel

New `src/lib/components/BlocStatusPanel.svelte`:
- One row per bloc (sorted: active first, then eliminated)
- Columns: name | will bar (green ≥60% / amber 30–60% / red <30%) | funding | era | profile badge
- Eliminated blocs shown greyed out with "ELIMINATED" label

`src/lib/components/MapContainer.svelte`:
- Add `'blocs'` to `AllTab` type
- Add BLOCS tab button after COMMITTEE
- Render `<BlocStatusPanel />` when blocs tab active (same pattern as board panel)

## 28.5 — Gulf Consortium as Petro-State

`src/data/blocs.json`: add `"isPetroState": true` to `middleEast` entry; fix key typo (`middlewEast` → `middleEast`).
`src/engine/blocs.ts`: after `tickWill`, apply `−2` additional will for petro-state blocs.

## Out of Scope

- Full merger resolution (voluntary/forced merger events)
- Bloc era progression / off-world presence
- World map visibility of bloc facilities
- Military/sabotage events (geopoliticalTension push-factor path)

## Verification

```bash
npm run test:run   # all tests pass
npm run lint       # no type errors
```

Manual checks:
1. New game → advance turns → diplomatic events appear in EventZone with ACCEPT button
2. Bloc Status panel populates and shows will bars updating each turn
3. Accept a materials exchange → funding reduced, materials increased
4. Gulf Consortium will declines noticeably faster than other blocs
