# Event Counter System — Bug Audit ✅

Analysis of all event tags, card counters, and board auto-counters. All bugs fixed.

---

## Complete Tag Cross-Reference

| Tag | Events that have it | Response tier | Card counters | Board auto-counters |
|---|---|---|---|---|
| `scandal` | Procurement Scandal | `fullCounter` | Vox Populi, Coalition Building, Peer Review, Media Blitz | — |
| `diplomatic` | Diplomatic Overture | `noCounter` | Back-Channel Negotiation | — |
| | Supply Blockade | `fullCounter` | Back-Channel Negotiation | — |
| `signal` | Signal Interference | `partialMitigation` | Signal Deconvolution Run | — |
| | Signal Breakthrough | `noCounter` (positive) | — | — |
| | Deep Space Anomaly | `noCounter` (positive) | — | — |
| `industrial` | Facility Incident | `partialMitigation` | — | Markov, Al-Rashid |
| | Industrial Contamination | `partialMitigation` | — | Markov, Al-Rashid |
| `orbital` | Habitation Ring: Supply Crisis | `partialMitigation` | — | Cmdr. Osei |
| `interference` | *(no event has this tag)* | — | Lobbying, Noise Filter, Global Broadcast | Chair Osei, Amb. Darko, SYNTHESIS-7 |
| `logistics` | *(no event has this tag)* | — | — | Col. Okafor |
| `security` | *(no event has this tag)* | — | — | Bristow, Watanabe, Novak |
| `crisis` | multiple | various | — | — |
| `climate` | Coastal Inundation, Drought | `noCounter` | — | — |
| `construction` | Habitation Ring | `partialMitigation` | — | — |
| `funding` | Funding Crisis | `partialMitigation` | — | — |
| `scientific` | Unexpected Breakthrough, Deep Space Anomaly | `noCounter` (positive) | — | — |
| `proposal` | Board Proposal: Orbital Station | `noCounter` | — | — |

---

## ✅ Bug 1 — `"interference"` tag does not exist on any event

**Affected:** Cards — Political Lobbying, Noise Filtering Algorithm, Global Broadcast. Board members — Chair Osei, Ambassador Darko, SYNTHESIS-7.

The intended event is clearly `signalInterference`, which has the tag `"signal"`, not `"interference"`. All six counters are permanently non-functional.

**Options:**
- A) Add `"interference"` as a second tag on `signalInterference` (alongside `"signal"`), and change `signalInterference` to `fullCounter` (see also Bug 4).
- B) Change the three cards' `countersEventTag` from `"interference"` to `"signal"`, and change board member descriptions accordingly.
- C) Keep `"interference"` as a distinct tag and create a new event that uses it (e.g. a diplomatic/political interference event separate from signal noise).

- _B - change "interference" to "signal" and update. I'll then test the impact by playing._

---

## ✅ Bug 2 — `"logistics"` and `"security"` tags do not exist on any event

**Affected:** Board members — Col. Okafor (`"logistics"`), Director Bristow, Agent Watanabe, Commander Novak (all `"security"`).

No events have been created for these tags. These board members have meaningful flavour (logistics expert, security directors) but their signature ability never fires.

**Options:**
- A) Create new events with these tags (e.g. a supply chain disruption event with `"logistics"`, and a data breach / espionage event with `"security"`).
- B) Reassign these board members to counter existing tags (e.g. `"crisis"` or `"industrial"`), and update their descriptions.

- _A - create new events with the tags logistics and security_

---

## ✅ Bug 3 — Board auto-counter logic is never called

**Affected:** All board members with `autoCountersEventTag` buffs (Markov, Al-Rashid, Chair Osei, Amb. Darko, Col. Okafor, Bristow, Watanabe, Novak, SYNTHESIS-7, Cmdr. Osei).

`getBoardAutoCounterTags()` exists in `src/engine/board.ts` and has passing unit tests, but is never imported or called in `turn.ts` or `game.svelte.ts`. The entire auto-counter system is silently inert.

**Fix required:** Wire `getBoardAutoCounterTags` into the event phase. During `executeEventPhase` (or the store's action handler), auto-counter tags from the active board should be checked against incoming/active events and resolve them automatically. Decision needed on whether this fires at turn start (event phase) or passively prevents expiry.

- _The counter should fire fire at turn start, so long as the players sees it happen_

---

## ✅ Bug 4 — `signalDeconvolution` and board `"industrial"`/`"orbital"` members target `partialMitigation` events

**Affected:** Signal Deconvolution Run (card), Markov, Al-Rashid (board — `"industrial"`), Cmdr. Osei (board — `"orbital"`).

The counter check in `game.svelte.ts` (line 861) requires `responseTier === 'fullCounter'`. Events with `partialMitigation` are excluded. As a result:
- Signal Deconvolution Run cannot counter `signalInterference`.
- Even after Bug 3 is fixed, Markov/Al-Rashid cannot auto-counter `industrialAccident` or `industrialContamination`, and Cmdr. Osei cannot auto-counter `orbitalStationEngineeringChallenge`.

**Options:**
- A) Change the affected events' `responseTier` from `partialMitigation` to `fullCounter`.
- B) Extend the counter logic to also match `partialMitigation` events when the card/board member tag matches, and treat it as equivalent to paying the mitigation cost.
- C) For board members specifically, allow auto-counters to bypass the tier check entirely (passive immunity rather than active countering).


- _B - extend the counter logic to include partialMitigation_

---

## ✅ Bug 5 — `fullNeutralise: false` is ignored on counter cards

**Affected:** Vox Populi, Coalition Building, Peer Review (all `fullNeutralise: false` on `"scandal"` counter).

The store always marks a countered event with `resolvedWith: 'counter'`, which applies no effect at all via `getEffectForResolution`. Cards flagged `fullNeutralise: false` were presumably intended to only partially reduce the scandal penalty, not eliminate it — but currently they fully neutralise it, the same as Media Blitz (`fullNeutralise: true`).

**Options:**
- A) Implement partial neutralisation: when `fullNeutralise: false`, resolve the event as `'mitigation'` instead of `'counter'`, applying the `mitigationCost` (or a fraction of the `negativeEffect`) rather than nothing. Requires adding `mitigationCost` to `politicalScandalMinor` in `events.json`.
- B) Simplify: remove `fullNeutralise` distinction entirely — all counter cards fully neutralise, differentiated only by their `additionalCost`.
- C) Keep as-is (a mild over-buff that may be acceptable given those cards' other costs).

- _A - implement partial neutralisation_

---

## What currently works correctly

| Counter | Event | Status |
|---|---|---|
| Media Blitz | Procurement Scandal | ✅ Works |
| Vox Populi | Procurement Scandal | ✅ Works (ignores `fullNeutralise: false` — see Bug 5) |
| Coalition Building | Procurement Scandal | ✅ Works (same caveat) |
| Peer Review | Procurement Scandal | ✅ Works (same caveat) |
| Back-Channel Negotiation | Supply Blockade | ✅ Works |
| All others | — | ❌ Non-functional |
