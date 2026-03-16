# Plan — Phase 26: Era Transitions & Committee Notifications

_Created: 2026-03-16_

---

## Context

Phase 26 combines two bodies of outstanding work:

1. **Phase 25 Phase B** — Committee notifications data model and rendering; Dr. Okonkwo tech gate.
2. **Era Transitions** (`DESIGN_ERA_TRANSITIONS.md`) — the board-proposal mechanic, the Orbital Telescope Array warm-up project, the Permanent Orbital Station multi-stage landmark, competitor pressure events, and the Era 1 → Era 2 map unlock.

These are combined because the board-proposal event (the era gate trigger) is the primary escalated notification from the Committee system. Building notifications first, then wiring the board proposal through that system, is the natural implementation order.

---

## Sub-phases

### ✅ Phase 26A — Committee notification system

Implement the lightweight notification model that committee members use to surface non-blocking prompts. Board proposals (the escalated variant) build on this same model.

**Tasks:**

- Add `CommitteeNotification` type to `src/engine/types.ts`:
  ```ts
  interface CommitteeNotification {
    id: string;
    memberId: string;       // which committee member surfaces it
    text: string;           // display text
    choices?: { label: string; effect: Partial<GameState> }[];  // optional — flavour-only if absent
    turnCreated: number;
  }
  ```
- Add `committeeNotifications: CommitteeNotification[]` to `GameState`.
- Update `serialiseGameState` / `deserialiseGameState` to include the new field.
- Add engine helpers in `board.ts`:
  - `addCommitteeNotification(state, notification)`
  - `resolveCommitteeNotification(state, id, choiceIndex?)`
  - `dismissCommitteeNotification(state, id)`
- Render active notifications in `BoardPanel.svelte`: below each member's card, if that member has a pending notification, show it inline (collapsed by default, expandable). Show choice buttons if `choices` is present; show Dismiss if flavour-only.
- The notification dot badge on the card (specified in §9 of PLAN_PHASE25.md) should be wired to the presence of any notification for that member.
- Wire `resolveCommitteeNotification` and `dismissCommitteeNotification` into the store action dispatcher.

**Scope note:** No notifications are generated yet in this sub-phase — just the infrastructure and UI. Flavour-only notifications (e.g. Markov warning about materials) can be added here as a proof of concept.

---

### ✅ Phase 26B — Dr. Okonkwo tech gate

The only remaining Era/tech gate deferred from Phase 25A.

**Tasks:**

- Add a `techGate?: string` field to `BoardMemberDef` (or reuse an existing gate field if one was introduced in Phase 25).
- Set `techGate: 'signalAnalysis'` on Dr. Chidi Okonkwo's def in `src/data/board.ts`.
- Update `candidateForRole()` in `BoardPanel.svelte` to filter out candidates whose `techGate` tech has not been discovered (i.e. not in `state.discoveredTechs`).
- Vacant Signal Analyst slot should show `No candidate available — requires Signal Analysis tech` (or similar) when the gate is not met, per the slot state table in PLAN_PHASE25.md §9.

---

### Phase 26C — Orbital Mechanics tech + Orbital Telescope Array

Add the tech prerequisite and the warm-up Scientific Project that teaches the player space projects exist before the landmark commitment.

**Tasks:**

- Ensure `orbitalMechanics` exists as a tech in `src/data/technologies.ts`. If not, add it (Era 1, Tier 2; requires Physics + Mathematics thresholds; recipe randomised by seed as per existing pattern).
- Add `orbitalTelescopeArray` as a **Scientific Project** in `src/data/facilities.ts` (or as a new project def type if projects are stored separately):
  - Available once `orbitalMechanics` is discovered.
  - Cost: lower than the landmark (exact numbers TBD in implementation; suggest ~30F + 15M).
  - Build time: 2 turns.
  - Effects on completion: +15% signal decode progress for the rest of Era 1; news item naming it; small Physics/Maths buff while operational.
  - Teaches the player multi-turn space projects exist before the landmark asks them to commit.
- Add a news item on completion: flavour text about the telescope coming online and detecting anomalous signal characteristics.

---

### ✅ Phase 26D — Board proposal event (Orbital Station)

The board proposal is an **escalated notification** — it fires in the main event zone as a persistent (no-expiry) event when `orbitalMechanics` is discovered or when a Launch Facility is built (whichever comes first).

**Tasks:**

- Add a `boardProposalFired: boolean` flag to `GameState` (prevents re-firing).
- In `turn.ts` (world phase or research phase), after tech discovery is resolved:
  - If `orbitalMechanics` was just discovered AND `boardProposalFired === false`, fire the board proposal.
- In `facilities.ts` or wherever facility construction completion is handled:
  - If a Launch Facility just completed AND `boardProposalFired === false`, fire the board proposal.
- The board proposal is added as an `ActiveEvent` with:
  - `expiryTurns: null` (never expires — persistent until the player acts).
  - Two responses: **Authorise** and **Defer**.
  - **Authorise** effect: deducts Will + Funding (suggest 30W + 50F); sets `orbitalStationAuthorised: boolean` on `GameState`; news item: "The Corporation has officially initiated the Permanent Orbital Station programme."
  - **Defer** effect: dismisses the event; sets a `deferCount` increment on state so the system can resurface it.
- If deferred, every 3 turns a lightweight committee notification surfaces from Dr. Yeva Marchetti (or the active Chief Scientist) expressing concern about the delay.
- Wire `boardProposalFired` into `serialiseGameState` / `deserialiseGameState`.
- Event flavour text (from design doc): *"Dr. [Chief Scientist name] formally proposes that the Corporation initiate the Permanent Orbital Station programme. 'We have the science. What we need now is the political will and the materials to make it real.'"* — use the actual active Chief Scientist's display name, not a hardcoded name.

---

### Phase 26E — Permanent Orbital Station (multi-stage landmark)

The three-stage project that gates the Era 1 → Era 2 transition. Only available after `orbitalStationAuthorised === true`.

**Tasks:**

- Define a new `LandmarkProject` concept (or extend the existing project/facility model — use whichever is simpler given existing architecture):
  - `permanentOrbitalStation` with three stages as a sequential queue.
  - Each stage has its own cost and build time (see table below).
  - Stage completion triggers news items; final stage triggers era transition.

| Stage | Name | Cost | Build time | On completion |
|---|---|---|---|---|
| 1 | Core Module | 60F · 40M | 3 turns | News item; committee member comment |
| 2 | Habitation Ring | 40F · 30M + Engineering card event | 2 turns | News item; board member milestone comment |
| 3 | Operational | 20F · 10M | 1 turn | Era 2 unlocked; Will boost (+30W); Station Commander slot opens |

- Stage 2 "Engineering card event" means a specific event fires mid-construction: a logistics challenge that costs an extra action or resources to resolve. If unresolved it adds 1 turn to build time.
- The project is visible in the Standing Actions / project panel as a multi-step progress tracker once authorised.
- On Stage 3 completion:
  - Set `era` to `'nearSpace'` in `GameState`.
  - Apply Will boost.
  - Add the **Station Commander** committee role (see Phase 26F).
  - News item: celebratory, significant, era-defining.

---

### Phase 26F — Era transition mechanics

The mechanics that make the map unlock feel meaningful and guide the player toward Era 3.

**Tasks:**

**Map visibility:**
- Near Space map/scene: already rendered but inactive pre-transition. Confirm it is visible but inert (tiles/nodes greyed out, not interactable) from turn 1. If not currently implemented this way, adjust `SpaceScene.ts` or `MapContainer.svelte` accordingly.
- Asteroid Belt map: becomes visible-but-inert when `era === 'nearSpace'` (same pattern — greyed out, locked, shows as future goal).

**Station Commander role:**
- Add `stationCommander` as a new role slot in the committee.
- Slot is hidden (not rendered) until `era === 'nearSpace'`.
- Candidate: one named character (former astronaut or military background — write def in `src/data/board.ts`). Recruit cost: 25F · 20W.
- Buffs: −10% Era 2 launch costs; +5% Engineering output.
- Vacant penalty: +10% launch cost in Era 2 (mild — slot is new and player needs time to recruit).

**Competitor pressure events:**
- After turn ~15 (exact turn TBD; tune in playtesting), if `orbitalStationAuthorised === false`, NPC blocs begin completing orbital projects:
  - Announce via news ticker: "[Bloc name] has established an orbital presence."
  - Effect: −5W drain (public pressure); player loses eligibility for "first to orbit" bonus.
  - No hard punishment — opportunity cost and narrative flavour only, per design decision.
- "First to orbit" bonus: if the player completes the Orbital Station before any NPC bloc orbital announcement, award a one-time +20W and a news item.
- Add `firstToOrbit: boolean` and `npcOrbitalCount: number` to `GameState`.

**Era 2 → Era 3 placeholder:**
- Add a `// TODO Phase 27+: Era 2 → Era 3 transition (Lunar Base / Deep Space Transit)` comment in `turn.ts` at the appropriate hook point.
- Era 3 guidance will likely be prompted by signal decoding milestones — left for a future phase.

---

## Implementation order

```
26A (notification infrastructure)
  → 26B (Dr. Okonkwo gate, uses notification slot state)
  → 26C (Orbital Mechanics tech + Telescope Array)
  → 26D (board proposal, uses 26A notification model + 26C tech trigger)
  → 26E (Orbital Station project, uses 26D authorisation flag)
  → 26F (era transition wiring, uses 26E completion)
```

---

## Open questions

1. Should the multi-stage Orbital Station appear in the Standing Actions panel, or as a dedicated project panel? The existing OngoingActionsPanel may be the right home — review its scope before implementing.

  _There are no Standing Actions any more. OngoingActionsPanel makes sense_

2. Should the Stage 2 "Engineering card event" draw from the normal event pool or be a scripted one-off? A scripted one-off feels more appropriate for a landmark.

  _Scripted one-off is appropriate_

3. The Station Commander role is new. Should the initial seeded pool (Phase 25A) be extended to cover this role, or is the Station Commander always a fixed single candidate (no alternative)?

  _Extend the seeded pool. Eventually this will be replaced with a procedural function to create new candidates dynamically._

4. For NPC orbital pressure events: should the competitor be drawn from `BLOC_DEFS` (a named bloc) or generic ("a rival nation-state")? Named blocs feel more grounded.

  _From the named bloc definitions_

5. Competitor pressure start turn (~15) needs playtesting to calibrate. What's the flag for adjusting it easily — a constant in `events.ts`, or a value on `GameState`?

  _A value in GameState. Threshold for trigger based on player's progress through the tech tree. Event becomes valid once player has researched 65% of all techs in the current era._
