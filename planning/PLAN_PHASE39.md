# Phase 39 — New Start Experience

Onboarding pass. The opening turns currently dump a player onto an empty map with no facilities, no clear orientation between tabs, and no warning when major systems unlock. This phase fixes the first-run cliff: prebuilt starter facilities, per-tab help buttons, unlock notifications, and a placement flow for infrastructure projects so things like the Space Launch Centre stop disappearing into the project queue.

## Problem statement

- New players don't know what to do at the start of the game; experienced players miss new options when facilities/eras unlock.
- The Steering Committee tab is often left unpopulated.
- Era transitions are signalled only by the loss of a padlock icon.
- When an infrastructure project (e.g. `spaceLaunchCentre`) becomes available, the project event does not place its facility — the player frequently forgets and stalls.

## Goals

1. Each bloc starts with a small, deterministic set of pre-built facilities so the map is not blank on turn 1.
2. Every map/panel tab carries a `?` help button with bite-sized written guidance for that part of the game.
3. Newly-unlocked tabs (Near Space, Asteroid Belt) and tabs needing attention (Steering Committee with a vacancy) show a pulsing dot — same visual language as the existing TECH TREE indicator.
4. Infrastructure projects (`spaceLaunchCentre`, `cern`, future analogues) prompt the player to place the resulting facility on completion. Skipping the placement is treated as a defer.

## 39.1 Starter facilities

Each bloc gains three pre-built facilities placed deterministically at game start. Selection is keyed off the bloc id so seeded runs remain reproducible.

### Composition rule

Three facilities per bloc, drawn from the categories below. Exact picks may vary by bloc to reflect its starting field profile.

| Category | Output | Candidate facility ids |
|---|---|---|
| Science | Pure field output | `researchLab`, `publicUniversity`, `observatory`, `bioresearchCentre`, `agriculturalResearchStation` |
| Income | `funding` per turn | `coalPowerStation`, `solarFarm`, `offshoreWindFarm`, `engineeringWorks`, `coastalTradingPort` |
| Resource | `materials` per turn | `mine` (the only Earth-era pure materials facility) |

Notes on the candidate set:

- All ids verified against `src/data/facilities.json`.
- `agriculturalResearchStation` doubles as a science facility with a small materials trickle (1/turn); fine to count as "science" in the trio.
- `coastalTradingPort` produces funding but **consumes** materials (–4/turn). Only pick it for blocs that also get a `mine`.
- For first pass, the simplest deterministic mapping is `researchLab` + `coalPowerStation` + `mine` for every bloc; per-bloc tuning (e.g. `bioresearchCentre` for South America, `engineeringWorks` for East Asia) lands as a follow-up table once the placement plumbing works.

### Placement rule

- Facilities are placed at game-state creation time in `state.ts`/`game.svelte.ts`, after the bloc map tiles are loaded.
- Tile selection: deterministic — for each starter facility, scan the bloc's tile list in declaration order and pick the first tile whose type is in `allowedTileTypes` and whose remaining slot capacity is sufficient.
- No `constructedTurn` ambiguity: starter facilities use `constructedTurn: 0` so the existing "first-built" tie-break for project anchors (CERN) treats them as earliest.
- No build cost is charged; resources at start remain as `BLOC_DEFS.startingResources`.

### Open questions

- Should starter facilities count toward adjacency bonuses immediately on turn 1? (Default: yes — they're "already built".) _Yes, no change to adjacency calculations_
- Should a bloc that lacks a tile of the required type for one of its category picks fall back to a different facility, or simply place fewer? (Default: fall back to next-best in same category.) _This scenario is not valid; all blocs must contain all tile types_

## 39.2 Help buttons

A small `?` glyph in the top-right of each tab/panel header. Click → modal with 100–200 words of plain-English guidance for that view.

### Coverage

| Tab / panel | Topic |
|---|---|
| Earth map | Tile types, slots, adjacency, building |
| Near Space map | Launch capacity, space nodes, supply costs |
| Asteroid Belt map | (Stub for now — full content when era 3 lands) |
| Projects tab | Project types (contract / scientific / landmark) and how to initiate |
| Steering Committee | Roles, buffs/debuffs, ageing, AI member |
| Blocs panel | What other blocs are doing and why |

### Implementation

- New component `HelpButton.svelte` rendering the `?` glyph + click handler.
- New component `HelpModal.svelte` (or extend `NarrativeModal.svelte` if shape allows) for the body.
- Help content lives in a single `src/data/helpTopics.ts` map keyed by tab id, so future copy edits don't touch component code.
- Help button does not pulse and does not need to be discoverable beyond the `?` itself; it is reference material, not onboarding.

## 39.3 Tab notification dots

Reuse the `.new-dot` styling from `+page.svelte` (the TECH TREE indicator). Apply to map/panel tabs in `MapContainer.svelte`.

### Triggers

| Tab | Pulses when | Cleared by |
|---|---|---|
| Near Space | Era advanced to `nearSpace` (or `orbitalStation_stage1` completed, matching existing unlock rule) | Player clicks the tab |
| Asteroid Belt | Era advanced to `deepSpace` | Player clicks the tab |
| Steering Committee | A board member dies, retires, or resigns — i.e. any new entry in `committeeNotifications` | Player clicks the tab |

### State

- New booleans on `GameState`:
  - `nearSpaceTabSeen: boolean`
  - `asteroidTabSeen: boolean`
  - `committeeTabUnreadCount: number` (or reuse `committeeNotifications.length` if it already represents unread events).
- Set `*TabSeen = false` when the unlock condition first fires; flip to `true` when the player switches to that tab.
- Save format: bump if needed, but a missing field on an old save can default to `true` (treat as already-seen) rather than blocking the load.

## 39.4 Infrastructure project placement

Generalise the placement flow so any "infrastructure" project — defined as one that produces a placeable facility — prompts the player at completion.

### Eligible projects

Projects whose completion produces a facility instance. Today this is:

- `spaceLaunchCentre` (currently surfaced via an event, no placement step)
- `cern` (currently anchored to an existing `publicUniversity`)

The placement flow generalises both: CERN keeps its "anchor to host facility" behaviour as a special case of the same flow (auto-resolve the host instead of prompting).

### Schema

Add an optional field to `ProjectDef`:

```ts
producesFacility?: {
  defId: string;
  placement: 'manualTile' | 'anchoredToHost';
  hostFacilityDefId?: string; // required when placement === 'anchoredToHost'
};
```

### Flow (manualTile)

1. Project completes during the world phase.
2. Engine writes a placement-pending entry to `state.pendingFacilityPlacements: Array<{ projectId; facilityDefId; deferUntilTurn }>`.
3. UI surfaces the prompt at the start of the next action phase — modal with "Place now" (opens map tile picker filtered by `allowedTileTypes`) or "Defer" (closes the modal, increments a defer counter).
4. If the player closes the modal without placing, that counts as a defer.
5. After 3 deferrals, the prompt resurfaces as a top-priority action-phase modal that cannot be dismissed without either placing or explicitly declining (which destroys the unbuilt facility — narrative consequence TBD).
6. While pending, the facility does not produce output and does not occupy a tile.

### Flow (anchoredToHost)

CERN, today. No prompt — engine resolves the earliest-built `publicUniversity` and renders the ring. Already implemented in Phase 38.

### Existing event-based unlock

The current `spaceLaunchCentre` event (which announces the project becoming available) is retained. The placement prompt only fires after the player initiates and completes the project, not on the announcement event.

### GDD update

Add a short section to `SignalGDD.md` describing the infrastructure-project placement flow as a general pattern, so future projects (e.g. asteroid-era equivalents) follow the same shape.

## Implementation checklist

### Engine (`src/engine/`)

- [ ] `types.ts`: add `producesFacility` to `ProjectDef`; add `pendingFacilityPlacements` to `GameState`; add tab-seen booleans (or equivalent) to `GameState`.
- ✅ `starterFacilities.ts` (new module): pure `placeStarterFacilities(blocDefId, tiles, facilityDefs)` helper, called from `startNewGame` in `game.svelte.ts` after HQ placement. v1 trio is `researchLab` + `coalPowerStation` + `mine` for every bloc; per-bloc overrides via `STARTER_FACILITY_TRIOS` map. Tab-seen booleans deferred to 39.3.
- [ ] `projects.ts`: on completion of a project with `producesFacility.placement === 'manualTile'`, push to `pendingFacilityPlacements`.
- [ ] `turn.ts`: increment defer counters on pending placements that aged through a turn without being placed.
- [ ] Era-advance code (wherever `state.era` is mutated): set `nearSpaceTabSeen = false` / `asteroidTabSeen = false` as appropriate.
- [ ] Board lifecycle (`board.ts`): when a member exits, ensure `committeeNotifications` (or the new unread counter) is updated.

### Data

- [ ] `projects.json`: add `producesFacility: { defId: "spaceLaunchCentre", placement: "manualTile" }` to whichever project produces the launch centre. (May need a new project entry if the centre is currently produced solely by an event.)
- [ ] `projects.json`: optionally add `producesFacility: { defId: "cern", placement: "anchoredToHost", hostFacilityDefId: "publicUniversity" }` for documentation/consistency, even though Phase 38 hard-codes the behaviour.
- [ ] `src/data/helpTopics.ts`: new file with help-text strings keyed by tab id.

### UI (`src/lib/components/`)

- [ ] `HelpButton.svelte` — new.
- [ ] `HelpModal.svelte` — new (or fold into existing modal).
- [ ] `MapContainer.svelte`: render `HelpButton` per tab; render pulsing `.new-dot` on tabs whose seen flag is `false`; clear flag on `switchTab`.
- [ ] `BoardPanel.svelte` (or wherever the committee tab content lives): pulsing dot binding.
- [ ] `FacilityPicker.svelte` or new `PlacementPrompt.svelte`: modal flow for placing the produced facility on a chosen tile. Reuse existing tile-type filtering from the standard build flow.
- [ ] `+page.svelte`: surface placement modal when `pendingFacilityPlacements` is non-empty at the start of the action phase.

### Tests

- ✅ Starter facilities placed deterministically per bloc; tile-type compatibility, idempotence, no input mutation, and `builtTurn: 0` all covered in `starterFacilities.test.ts` (7 tests).
- [ ] Tab-seen flags flip correctly when era advances and clear on click.
- [ ] Project completion writes a placement-pending entry; `tickActiveProjects` does not duplicate it across turns.
- [ ] Defer counter increments correctly; third defer surfaces a non-dismissable prompt.
- [ ] `producesFacility.placement === 'anchoredToHost'` does not produce a placement-pending entry (CERN regression).

### Docs

- [ ] `SignalGDD.md`: add infrastructure-project placement section.
- [ ] `MEMORY.md`: bump phase status once merged.

## Out of scope / deferred

- Animated tutorial overlay or tour — written help only.
- Help content for the Asteroid Belt tab beyond a stub (era 3 not yet implemented).
- A "decline placement" narrative branch (post-third-defer outcome) — for now, defer indefinitely or destroy silently.
- Per-bloc unique starter compositions tuned for narrative flavour (e.g. specific tile picks). First pass is mechanical: science + income + resource for everyone.
- Reworking the existing `spaceLaunchCentre` announcement event — left intact; placement prompt is additive.
- Save migration for older saves missing the new `pendingFacilityPlacements` array — default to `[]` on load.
