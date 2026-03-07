# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository currently contains only a Game Design Document (`SignalGDD.md`). No code exists yet. This file captures the intended architecture and tech stack to guide initial implementation.

## Tech Stack (from GDD §15)

- **Game rendering:** TypeScript + Phaser.js (tile map, scene management, assets)
- **UI framework:** SvelteKit — for HUD, card hand, event zone overlays on top of the Phaser canvas
- **Build tooling:** Vite (native to SvelteKit; also works standalone with Phaser)
- **Testing:** Vitest (game logic, research field calculations, event system)
- **Map authoring:** Tiled (hex grid, exports Phaser-compatible format)
- **Hosting target:** AWS S3 + CloudFront (static; no server needed)
- **Save system:** JSON snapshot to browser localStorage or file download — no account system

## Commands (once project is scaffolded)

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run test       # Run Vitest suite
npm run test -- --reporter=verbose <pattern>  # Run a single test file or pattern
npm run lint       # Type-check and lint
```

## Architecture

The game has three distinct map layers that unlock progressively. Each has its own rendering approach:

- **Era 1 — Earth:** Hex tile grid (Phaser + Tiled). Tiles have types (urban, industrial, coastal, etc.) with adjacency bonuses/penalties between facilities.
- **Era 2 — Near Space:** Second Phaser scene/layer. Distance and launch cost replace geographic adjacency.
- **Era 3 — Asteroid Belt:** Node/network graph (not a tile grid). Sparse, dark aesthetic with glowing nodes and transit lines.

### Core Systems

**Resources:** Three resources (`Funding`, `Materials`, `PoliticalWill`) tick each World Phase. Will behaviour differs by bloc type — democratic blocs are volatile with a high ceiling; authoritarian blocs are stable with catastrophic collapse risk.

**Research fields:** Five fields (`Physics`, `Mathematics`, `Engineering`, `Biology`, `Computing`) accumulate passively from facilities and played cards. The player never directly assigns research. Each tech has a randomised-per-seed recipe (field point thresholds); recipes vary in exact proportions each run but the general shape of each tech is stable.

**Technology discovery:** Three visibility stages — Unknown (hidden), Rumour (vague flavour hint in feed), Progress (named with progress bar visible). Cross-field breakthroughs require multiple fields simultaneously above threshold.

**Card system:** Three zones per turn:
1. **Standing Actions** — persistent toolbar (Build Facility, Initiate Project, etc.); always available, never drawn
2. **Action Hand** — drawn each turn (4–5 cards); opportunity cards, powerful one-offs
3. **Event Zone** — incoming world events with countdown timers; some have counter cards, some have partial mitigation, some must simply be absorbed

Banking mechanic: up to 2 cards held between turns at 1 Funding/card/turn decay cost.

**Turn phases (in order):** Event → Draw → Action → Bank → World

**Other blocs:** Simulated presences (not AI competitors). Advance each World Phase via simple weighted rules. Player sees outputs only — news ticker, world map view, diplomatic event cards. Blocs can decline, merge, or be eliminated via narrative events.

**Board system:** 5–7 named characters in role slots (Chief Scientist, Director of Engineering, Head of Finance, Political Liaison, Director of Operations, etc.). Each has 1–2 buffs and one debuff — characters are trade-offs, not free upgrades. Characters age, retire, resign, and die. AI board members become available in Era 3.

**Signal track:** Separate from research fields but fed by Physics and Mathematics investment plus signal analysis infrastructure (Deep Space Arrays, dedicated projects). Three decoding stages across eras. FTL victory climax is a late-game choice card with 2–3 candidate responses; quality of preparation determines how many options appear and how clearly consequences are signalled.

### Key Design Constraints to Preserve

- **Research is never a direct action.** It accumulates because of what the player builds and plays. Do not add a "Research" standing action or direct field-point purchase.
- **The signal is a system, not a being.** It has no personality or agenda. All event text and flavour writing must reflect this — it is an automated alien device activated by humanity's first satellites.
- **The wormhole is a fixed structure at the heliopause, not invented FTL technology.** It cannot be replicated; there is only one door. The destination is never revealed.
- **Game state is fully client-side.** Seeded runs (shareable seed strings) are a lightweight community feature; the seed must deterministically drive bloc simulation and event pools.
- **Some events cannot be countered.** The third event-response tier (no counter) must remain in the design — the player should never feel perfect play counters everything.
- **Multiplayer is explicitly out of scope** — not a deferral, a positive design choice.