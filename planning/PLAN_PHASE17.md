# Phase 17 — UI Rework

## Goal

Polish the existing HUD, card hand, standing actions, and phase controls to be cleaner, more readable, and more responsive. No new game mechanics; pure UI quality improvements.

## Scope

This phase covers the first bullet in `FUTURE_PHASES.md`:

> - UI rework:
>   - clean up the Next turn interface
>   - Rounding of resource numbers
>   - Materials should be brown, not blue
>   - Visual flare/animation/effect when the player takes actions
>   - Hover tooltips for most UI elements
>   - Collapsible panels

Plus the standing actions layout improvement and card bank repositioning, which are tightly coupled to the layout changes here.

Out of scope for Phase 17 (covered in later phases):
- More cards / card gating by tech
- LEO / Asteroid era content passes
- Game art / building icons / board portraits
- Tech tree dependencies / narrative popups
- Narrative interface (opening sequence, era transitions, story modals)

---

## Tasks

### 17.1 — Materials colour (trivial) ✓ COMPLETE

**File:** `src/lib/components/HUD.svelte`

- Change Materials colour from `#6ab0d8` (blue) to `#8B5E3C` (brown).
- Update the matching colour in `src/lib/components/ResearchFeed.svelte` if the same hex appears there for field bars.
- Verify no other component hardcodes the Materials blue.

**Acceptance:** The Materials resource label and value render in brown in the HUD; the research field bars are unaffected.

---

### 17.2 — Round resource numbers ✓ COMPLETE

**File:** `src/lib/components/HUD.svelte`

Resources (`funding`, `materials`, `politicalWill`) are raw integers today. Display them rounded to the nearest integer — they are already integers from the engine, but future-proof the display by using `Math.round()` in the template expression. Also add a `toLocaleString()` call so large numbers (>999) show commas (e.g. `1,250`).

Implementation:
```ts
// helper (add to <script> block)
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
```

Use `{fmt(resources.funding)}` etc. in the template.

**Acceptance:** Resource values display with commas for large numbers; fractional values (if ever produced by buffs) are rounded.

---

### 17.3 — Clean up PhaseControls (remove redundant turn number) ✓ COMPLETE

**File:** `src/lib/components/PhaseControls.svelte`

The `.turn-label` div showing "Turn {turn}" is redundant — the turn number is already visible in the HUD. Remove it. The `turn` prop can be removed from the component interface too; verify no other logic in the component depends on it.

Tighten the button label copy:
- Current: `"END ACTION →"` / `"END TURN ⟳"` / phase name
- Proposed: keep phase-state labels as-is but remove the outer wrapper div that contains the turn label.

**Acceptance:** PhaseControls renders only the advance button (and any phase indicator), no separate turn label.

---

### 17.4 — Hover tooltips for HUD elements

**Approach:** Use a lightweight Svelte tooltip component (CSS-only, no library). Create `src/lib/components/Tooltip.svelte`.

```svelte
<!-- Tooltip.svelte — wraps any element; shows tooltip on hover -->
<script lang="ts">
  let { text, children } = $props<{ text: string }>();
</script>

<span class="tooltip-host">
  {@render children()}
  <span class="tooltip-bubble">{text}</span>
</span>

<style>
  .tooltip-host { position: relative; display: inline-block; }
  .tooltip-bubble {
    visibility: hidden; opacity: 0;
    position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
    background: #1a2236; color: #c8d8f0; font-size: 0.6rem;
    padding: 0.25rem 0.5rem; border-radius: 3px; white-space: nowrap;
    pointer-events: none; transition: opacity 0.15s;
    border: 1px solid #2a3a56; z-index: 100;
  }
  .tooltip-host:hover .tooltip-bubble { visibility: visible; opacity: 1; }
</style>
```

Apply tooltips to:

| Element | Tooltip text |
|---|---|
| Funding value | "Current funding. Gained from funding facilities and cards." |
| Materials value | "Raw materials. Gained from mines and industrial zones." |
| PoliticalWill value | "Political will. Volatile in democracies; stable but fragile in authoritarian blocs." |
| Each research field abbreviation (PHY, MTH, etc.) | Full field name + short description |
| Climate bar | "Earth climate index. Falls as you industrialise; affects event probabilities." |
| Will bar | "Global political will level." |

**Files affected:** `HUD.svelte`, new `Tooltip.svelte`.

---

### 17.5 — Hover tooltips for StandingActions

**File:** `src/lib/components/StandingActions.svelte`

Currently uses the native `title` attribute. Replace with the new `Tooltip.svelte` wrapper on each action button. The tooltip should show:
- Action description (already available as `action.description`)
- Cost breakdown (already shown on button but tooltip should repeat it for disabled state clarity)
- If disabled due to phase: "Not available during [phase] phase"
- If disabled due to resources: "Insufficient [resource]"

---

### 17.6 — Collapsible panels

Add a collapse toggle to `ResearchFeed.svelte`, `BoardPanel.svelte`, and `OngoingActionsPanel.svelte`. Each panel gets a `▾ / ▸` toggle button in its header that toggles a `collapsed` local `$state` boolean. When collapsed, only the header row is visible (saves vertical space on busy screens).

Implementation pattern (same for each panel):

```svelte
<script lang="ts">
  let collapsed = $state(false);
</script>

<div class="panel" class:collapsed>
  <div class="panel-header" onclick={() => collapsed = !collapsed}>
    <span class="panel-title">RESEARCH</span>
    <span class="collapse-toggle">{collapsed ? '▸' : '▾'}</span>
  </div>
  {#if !collapsed}
    <!-- panel body -->
  {/if}
</div>
```

**Files:** `ResearchFeed.svelte`, `BoardPanel.svelte`, `OngoingActionsPanel.svelte`.

---

### 17.7 — Standing actions: compact multi-row layout

**File:** `src/lib/components/StandingActions.svelte`

Current layout: one `flex-wrap` row of buttons ~`4.5rem` min-width each.

New layout:
- Remove `min-width` on buttons; let them size to content with `padding: 0.3rem 0.5rem`.
- Grid layout: `grid-template-columns: repeat(3, auto)` so actions wrap into a 3-column grid naturally.
- Cost badge: move cost from button label into a small subscript badge below the button name, styled in the resource colour.
- Target: 5 current standing actions fit into 2 rows (3 + 2), freeing vertical space.

**Acceptance:** All 5 standing actions visible in ≤ 3 rows; bottom-row height constraint in `+page.svelte` may be relaxed from `14rem` to `16rem` to accommodate.

---

### 17.8 — Card bank: side layout

**File:** `src/lib/components/CardHand.svelte`

Current: bank section rendered above hand section (vertical stack).

New layout: horizontal flex row with bank on the left (if non-empty) and hand cards on the right.

```svelte
<div class="card-area">
  {#if bankedCards.length > 0}
    <div class="bank-column">
      <div class="bank-label">BANK ({bankedCards.length}/2)</div>
      <!-- banked cards -->
    </div>
    <div class="bank-divider" />
  {/if}
  <div class="hand-column">
    <!-- hand cards -->
  </div>
</div>
```

Bank cards should be slightly narrower (`9rem`) than hand cards (`11rem`) and use a muted border colour to indicate they are held-over, not freshly drawn.

**Acceptance:** When cards are banked, they appear to the left of the hand with a vertical divider; no vertical stacking.

---

### 17.9 — Visual feedback on player actions

Add brief CSS animations triggered when the player performs significant actions:

| Trigger | Effect |
|---|---|
| Build facility | Hex tile flashes green (handled in `EarthScene.ts` — Phaser tween) |
| Play card | Card slides up and fades out before being removed from hand |
| Bank card | Card slides left toward the bank column |
| New turn draw | Cards deal in from the right with a stagger delay |
| Resource tick (positive) | Resource value briefly highlights green |
| Resource tick (negative) | Resource value briefly highlights red |

**Implementation:**
- Card animations: CSS `@keyframes` in `CardHand.svelte`; trigger by binding a per-card `animating` class to a `$state` set.
- Hex flash: Phaser tween in `EarthScene.ts`, fired via the `worldPhaseComplete` event or a new `facilityBuilt` custom event dispatched from the store.
- Resource highlight: `HUD.svelte` watches previous vs current resource values in a `$derived`; applies `.flash-up` / `.flash-down` class for 600ms.

For the card reshuffle (new hand drawn each turn): when `hand` prop changes length from 0→N (after draw), apply a stagger CSS animation to each card.

**Files:** `CardHand.svelte`, `HUD.svelte`, `EarthScene.ts`, `src/lib/stores/game.svelte.ts` (may need a `facilityBuilt` event emission).

---

## File Change Summary

| File | Change |
|---|---|
| `src/lib/components/HUD.svelte` | Brown Materials colour; `fmt()` helper; resource tooltips; field tooltips; flash animations |
| `src/lib/components/PhaseControls.svelte` | Remove turn label; remove `turn` prop |
| `src/lib/components/StandingActions.svelte` | Grid layout; compact buttons; Tooltip.svelte wrappers |
| `src/lib/components/CardHand.svelte` | Side-by-side bank layout; deal-in animation; card play/bank animations |
| `src/lib/components/ResearchFeed.svelte` | Collapsible header toggle |
| `src/lib/components/BoardPanel.svelte` | Collapsible header toggle |
| `src/lib/components/OngoingActionsPanel.svelte` | Collapsible header toggle |
| `src/lib/components/Tooltip.svelte` | **New file** — lightweight CSS tooltip wrapper |
| `src/phaser/EarthScene.ts` | Hex flash tween on facility build event |
| `src/routes/+page.svelte` | Relax bottom-row `max-height` from `14rem` → `16rem` |

No engine files (`src/engine/`) change. No new tests needed (pure UI); manual smoke-test checklist in Acceptance section below.

---

## Acceptance Checklist

- [x] Materials resource label and value are brown in HUD
- [x] Resource values display with comma separators for large numbers
- [x] PhaseControls shows no separate turn number
- [ ] Hovering a resource value shows a descriptive tooltip
- [ ] Hovering a research field abbreviation shows the full field name
- [ ] ResearchFeed, BoardPanel, and OngoingActionsPanel each have a working collapse toggle
- [ ] Standing actions render in a compact ≤3-row grid; all 5 actions visible without scrolling
- [ ] Hovering a disabled action shows why it is disabled
- [ ] Banked cards appear to the left of hand cards with a divider
- [ ] Playing a card triggers a slide-up/fade animation
- [ ] Drawing a new hand triggers a stagger deal-in animation
- [ ] Building a facility triggers a brief green flash on the hex
- [ ] Resource values flash green/red on tick gain/loss
- [ ] `npm run lint` passes with no new errors
- [ ] `npm run test:run` still shows 337 tests passing (no regressions)

---

## Implementation Order

1. 17.1 — Materials colour (1 line, lowest risk, do first)
2. 17.2 — Round resource numbers
3. 17.3 — Remove redundant turn label from PhaseControls
4. 17.4 — Create Tooltip.svelte; apply to HUD
5. 17.5 — Apply Tooltip to StandingActions
6. 17.6 — Collapsible panels (ResearchFeed, BoardPanel, OngoingActionsPanel)
7. 17.7 — StandingActions grid layout
8. 17.8 — Card bank side layout
9. 17.9 — Animations (most complex; do last)
