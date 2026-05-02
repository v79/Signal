# Phase 39.4 (Revised) — Event-Triggered Facility Placement

Supersedes §39.4 of `PLAN_PHASE39.md`. The framework built in the first pass (`pendingFacilityPlacements`, `placePendingFacility`, `deferPendingPlacement`, `PlacementPromptCard`, `PlacementPromptModal`, placement-mode wiring) is retained. The **producer** changes: facilities are queued for placement when the player **accepts a proposal event**, not when a project completes.

## Why the original 39.4 was wrong-shaped

1. **`spaceLaunchCentre` has no producing project.** It's a tech-unlocked facility built via the standard build flow. There was nothing to attach `producesFacility: 'manualTile'` to.
2. **Hard-coded `tech → event` wiring.** `turn.ts:499–518` checks `newDiscoveries.includes('orbitalMechanics')` and synthesises a `boardProposalOrbitalStation` event in code. The same pattern repeats for `lunarHabitat → boardProposalMoonColony`. This is data masquerading as logic — it should live in `events.json` / `technologies.json`.
3. **The narrative framing is event-driven, not project-driven.** "We've achieved orbital mechanics — should we authorise a launch centre?" is a proposal event with Authorise/Defer, exactly like the existing Orbital Station and Moon Colony proposals. Tying placement to project completion is the wrong primitive.

## Goals

1. Move the `tech-discovered → proposal-event-fires` mapping out of `turn.ts` and into the data layer.
2. Add a new pathway for events to **produce a placeable facility** when accepted (mirroring §39.4's project-based pathway, but driven by event acceptance instead of project completion).
3. Wire `orbitalMechanics → spaceLaunchCentreProposal → place` as the first concrete user.
4. Leave the existing `boardProposalOrbitalStation` / `boardProposalMoonColony` flows working — migrate them to the data-driven trigger model as part of the same change so we have one mechanism, not two.

Non-goals:

- Removing the `producesFacility` field on `ProjectDef`. It still has value for future infrastructure projects; CERN keeps its `anchoredToHost` host-resolution as a special case. No project today uses `manualTile`, but the framework is harmless.
- Changing the `PlacementPromptCard` / `PlacementPromptModal` UX. The producer changes; the consumer doesn't.
- Reworking the existing orbital/moon colony proposals' acceptance effects. Just changing how they're _triggered_.

## 39.4.1 Data-driven event triggers

Add an optional field to `TechDef`:

```ts
/**
 * When this tech first transitions to 'discovered', queue an EventInstance
 * for the listed event def. Replaces hard-coded `tech-discovered → event`
 * checks in turn.ts. The event is fired once per run; re-firing on a
 * post-load tech-state replay is suppressed by the same guard pattern used
 * by `boardProposalFired` today.
 */
triggersEventOnDiscovery?: string;
```

And to `EventDef`:

```ts
/**
 * If true, only one instance of this event may be live in the game at any
 * time. Re-firing while a live (unresolved) instance exists is a no-op.
 * Used by proposal events to prevent duplicate prompts on re-load or
 * repeat triggers.
 */
oneShot?: boolean;
```

Engine wiring (replaces lines 499–535 of `turn.ts`):

- New helper `collectTechTriggeredEvents(newDiscoveries, techDefs, activeEvents, alreadyFiredIds, turn)` returns an `EventInstance[]` to push into `worldPhaseEvents`.
- Per-event "already fired" tracking: replace `boardProposalFired: boolean` (and the parallel `moonColonyProposalFired`) with a single `firedOneShotEventIds: string[]` on `GameState`. Save migration: synthesise from the legacy booleans on load.
- Same pattern for facility-completion-triggered events. Add to `FacilityDef`:

```ts
/**
 * When a facility of this def first appears in player.facilities, queue an
 * EventInstance for the listed event def (one-shot). Used today by
 * spaceLaunchCentre → orbitalStationProposal and lunarHabitat → moonColonyProposal.
 */
triggersEventOnFirstBuild?: string;
```

After this change, `turn.ts` has zero hard-coded event-def-id strings.

## 39.4.2 Event acceptance produces a facility

Add to `EventDef`:

```ts
/**
 * When this event is resolved with 'accepted' (Authorise), push a pending
 * placement for the listed facility. Cost is taken from positiveEffect as
 * usual — placement is the additional consequence beyond the resource
 * delta. The placement uses the existing manualTile flow (player chooses a
 * tile; PlacementPromptCard / PlacementPromptModal surfaces).
 */
producesFacilityOnAccept?: {
  defId: string;
  /** Reserved for future. Today only 'manualTile' is supported. */
  placement: 'manualTile';
};
```

Engine wiring (in the existing `acceptEvent` path):

- After applying `positiveEffect`, if `def.producesFacilityOnAccept` is set, push a `PendingFacilityPlacement` with `projectId: <eventInstanceId>` (re-using the pending entry's `projectId` field as a generic "source id"; rename to `sourceId` in the same patch for clarity).
- Defer / no-action on the event = no placement queued. The proposal resurfacing logic stays as-is.

`PendingFacilityPlacement` rename:

```ts
export interface PendingFacilityPlacement {
  /** Source that produced the pending facility (project def id OR event instance id). */
  sourceId: string;
  facilityDefId: string;
  deferCount: number;
}
```

All existing callers (`projects.ts`, `gameStore`, `PlacementPromptCard`) just rename `projectId → sourceId`.

## 39.4.3 Concrete: `spaceLaunchCentre` flow

1. `technologies.json` — add `"triggersEventOnDiscovery": "spaceLaunchCentreProposal"` to `orbitalMechanics`.
2. `events.json` — add new event:

```jsonc
"spaceLaunchCentreProposal": {
  "id": "spaceLaunchCentreProposal",
  "name": "Board Proposal: Space Launch Centre",
  "description": "Orbital mechanics is settled science. The Chief Engineer proposes constructing a full-scale launch facility to put the theory to use.",
  "flavourText": "\"We have the maths. We need the gantry.\"",
  "tags": ["proposal"],
  "eras": ["earth", "nearSpace"],
  "pushFactors": null,
  "blocIds": null,
  "countdownTurns": 999,
  "weight": 0,
  "responseTier": "noCounter",
  "oneShot": true,
  "negativeEffect": {},
  "positiveEffect": { "resources": { "funding": -80, "materials": -60 } },
  "producesFacilityOnAccept": { "defId": "spaceLaunchCentre", "placement": "manualTile" }
}
```

  Cost mirrors the facility's current `buildCost` so accepting the proposal is the same outlay as building it manually.

3. `facilities.json` — `spaceLaunchCentre.requiredTechId` stays `orbitalMechanics`. Manual build via `FacilityPicker` continues to work for players who somehow miss the proposal (defensive — the proposal is `oneShot` and `countdownTurns: 999`, so this should never happen, but leaving the manual path means no regression for in-flight saves).

4. `events.json` — add `"triggersEventOnFirstBuild": "boardProposalOrbitalStation"` to `spaceLaunchCentre`'s facility def, replacing the current `spaceLaunchJustBuilt` check in `turn.ts`.

5. `events.json` — add `"triggersEventOnFirstBuild": "boardProposalMoonColony"` to `lunarHabitat`'s facility def.

6. `events.json` — add `"oneShot": true` to `boardProposalOrbitalStation` and `boardProposalMoonColony` so the new mechanism enforces single-fire.

After steps 4–6, the dual-trigger logic in `turn.ts` (orbitalMechanics OR spaceLaunchCentre → orbital station proposal) is replaced by a single chain: `orbitalMechanics → launch-centre proposal → accept → place → first-build → orbital-station proposal`. This is also a clearer narrative arc.

## Schema changes summary

- `TechDef.triggersEventOnDiscovery?: string`
- `FacilityDef.triggersEventOnFirstBuild?: string`
- `EventDef.oneShot?: boolean`
- `EventDef.producesFacilityOnAccept?: { defId; placement: 'manualTile' }`
- `GameState.firedOneShotEventIds: string[]` (replaces `boardProposalFired` + `moonColonyProposalFired`; legacy migrated on load)
- `PendingFacilityPlacement.projectId` → `sourceId` (rename)

## Implementation checklist

### Engine

- [ ] `types.ts`: schema additions above; rename `projectId → sourceId`.
- [ ] `state.ts`: initialise `firedOneShotEventIds: []`; deserialise migration backfills it from the legacy booleans (then deletes them).
- [ ] `turn.ts`: extract `collectTechTriggeredEvents` and `collectFacilityFirstBuildEvents` helpers; delete the four hard-coded blocks (`spaceLaunchJustBuilt`, `orbitalMechanicsJustDiscovered`, `lunarHabitatJustBuilt`, and the synthesised `EventInstance`s). The new helpers consult the data fields.
- [ ] `events.ts`: in `acceptEvent`, push `PendingFacilityPlacement` when `def.producesFacilityOnAccept` is set; track in `firedOneShotEventIds` when accepted.
- [ ] `events.ts`: respect `oneShot` in `selectNewEvents` (skip if id already in `firedOneShotEventIds`) and in the tech-triggered helper (skip if already live in `activeEvents`).
- [ ] `projects.ts`: rename pending `projectId → sourceId`. Otherwise unchanged.

### Data

- [ ] `technologies.json`: `orbitalMechanics.triggersEventOnDiscovery = "spaceLaunchCentreProposal"`.
- [ ] `facilities.json`: `spaceLaunchCentre.triggersEventOnFirstBuild = "boardProposalOrbitalStation"`; `lunarHabitat.triggersEventOnFirstBuild = "boardProposalMoonColony"`.
- [ ] `events.json`: add `spaceLaunchCentreProposal`; add `oneShot: true` to existing two proposals.

### UI

- [ ] `PlacementPromptCard.svelte` / `PlacementPromptModal.svelte`: rename `placement.projectId → placement.sourceId`. No other UI changes — the prompt is producer-agnostic by design.
- [ ] `gameStore`: rename `enterPlacementMode(projectId)` parameter to `sourceId`.

### Tests

- [ ] `events.test.ts`: accepting an event with `producesFacilityOnAccept` writes a pending placement; resources are still deducted from `positiveEffect`.
- [ ] `events.test.ts`: deferring/expiring such an event does **not** queue a placement.
- [ ] `events.test.ts`: `oneShot: true` events do not re-fire after acceptance even if their tech-trigger condition repeats (e.g. save/load replays the discovery).
- [ ] `turn.test.ts`: `triggersEventOnDiscovery` queues the event in the World Phase that completes the discovery; respects `oneShot`.
- [ ] `turn.test.ts`: `triggersEventOnFirstBuild` queues the event when the facility appears for the first time.
- [ ] `turn.test.ts`: legacy save with `boardProposalFired: true` migrates to `firedOneShotEventIds: ['boardProposalOrbitalStation']` and the proposal does not re-fire.

### Cleanup

- [ ] Remove the unused `producesFacility: 'manualTile'` test fixtures from `projects.test.ts` if no production project ever uses that pathway. (Decision deferred — keeping them for now documents the API.)
- [ ] Update `PLAN_PHASE39.md` §39.4 to point at this document and mark its sub-items superseded.

## What stays from the first-pass 39.4

- `PendingFacilityPlacement` interface (rename `projectId → sourceId`).
- `placePendingFacility`, `deferPendingPlacement`, `canPlaceProducedFacility`, `hasAnyEligibleTile`.
- `PlacementPromptCard`, `PlacementPromptModal`.
- Placement-mode wiring in `gameStore` and `MapContainer`.
- Save migration for `pendingFacilityPlacements`.

The defer counter, the 3-strike escalation to a blocking modal, the no-eligible-tile edge case — all unchanged.

## Open questions

- **What if the player declines / lets the proposal expire?** Today the facility could still be built manually via the tech-unlock path. Options: (a) leave the manual path, accept that the proposal is purely a convenience prompt; (b) gate manual-build on the proposal having been accepted, so declining means the launch centre is permanently lost (or only re-available via a different unlock). _Recommendation: (a) — proposal is convenience, manual is fallback. Less punishing, less novel UI to write._ - _Agreed - purpose is to prompt/remind the player, not to gatekeep progress_
- **Should the proposal cost match the facility build cost exactly, or be cheaper?** Cheaper would incentivise the proposal path; equal makes the proposal a pure convenience. _Recommendation: equal for v1._ - _Agreed, equal is correct_
- **Auto-defer on turn pass.** Same open question carried over from the first-pass 39.4. The player explicitly pressing Defer increments the counter; closing the browser or just ignoring the card is currently free. Worth deciding before merging. - _Player can defer; player can also manually build the facility, in which case the event should be closed_
- **Does `boardProposalOrbitalStation` ever need `producesFacilityOnAccept`?** No — accepting it sets `orbitalStationAuthorised`, which gates the project. The facility/placement flow is separate.
