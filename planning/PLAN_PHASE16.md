# Phase 16 — Tech Tree Visualisation

**Status: COMPLETE** (branch `feature/phase-16-tech-tree`, committed `80ebd33`)

---

## Overview

The research system is the central mechanic of Signal, but it is currently invisible. Players accumulate field points, technologies unlock in the background, and news items appear — but there is no interface that lets the player see what technologies exist, how close they are, or what discovering each one will unlock.

Phase 16 adds a **Tech Tree modal**: a full-screen overlay accessible from the Research Feed that renders technologies as interactive nodes in a **Phaser canvas**. Svelte handles the modal chrome (backdrop, header, close button); Phaser handles all node drawing, progress bars, colour coding, and — in a future phase — dependency arrows between nodes.

---

## Why Phaser, Not HTML

A pure HTML/CSS implementation would require an awkward SVG overlay to draw dependency arrows when `requiredTechIds` is added in a later phase. Phaser makes this a trivial `Graphics.strokePath()` call. Additional benefits:

- Pan and zoom come free via Phaser's Camera system as the tree grows across eras.
- Node discovery animations (glow pulse, connection propagation) are straightforward.
- The architecture follows the established pattern already used by `EarthScene`, `SpaceScene`, and `AsteroidScene` — no new patterns to introduce.

---

## Goals — All Completed

1. ✅ **Tech Tree button** — button in Research Feed header opens the modal.
2. ✅ **Phaser canvas modal** — Svelte backdrop + header; Phaser `<canvas>` fills the content area.
3. ✅ **Node layout** — technologies arranged left-to-right by complexity tier; nodes drawn as rounded rectangles with name, field bars, and stage indicator.
4. ✅ **Discovery fog** — unknown techs show a dim placeholder; rumoured techs show name + flavour hint; progress techs show live field bars; discovered techs show full detail and unlock list.
5. ✅ **Unlock preview** — discovered and in-progress nodes list unlocked cards and facilities.
6. ✅ **Signal-derived gating** — signal-derived techs shown as a sine-wave node until `signal.eraStrength !== 'faint'`.
7. ✅ **Field colour coding** — consistent field colours across all progress bars.
8. ✅ **Drag-to-pan and zoom** — mouse drag pans camera; scroll wheel and +/− HTML buttons zoom.
9. ✅ **Loading overlay** — "DECRYPTING RESEARCH ARCHIVE ···" shown while Phaser initialises.

---

## Scope Constraints

- Era 1 techs only (12 nodes). Era 2 / Era 3 content is deferred.
- No new engine logic — the scene reads existing `PlayerState.techs`, `TechDef`, and `PlayerState.fields`.
- No research interaction — research remains passive; this is a read-only view.
- No dependency arrows in this phase (no `requiredTechIds` field yet). Layout is tier-based only. The Phaser approach makes adding arrows straightforward later.

---

## Implementation Notes

### Tier thresholds (recalibrated from actual data)

The plan specified thresholds of < 80 / 80–130 / 130–200 / > 200. These did not match the actual `technologies.ts` recipe values. After checking all 12 Era 1 tech recipes the thresholds were recalibrated to produce the intended 3 / 4 / 2 / 3 distribution:

| Tier | Threshold (sum of baseRecipe) | Count |
|------|-------------------------------|-------|
| 1 | ≤ 100 | 3 |
| 2 | ≤ 165 | 4 |
| 3 | ≤ 255 | 2 |
| 4 | > 255 | 3 |

### Camera / scroll architecture

Two Phaser Graphics layers:
- `worldGfx` — scrolls with the camera (all node content, dot-grid background, column dividers).
- `uiGfx` — `setScrollFactor(0)` (legend strip, scroll hint); always pinned to the screen.

Text objects follow the same split: `addWorldText()` / `addUIText()`.

World height is computed each `redraw()` from `maxNodes × NODE_H + gaps` and passed to `camera.setBounds()` so Phaser clamps scroll correctly at any zoom level.

### Dynamic name height

Separator lines and all content below the tech name are positioned using `nameText.height` (Phaser measures this at Text creation time), not fixed offsets. This prevents overlap when a name wraps to two or more lines.

### HiDPI rendering

`Phaser.Game` config includes `resolution: window.devicePixelRatio || 1` (spread via `as object` to avoid a missing `@types/phaser` definition). This doubles the canvas buffer on retina displays so all text is sharp.

### Colour and font constants

All Phaser numeric colours are declared as named `C_*` constants (e.g. `C_GOLD`, `C_NODE_DISC`, `C_BORDER_RUMOUR`) in a dedicated palette block. All font sizes use `FS_*` constants. Neither colour values nor font sizes appear as raw literals in drawing code.

### Rumour node indicator dot

Changed from amber (`0xc8900a`) to cool blue (`C_RUMOUR_DOT = 0x3a6888`) to avoid visual confusion with the gold used for "Discovered" in the legend.

---

## Files Created / Modified

| File | Status | Notes |
|------|--------|-------|
| `src/engine/techTree.ts` | ✅ Created | `getTechTier(def): 1\|2\|3\|4` pure helper |
| `src/engine/techTree.test.ts` | ✅ Created | 18 unit tests; all pass |
| `src/phaser/TechTreeScene.ts` | ✅ Created | Phaser scene: layout, drawing, camera, drag/zoom |
| `src/lib/components/TechTreeModal.svelte` | ✅ Created | Svelte modal chrome + Phaser.Game lifecycle + loading overlay |
| `src/lib/components/ResearchFeed.svelte` | ✅ Modified | TECH TREE button + new props |
| `src/routes/+page.svelte` | ✅ Modified | Import `TECH_DEFS`; pass to `ResearchFeed` |
| `e2e/tech-tree.spec.ts` | ✅ Created | 7 Playwright e2e tests |

---

## Test Results

| Suite | Tests |
|-------|-------|
| Engine (Vitest) | 337 passing |
| E2E (Playwright) | 7 tech-tree tests defined |

---

## Manual Review Checklist

- [x] All 12 Era 1 techs appear in the correct tier column.
- [x] Signal-derived tech shows sine-wave node until signal is no longer faint.
- [x] Unknown techs show redaction bars; rumoured show name + flavour; progress show bars; discovered show full detail.
- [x] Progress bars do not exceed full width.
- [x] `requiresSimultaneous` marker appears on relevant techs.
- [x] Discovered tech shows correct unlock names from `cardDefs` / `facilityDefs`.
- [x] Modal closes on backdrop click and Escape key.
- [x] `Phaser.Game` instance is destroyed on modal close (no memory leak).
- [x] Multi-line tech names do not overlap separator lines or content below.
- [x] Drag-to-pan works; scroll wheel zooms in/out correctly.
- [x] Zoom +/− HTML buttons work; reset button returns to zoom 1 / scroll 0.
- [x] "DECRYPTING RESEARCH ARCHIVE" loading overlay appears and dismisses.
- [x] Legend colours match node border colours (rumour = blue, discovered = gold).

---

## Future-Proofing Notes

- **Dependency arrows**: when `requiredTechIds: string[]` is added to `TechDef`, the scene computes source/target node centres from the stored position map and draws bezier curves with `Graphics.strokePath()`. No structural change to the scene or component.
- **Era 2 / 3 nodes**: the tier computation and layout loop are data-driven; adding more `TechDef` entries automatically populates new nodes.
- **Node click for detail drawer**: add `setInteractive()` to each node rectangle and emit a scene event; the Svelte wrapper listens and renders a detail panel in HTML beside the canvas.

---

## Out of Scope (Deferred)

- Era 2 / Era 3 tech nodes
- Dependency arrows (requires `requiredTechIds` on `TechDef`)
- Clicking nodes for a detail drawer
- Research field assignment (passive by design)
