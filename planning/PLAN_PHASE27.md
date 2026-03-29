# Plan — Phase 27: Near Space Visual Enhancement

_Created: 2026-03-29_

---

## Context

The Near Space (`SpaceScene`) map is functional but visually underdeveloped. Three specific improvements are planned:

1. **Earth** — replace the plain dark-blue circle with a blue/green layered rendering with an atmosphere glow ring.
2. **Orbital Station** — draw the station graphically at the LEO node, growing in complexity as each of the three project stages completes.
3. **Orbital Telescope Array** — render a small constellation arc near the LEO node when the project is complete.

All rendering is done via Phaser's Graphics API (no external art assets). A new callback is required on `SpaceSceneCallbacks` to expose completed project IDs to the scene.

---

## Sub-phases

### Phase 27A — Callback extension

Add `getCompletedProjects: () => string[]` to the `SpaceSceneCallbacks` interface in `SpaceScene.ts`, and wire it in `MapContainer.svelte` (or wherever the scene callbacks are constructed) to return `state.player.completedProjectIds`.

**Files touched:**
- `src/phaser/SpaceScene.ts` — interface + usage
- Svelte component that constructs the callbacks (likely `MapContainer.svelte` or `+page.svelte`)

---

### Phase 27B — Earth visual

Replace the current flat `fillCircle(0x204060)` Earth with a layered rendering:

**Layers (bottom to top):**
1. **Ocean base** — filled circle, deep blue (`#1a4a7a`)
2. **Continent blobs** — 4–5 irregular filled arcs/polygons in muted green (`#2d6e3a`), positioned to loosely suggest Africa/Europe, the Americas, Asia, and Antarctica. Use fixed coordinates (no RNG) so the Earth looks the same every run.
3. **Polar caps** — small white-ish filled circles at top and bottom of the Earth circle (`#c8dde8`, low opacity)
4. **Atmosphere ring** — `strokeCircle` slightly larger than Earth radius, pale blue-white (`#aad4f0`), low opacity (~0.3), 3px wide

The Earth label (`EARTH`) remains centred on the circle.

**Files touched:**
- `src/phaser/SpaceScene.ts` — `create()` method, Earth drawing block

---

### Phase 27C — Orbital Station visual

The LEO node currently draws as a plain circle. When one or more orbital station stages are complete, the node should be rendered as a growing station structure instead of (or on top of) the plain circle.

**Stage states:**

| Completed projects | Visual |
|---|---|
| None | Current plain circle (dim, `lowEarthOrbit` colour) |
| `orbitalStation_stage1` (Core) | Central cylindrical module — a small filled rectangle or rounded rect, plus a short vertical line (docking collar). The node circle becomes a faint selection ring only. |
| `orbitalStation_stage2` (Habitation Ring) | Core module + a ring drawn around it (ellipse/arc to suggest a torus, since it's 2D). |
| `orbitalStation_stage3` (Operational) | Full station: core + ring + horizontal solar panel wings (two thin rectangles extending left and right), plus a subtle glow. |

The station graphic is drawn centred on `NODE_POSITIONS['leo']`. The click hit zone remains the same (invisible circle). A selection ring (the current `strokeCircle` with `0x88c8ff`) still renders when selected.

**Files touched:**
- `src/phaser/SpaceScene.ts` — `renderScene()` method; extract a `drawOrbitalStation(cx, cy, r, stage)` helper

---

### Phase 27D — Orbital Telescope Array visual

When `orbitalTelescopeArray` is in `completedProjectIds`, draw a small constellation of 3–4 instrument dots in an arc above and to the right of the LEO node, connected by faint dashed lines.

**Rendering:**
- 4 small diamond shapes (or filled circles, radius ~3px) positioned in a gentle arc, offset from the LEO node position (e.g. arc from roughly `{x: 260, y: 180}` to `{x: 340, y: 175}` in logical coords)
- Connected by faint dotted/dashed lines between them (`lineStyle` with short segments manually drawn, or very low alpha solid line)
- Colour: pale teal (`#60b0a8`), low opacity (~0.7) — distinct from station white and node colours
- A small label `TELESCOPE ARRAY` in the same style as node labels, above the arc

The telescope array graphic is drawn in `renderScene()` after nodes, so it sits above the connection lines but below node labels.

**Files touched:**
- `src/phaser/SpaceScene.ts` — `renderScene()` method; extract a `drawTelescopeArray(completedProjects)` helper

---

## Implementation order

```
27A (callback extension — needed by 27C and 27D)
  → 27B (Earth visual — standalone, no dependencies)
  → 27C (Orbital Station — depends on 27A)
  → 27D (Telescope Array — depends on 27A)
```

27B can be done in parallel with 27A since it has no dependency on the new callback.

---

## Open questions

1. Should the `orbitalStation_stage*` completed project check also consider the _in-progress_ state (i.e. show stage 1 graphic while stage 2 is being built)? Or only render each stage once fully completed?

   _Show each stage graphic as soon as that stage is complete — so the core module is visible while stage 2 is still building._

2. For the Habitation Ring torus in stage 2 — should it be a full ellipse, or a partial arc (suggesting the ring hasn't fully closed yet as a design choice)?

   _Full ellipse — cleaner and unambiguous._

3. Should the telescope array arc position shift slightly if the LEO node is selected, to avoid overlap with the selection ring glow?

   _Yes — simplest fix possible (small static offset is fine)._
