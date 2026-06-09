# Design Discussion — Era 3: The Asteroid Belt & the Road to the Wormhole

_Discussion date: 2026-06-09_

---

## Context

What the GDD and FUTURE_PHASES already establish:

- **GDD §5.3:** Node-network map (not a tile grid). Prospecting reveals resource nodes; the player establishes mining operations and builds transit routes. Near-infinite Materials. "Further nodes may unlock toward the Jovian moons and beyond, guided by the signal."
- **GDD §9.3:** In Era 3 the signal is urgent, its content partially decoded, **its origin point identified**. The response choice defines the endgame.
- **GDD §16.6:** The wormhole is a fixed structure in the **outer Kuiper Belt**. The climax is a choice card whose quality (number of options, clarity of consequences) depends on preparation.
- **FUTURE_PHASES (Era 3):** Prospecting as the core mechanic? Hohmann transfers linking nodes? A new resource type? Most sci-fi era; must connect to the Signal and the Wormhole.
- **DESIGN_ERA_TRANSITIONS:** Era 2→3 gate is Lunar Base Establishment or Deep Space Transit (TBD); guidance "could be prompted by signal decoding".

## The design problem

Era 3 has two jobs that Eras 1 and 2 don't:

1. **A new verb.** Eras 1 and 2 are both "place facilities on a visible map and manage adjacency/supply". If Era 3 is just "the same, but nodes", it's an epilogue, not an era.
2. **Story propulsion.** The map itself must pull the player toward the wormhole. The signal can't stay a passive progress bar in the corner — in Era 3 it has to become *the thing the map is about*.

The risk to avoid: three disconnected systems (mining, prospecting, signal) that each tick along independently. The proposal below makes them one loop.

---

## Core proposal: "Expand to listen" — the belt is an antenna

Three interlocking pieces. Each is individually buildable; together they form the Era 3 loop.

### 1. Prospecting expeditions — the new verb

The Era 3 map starts **almost entirely dark**. Unlike Eras 1 and 2, the player cannot see where to build. The first genuinely new mechanic of the game: **exploration under uncertainty**.

- A new standing action (**Launch Expedition**) targets a region of the belt map; the expedition takes N turns and reveals the nodes there (seeded — node distribution is deterministic per seed, satisfying the shareable-seed constraint).
- Node types found: **metallic** (Materials, large), **icy/volatile** (the new resource, see §3), **anomalous** (story — signal echoes, ancient debris, signal-derived tech opportunities per GDD §4.6).
- Expeditions have variance: a dud region, a jackpot, an event ("the survey craft has stopped responding"). This is where the "most sci-fi era" flavour lives.
- Action cards add variety on top: _Long-Period Survey_, _Crewed Prospecting Mission_ (faster/better but risks a board-visible disaster), _Purchase Survey Data_ (from another bloc).

This respects the core constraint: research is still never directed. The player chooses *where to look*, not what to discover.

### 2. Triangulation — the story driver

How does "the origin point is identified" (GDD §9.3) actually happen mechanically? Proposal: **localising the signal source is geometric, not just cumulative**.

- In Era 3, signal decode progress past a threshold requires a **long-baseline array**: Deep Space Arrays built on nodes far apart act as an interferometer.
- **Baseline length — the maximum distance between the player's active arrays — gates signal progress.** Expanding outward is no longer only about resources; the belt is an antenna, and the player is building its dish.
- The map shows the payoff directly: an **origin ellipse** — the search area for the signal source — drawn over the outer map. Each baseline improvement and each decode milestone shrinks it. The player literally watches the search area collapse onto a point in the Kuiper Belt across the era.
- The final fix reveals the **wormhole node** at the far edge of the map. Reaching it (transit chain, below) sets up the existing climax design: the response choice card, then the crewed mission landmark.

This also gives the **Signal Misinterpretation loss** (GDD §11.2) and the prep-quality climax (GDD §16.6) a concrete mechanical cause: a player who never built baseline gets a poor fix — fewer response options, no confidence indicators, and in the worst case a mission sent to coordinates that were never quite right.

### 3. Volatiles + transit chains — the new resource and the infrastructure endgame

The FUTURE_PHASES question "introduce a new resource type in Era 3?" — yes, and it should be about **reach**, not another stockpile to optimise:

- **Volatiles** (water ice/propellant), mined from icy nodes. Spent on expeditions and on transit between nodes; transit cost scales with distance.
- Era 1–2 launches priced everything in Funding from Earth's gravity well. Belt-sourced Volatiles are what make deep space self-sustaining — the mechanical expression of "leaving Earth behind".
- The Kuiper Belt is *far*. Reaching the wormhole node requires a **chain of refuelling depots** across the outer map — the Era 3 equivalent of Era 1's adjacency puzzle, and the visible infrastructure arc of the endgame. The final crewed mission travels the chain the player built.
- Implementation: keep Volatiles a **global stockpile** (consistent with the existing resource engine and HUD) with distance-scaled transit costs. Per-node inventories would be more "realistic" but multiply UI and engine complexity for little strategic gain.

**Hohmann transfer windows** (routes between node clusters open/close on a multi-turn cycle) are an optional timing layer on top of this. Flavourful, but they fight readability and add a waiting mechanic. Recommend: **defer** — design the route system so windows could be added later, don't build them in v1.

---

## How the loop drives the endgame

```
prospect → find icy nodes → mine Volatiles → reach further
        → find metallic nodes → Materials economy (terraforming/hegemony fuel)
        → find far-apart array sites → longer baseline → decode progress
        → origin ellipse shrinks → Kuiper expansion → wormhole node
        → response choice → crewed mission through the depot chain → victory
```

Every victory path touches the loop without being forced through all of it:

- **Wormhole:** the whole loop, fully.
- **Terraforming Mars:** needs the Materials + Volatiles economy; can ignore baseline (at Misinterpretation risk, as designed).
- **Economic Hegemony:** belt Materials exported to the surviving blocs; contested-node and claim events.
- **Ecological Restoration:** needs only minimal Era 3 presence — but the minimum signal awareness rule still applies, which the baseline mechanic makes legible ("you have one array; you cannot localise the source").

**Other blocs:** by Era 3 only 2–3 retain off-world presence (GDD §8.4). They appear as competing prospectors — claim announcements in the news, occasional contested-node or data-sharing events. Light touch, simulated-presence rules as ever.

**Era 2→3 gate tie-in:** this supports the DESIGN_ERA_TRANSITIONS suggestion that the gate is signal-prompted — the board proposal for Deep Space Transit can fire when decode progress hits the "we need a longer baseline than cislunar space allows" wall, giving the transition an in-fiction *reason* rather than just a tech threshold.

## Considered and set aside

- **Crew/Population as the new resource** — adds bookkeeping without a new verb; the AI board members (Era 3 milestone) already carry the "humans are far from home" theme.
- **Drifting nodes / live orbital mechanics** — beautiful, expensive, and hostile to readability and determinism. The origin ellipse + transfer-window-ready routes capture the flavour at a fraction of the cost.
- **Prospecting as a minigame** — keep expeditions resolved by the engine (seeded), consistent with the rest of the game; the signal minigame (SIGNAL_MINIGAME.md) remains the era's interactive set-piece.

---

## Open questions

1. Volatiles as a true 4th HUD resource, or an Era 3-only resource shown just on the belt tab? (Recommend: 4th resource, appearing in HUD when Era 3 unlocks — same pattern as map tabs.)
2. Expedition targeting: does the player pick a direction/ring sector, or pay tiered costs for "near / mid / far" surveys? (Recommend: sector-based — keeps it spatial and map-driven.)
3. Should the origin ellipse be visible (faint, huge) from late Era 2, as the narrative hook that pulls the player into Era 3?
4. Do anomalous nodes grant the GDD §4.6 signal-derived technologies, making prospecting the delivery mechanism for that whole feature?
5. Does Era 3 keep the 1-year turn cadence, or stretch it (GDD §16.1 flags this as a playtest variable)? Expedition/transit durations depend on the answer.
6. How much Kuiper expansion should non-wormhole victories require? (Proposal above: none mandatory, but Misinterpretation risk scales with ignorance.)
7. Transfer windows: deferred entirely, or a single simplified version (e.g. "outer routes cost double except every 4th turn")?
