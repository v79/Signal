# Design Discussion — Era Transitions & Landmark Projects

_Discussion date: 2026-03-15_

---

## Context

The GDD already names landmark projects as the era gate mechanic (§5.2, §7), but leaves the specifics open: what the landmark costs, what unlocks it, and how the player is guided toward it.

---

## What the GDD already establishes

- §5.2: Near Space is "unlocked by completing the _Orbital Station_ landmark project."
- §7: "Landmark Projects gate era transitions. They are expensive, visible, and celebrated."
- Named landmarks: _Orbital Station_, _Crewed Orbital Station_, _Lunar Base Establishment_, _First Asteroid Mining Operation_

---

## Thematic choices for the Era 1 → Era 2 landmark

Given the alt-history 1970 start and roughly real-world pacing, by the time the player has enough tech for orbit you're probably in the early-to-mid 1980s equivalent.

| Landmark | Thematic fit | Mechanical implication |
|---|---|---|
| **International Space Station** | High — collaborative, geopolitically resonant, very expensive | Multi-phase project; requires Launch Facility + orbital tech |
| **Hubble Space Telescope** | Good but narrower — observation, signal-relevant | Better as a **Scientific Project** (big Physics/Maths bonus) than era gate |
| **Permanent Orbital Station** | Exactly what the GDD names | Clean fit; ISS is the obvious real-world template |

**Decision leaning:** Keep it as "Permanent Orbital Station" (ISS is the obvious inspiration, arriving earlier due to the alt-history head start). A "Hubble analogue" — Orbital Telescope Array — becomes a separate Scientific Project that can be done beforehand: cheaper, signal-relevant, teaches the player that space projects exist before they commit to the landmark.

---

## The guidance problem

Two distinct concerns:

1. **Signposting the goal** — the player needs to know this exists and matters
2. **Creating urgency** — the player needs a reason to pursue it *now* rather than deferring indefinitely

### Signposting — Board Proposal event

When the player discovers a prerequisite technology (e.g. Orbital Mechanics), a **board event** fires:

> *Dr. Yeva Marchetti (Chief Scientist) formally proposes that the Corporation initiate the Permanent Orbital Station programme. "We have the science. What we need now is the political will and the materials to make it real."*

This creates a **persistent board resolution** in the Board panel: "Orbital Station proposal — pending authorisation." The player can:
- **Authorise** it (spending significant Will + Funding to officially start it), or
- **Defer** it (board member resurfaces periodically in news with concern)

The proposal is tied to the Chief Scientist or Head of Engineering. If that character retires before the project completes, there's a news item about lost institutional momentum.

### Urgency — Competitor pressure events

After a certain number of turns with no authorisation, NPC blocs start completing their own orbital projects (announced in the news ticker). Effects:
- Will drain ("The public is asking why we are falling behind")
- Potential loss of "first to orbit" bonus cards/events
- No hard punishment — pressure is felt through opportunity cost, not direct penalty

### The project itself — multi-stage structure

| Stage | Cost | Duration | On completion |
|---|---|---|---|
| Phase 1 — Core Module | Funding + Materials | ~2–3 turns | News item |
| Phase 2 — Habitation Ring | Engineering card event | ~2 turns | Board member comment on milestone |
| Phase 3 — Operational | — | — | Era 2 unlocked; Will boost; new board seat opens |

Multi-stage means the player commits incrementally rather than all at once.

---

## Integration with existing systems

- **Tech prerequisites:** Orbital Mechanics (tier 2 tech) must be Researched before the board proposal fires. Possibly also Closed-Loop Life Support or Advanced Materials as a second gate.
- **Orbital Telescope Array (warm-up Scientific Project):** Available before the landmark; cheaper, requires fewer techs, teaches the player that space projects exist. Provides a signal bonus and strong Physics/Maths output. Natural "first step to space" without being didactic.
- **"Station Commander" board role** unlocked on project completion — operational buffs, Era 2 launch cost reduction. May overlap with existing Director of Operations; to be determined.

---

## Open questions

1. Should the board proposal trigger on tech discovery (automatic), or on building something deliberate like a Launch Facility?
2. Is "Station Commander" a new board role, or does the Director of Operations absorb it?
3. **Hard vs soft era gate:** Should the Near Space map be completely invisible until the landmark, or visible but inert (allowing earlier planning)?
4. Can NPC blocs beat the player to orbit? If so, do they gain permanent Era 2 advantages, or just first-mover narrative flavour?
5. What is the equivalent guidance mechanic for Era 2 → Era 3 (Lunar Base / Deep Space Transit)?

---

## Era 2 → Era 3 (placeholder)

Not yet discussed in detail. The GDD names _Lunar Base Establishment_ or _Deep Space Transit_ as the Era 3 gate. The same board-proposal + multi-stage pattern likely applies, but the urgency driver changes — by this point climate pressure on Earth is the push factor rather than geopolitical competition.
