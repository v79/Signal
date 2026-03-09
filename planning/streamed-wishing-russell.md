# Layout Redesign Options

## Context

The current layout is running out of vertical space on laptop screens (~900px or less). Two specific symptoms:

1. **News feed invisible** — the right column splits `1fr / 1fr` between ResearchFeed and BoardPanel. ResearchFeed's non-news content (6 field bars + signal track + dividers + titles) already consumes ~236px. On a 900px screen the right panel is only ~310px tall each, leaving ~74px for the actual news list. On 768px screens it disappears entirely.

2. **Card hand scrollbar** — the bottom row is capped at `max-height: 14rem` (224px). StandingActions (5 wrapped buttons) takes ~100–120px. Cards are ~150–160px tall. The card hand is vertically clipped before a single full card fits.

### Current layout structure
```
┌─────────────────────────────────────────────────┐  ~2rem  HUD
├──────────┬──────────────────────┬───────────────┤
│EventZone │                      │ ResearchFeed  │
│  17rem   │      Map (1fr)       │    ½ height   │  flex:1
│          │                      │ BoardPanel    │
│          │                      │    ½ height   │
├──────────┴──────────────────────┴───────────────┤  1.6rem NewsTicker
├───────────────────┬─────────────┬───────────────┤
│StandingActions    │  CardHand   │ PhaseControls │  max 14rem
│OngoingActions     │    1fr      │               │
└───────────────────┴─────────────┴───────────────┘
```

---

## Option A — Tabbed right panel (low effort)

**Change:** Replace the `1fr / 1fr` right-column grid with a tab bar. ResearchFeed and BoardPanel share the full height, one visible at a time. Add a `[RESEARCH | BOARD]` tab strip at the top of the right column.

**Also:** Increase `max-height` on `.bottom-row` from 14rem → 18rem to give cards more room.

**Impact on layout:**
```
Right column: [RESEARCH][BOARD] tabs
              full height → one panel
```

- **Fixes:** News feed now has ~310px instead of ~155px on a 900px screen
- **Fixes (partially):** Cards get 4rem more vertical space (still tight if StandingActions wraps to 3 rows)
- **Doesn't fix:** StandingActions still competes with cards for the 18rem budget
- **Risk:** Low — tabs are a single Svelte `$state` toggle, no new components needed
- **Best for:** If you want minimal disruption; acceptable to not see both panels at once

---

## Option B — Left sidebar absorbs standing actions (moderate effort)

**Change:** Move StandingActions and PhaseControls into the **left column** (EventZone panel), pinned to the bottom. The bottom row becomes **CardHand only** (full width).

```
┌─────────────────────────────────────────────────┐  HUD
├──────────┬──────────────────────┬───────────────┤
│EventZone │                      │ ResearchFeed  │
│          │      Map (1fr)       │   [RESEARCH]  │  flex:1
│──────────│                      │   [BOARD]     │
│Standing  │                      │   tabs        │
│──────────│                      │               │
│Phase Ctrl│                      │               │
├──────────┴──────────────────────┴───────────────┤  NewsTicker
├─────────────────────────────────────────────────┤
│                  CardHand (full width)           │  ~10rem
└─────────────────────────────────────────────────┘
```

- **Fixes:** Card hand gets the full viewport width; no height competition from StandingActions
- **Fixes:** Right panel tabs resolve news feed visibility
- **Fixes:** PhaseControls is always visible, not squeezed into the bottom corner
- **Consideration:** Events + Standing Actions + PhaseControls in the left column may feel crowded when events are active. EventZone would need a max-height or internal scroll.
- **Risk:** Moderate — needs EventZone to accommodate the new pinned elements
- **Best for:** Clean separation of "map view" from "action controls"

---

## Option C — Card hand as a slide-up drawer (high effort, best for small screens)

**Change:** The card hand is hidden by default (collapsed to a thin ~2rem strip labelled "HAND — 4 cards"). Clicking it or entering Action/Bank phase causes it to slide up as a fixed-height overlay (not affecting the layout of the rows above). Outside of Action/Bank phases the drawer auto-collapses.

```
Middle row expands to fill all space below the HUD during Event/World phases.
During Action/Bank phase, the drawer slides up ~12rem from the bottom.
```

- **Fixes:** Maximum map/panel space on small screens during non-action phases
- **Fixes:** Cards have a dedicated fixed-height space sized exactly for them
- **Consideration:** Adds animation complexity; phase-awareness needed in the component
- **Risk:** High — biggest departure from the current layout
- **Best for:** Small laptop-first design; particularly useful once more cards are added

---

## Option D — Wider layout with right panel tabs (minimal structural change)

**Change:** Widen the right column from 16rem → 20rem. Replace the 1fr/1fr split with tabs (same as Option A). Shrink the left EventZone column from 17rem → 15rem (events are small cards). Increase the bottom row to 16rem.

This is purely a numbers + tabs change in `+page.svelte` and right-column CSS — no component restructuring.

- **Fixes:** More width in the right panel means field bars and news text are more readable
- **Partially fixes:** Bottom row 16rem buys ~32px more for cards
- **Doesn't fix:** StandingActions still competes with cards in the bottom row
- **Risk:** Very low — CSS values + one tab toggle
- **Best for:** Fastest path to "good enough" without structural changes

---

## Recommendation

**Short term:** Option D (widen columns, add tabs) — addresses the news feed problem with 1–2 hours of work, no structural risk.

**Medium term:** Option B (standing actions to left sidebar) — combines well with Option D and cleanly solves the card hand problem. The left sidebar becoming a "controls" zone is architecturally coherent with the game design.

**Option C** is worth revisiting when more cards exist and the bottom bar becomes truly untenable.

---

## Files affected (for whichever option is chosen)

| File | Change |
|---|---|
| `src/routes/+page.svelte` | Column sizing, layout structure, tab state |
| `src/lib/components/ResearchFeed.svelte` | Remove internal news panel if news moves; tab integration |
| `src/lib/components/BoardPanel.svelte` | Tab integration |
| `src/lib/components/EventZone.svelte` | Height management if left column changes |
| `src/lib/components/StandingActions.svelte` | If moved to left sidebar |
| `src/lib/components/PhaseControls.svelte` | If moved to left sidebar |
| `src/lib/components/CardHand.svelte` | Height constraints / drawer behaviour |
