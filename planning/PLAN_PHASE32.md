# Phase 32 — Tech Tree: Era Awareness, Scalable Layout, and Node Tooltips

## Status: COMPLETE ✅

## Background

The tech tree has three concrete issues now that Era 2 content exists, plus a UX gap (no interactivity beyond pan/zoom):

1. **Hardcoded era header** — "ERA I — EARTH PROGRAMME" never changes.
2. **Hardcoded 4-column dividers** — `drawBackground` uses `W / 4` and draws exactly 3 dividers, ignoring `numTiers`. Columns beyond 4 get no divider and the spacing breaks.
3. **Era tier collision** — Era 1 and Era 2 both use tiers 1–5. When both are visible, the tier columns collide. Needs era-scoped layout.
4. **No node interaction** — nodes cannot be clicked or hovered; all detail is crammed into a 188×160px card.

There is also a minor type-safety issue: `getTechTier` is typed `→ 1|2|3|4` but tier 5 already exists and higher tiers will follow.

---

## Deliverables

### 32.1 — Dynamic era header

**Change:** Pass the game's current `era` into `TechTreeModal` and derive the header label from it.

In `+page.svelte` the game `era` is already available (`gameStore.state.era`). Add `era: Era` prop to `TechTreeModal`, then compute:

```
earth      → "ERA I — EARTH PROGRAMME"
nearSpace  → "ERA II — NEAR SPACE PROGRAMME"
deepSpace  → "ERA III — DEEP SPACE PROGRAMME"
```

The discovered-count stat (`N/N CONFIRMED`) should count only techs belonging to the **currently displayed era** (see 32.3 for era switching), not the total across all eras.

---

### 32.2 — Fix background column dividers

`drawBackground` must receive `numTiers` and compute divider positions dynamically:

```ts
// Before (broken):
const colW = W / 4;
for (let i = 1; i < 4; i++) { ... }

// After:
const colW = W / numTiers;
for (let i = 1; i < numTiers; i++) { ... }
```

Also fix `getTechTier` return type from `1|2|3|4` to `number` so tier 5 and beyond are not silently narrowed.

---

### 32.3 — Era-scoped layout with era switcher

**Problem:** Era 1 and Era 2 both use tier 1–5 numbering. Showing both in one flat grid would produce two "Tier I" columns.

**Solution:** Show one era at a time; add an era switcher in the modal header.

**Layout:**
- Header gains three small tab buttons on the left of the status area: `ERA I` / `ERA II` / `ERA III` (disabled/hidden until that era is reached).
- Selected era tab filters which techs the Phaser scene receives.
- Default view on open = player's current era.
- `numTiers` is computed from the filtered set, so columns are always 1–5 per era.

**`TechTreeSceneData` change:** No change — the scene continues to receive a flat `TechState[]`; era filtering happens in Svelte before passing.

**Discovery count** in the header shows `N discovered / M total` for the selected era only.

---

### 32.4 — Node click → detail panel

Nodes should be clickable. Click opens a detail panel rendered in HTML (not Phaser) on the right side of the modal.

#### Detecting clicks in the Phaser scene

During `redraw()`, store a hit-rect registry: `Map<string, { x, y, w, h }>` keyed by `defId`. On `pointerup`, if the pointer has not moved more than a small drag threshold (~4px), convert the screen pointer to world coordinates accounting for current camera scroll and zoom, and check the hit-rect map. If a node is hit, fire the callback.

```ts
// TechTreeSceneData gains:
onNodeClick?: (defId: string) => void;
```

The scene calls `onNodeClick(defId)` on a qualifying tap. `TechTreeModal` passes a Svelte state setter as this callback.

#### Detail panel content (HTML overlay)

A right-side panel (280px wide, full canvas height) slides in when a node is selected. It shows:

| Stage | Content shown |
|---|---|
| unknown | Tier badge, "ACCESS RESTRICTED" |
| signal-hidden | "Signal source unresolved", signal strength hint |
| rumour | Name, tier, rumour flavour text, prerequisite names (with lock icons if unmet) |
| progress | Name, tier, full recipe table (field / threshold / current / %), prerequisites, unlocks list |
| discovered | Name, tier, full recipe (greyed/filled), unlocks (cards, facilities, tile actions with names) |

Panel is dismissed by clicking elsewhere on the canvas, pressing Escape, or clicking a × button on the panel.

When the panel is open, the canvas width shrinks to make room (the Phaser `Game` instance resizes via `game.scale.resize()`).

#### Hover cursor

On `pointermove`, if the pointer is over a node hit-rect (and not dragging), switch cursor to `pointer`. Otherwise show `grab`.

---

### 32.5 — TIER_LABEL_NAMES overflow guard

Extend the label array or compute Roman numerals programmatically so any tier renders correctly:

```ts
function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}
```

Replace the `TIER_LABEL_NAMES` array with a call to `toRoman(i + 1)`.

---

## Files touched

| File | Changes |
|---|---|
| `src/routes/+page.svelte` | Pass `era` prop to `TechTreeModal` |
| `src/lib/components/TechTreeModal.svelte` | Add `era` prop; era switcher tabs; wire `onNodeClick`; render detail panel; resize canvas when panel open |
| `src/phaser/TechTreeScene.ts` | Fix `drawBackground` dividers; add hit-rect registry; click detection; hover cursor; `toRoman` helper; `getTechTier` return type fix |
| `src/engine/techTree.ts` | Fix `getTechTier` return type to `number` |

---

## Open questions

_Answers from user will appear in underline below each question._

1. **Detail panel position:** Right-side panel (canvas shrinks) vs floating overlay at the node's position vs bottom-strip? Right panel is proposed above — does that work on your typical screen size?

- _The right panel should fit best; screens are normally wider than they are tall_

2. **Unknown nodes:** Should clicking an unknown node do anything, or should clicks on unknown nodes be silently ignored (only interact with rumour/progress/discovered)?

- _Only interact with progress and discovered nodes_

3. **Era switcher visibility:** Show the ERA II tab greyed-out from the start (always visible but disabled until reached), or only show it once the player enters Era 2?

- _Show the ERA II and ERA III tabs but disabled. The player can already see the map tabs for Earth, Near Orbit, and Asteroid Belt_

4. **Minimum column count:** Should Era 1 always show 5 columns (even if fewer than 5 tiers have any techs), or shrink to however many tiers exist? Currently minimum is 4.

- _Shrink to the number of tiers in the Era_
