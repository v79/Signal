# Plan — Phase 27: Near Space Visual Enhancement

_Created: 2026-03-29_

---

## Context

The Near Space (`SpaceScene`) map is functional but visually underdeveloped. Four improvements are planned:

1. **Earth** — replace the plain dark-blue circle with a blue/green layered rendering with an atmosphere glow ring.
2. **Orbital Station** — draw the station graphically at the LEO node, growing in complexity as each of the three project stages completes.
3. **Earth orbit arc** — a faint elliptical ring around Earth, auto-populated with icons for completed orbital projects (Telescope Array, Hubble, future). Max 5–6 slots. Replaces the old standalone telescope array placement.
4. **Moon orbit arc** — a smaller faint ring around Lunar Surface. Always visible as an affordance; auto-populated from future lunar orbit projects. Max 3 slots.
5. **Remove Lunar Orbit node** — Lunar Orbit is not a meaningful interactive node. Remove it from the transit graph and data. Transit becomes `LEO → Lunar Surface` directly.

**Design rules:**
- LEO remains a full interactive node. The Orbital Station is its visual identity once built; further facilities are built there in Era 2.
- Orbit arcs are purely visual — populated automatically from `completedProjectIds`. Players do not click slots to build.
- Breaking save game state is acceptable for this phase.

All rendering is via Phaser's Graphics API (no external art assets).

---

## Sub-phases

### ✅ Phase 27A — Callback extension

Add `getCompletedProjects: () => string[]` to the `SpaceSceneCallbacks` interface in `SpaceScene.ts`, and wire it in `MapContainer.svelte` to return `state.player.completedProjectIds`.

**Files touched:**
- `src/phaser/SpaceScene.ts`
- `src/lib/components/MapContainer.svelte`

---

### ✅ Phase 27B — Earth visual

Replace the flat `fillCircle(0x204060)` Earth with a layered rendering:

1. **Ocean base** — deep blue (`#1a4a7a`)
2. **Continent blobs** — 5 muted green (`#2d6e3a`) ellipses at fixed positions (Africa/Europe, Americas, Asia, Antarctica, Australia)
3. **Polar caps** — pale ellipses top and bottom
4. **Atmosphere ring** — `strokeCircle` slightly outside radius, pale blue-white, low opacity

**Files touched:** `src/phaser/SpaceScene.ts`

---

### ✅ Phase 27C — Orbital Station visual

LEO node renders a growing station graphic based on completed stages:

| Completed | Visual |
|---|---|
| None | Plain dim circle |
| `orbitalStation_stage1` | Core module (filled rect) + docking collar line |
| `orbitalStation_stage2` | + full ellipse habitation ring |
| `orbitalStation_stage3` | + solar panel wings with grid lines + glow |

**Files touched:** `src/phaser/SpaceScene.ts`

---

### ✅ Phase 27D — Remove Lunar Orbit node + orbit arcs

**Data cleanup:**
- Remove `'lunarOrbit'` from `SpaceNodeType` union in `src/engine/types.ts`
- Remove `lunarOrbit` entry from `generateSpaceNodes()` in `src/lib/stores/game.svelte.ts`
- Update transit connections in `SpaceScene.ts`: remove `['leo','lunarOrbit']` and `['lunarOrbit','lunarSurface']`; add `['leo','lunarSurface']`
- Remove `lunarOrbit` from `NODE_POSITIONS` and `NODE_COLOURS` in `SpaceScene.ts`

**Earth orbit arc:**
- Full `strokeEllipse` around Earth; Earth body (drawn in `create()`) sits on top and masks lower half
- Per-project angle assignment: `orbitalTelescopeArray` at 230°, `hubbleSpaceTelescope` at 310° — symmetric spread
- Icons: telescope = 3 teal diamonds with dashes; Hubble = larger diamond with crosshair
- Labels placed radially outside the arc

**Moon orbit arc:**
- Subtle `strokeEllipse` around Lunar Surface node, always visible
- No projects mapped yet — arc draws empty

**Files touched:**
- `src/engine/types.ts`
- `src/lib/stores/game.svelte.ts`
- `src/phaser/SpaceScene.ts`

---

### ✅ Phase 27E — Near Space assets overview panel

`SpaceOverview.svelte` mirrors `FacilityOverview` with three sections:
- **FACILITIES ON NODES** — any facility built at LEO/L1/L2/Lunar Surface
- **EARTH ORBIT** — completed orbital arc projects (Telescope Array, Hubble)
- **LUNAR ORBIT** — placeholder for future lunar orbit projects

`≡ ASSETS` toolbar button added to Near Space tab in `MapContainer.svelte`.

**Files touched:**
- `src/lib/components/SpaceOverview.svelte` (new)
- `src/lib/components/MapContainer.svelte`

---

## Implementation order

```
27A ✅ → 27B ✅ → 27C ✅ → 27D ✅ → 27E ✅
```

---

## Open questions

1. Should the `orbitalStation_stage*` completed project check also consider the _in-progress_ state (i.e. show stage 1 graphic while stage 2 is being built)? Or only render each stage once fully completed?

   _Show each stage graphic as soon as that stage is complete — so the core module is visible while stage 2 is still building._

2. For the Habitation Ring torus in stage 2 — should it be a full ellipse, or a partial arc (suggesting the ring hasn't fully closed yet as a design choice)?

   _Full ellipse — cleaner and unambiguous._

3. Should the telescope array arc position shift slightly if the LEO node is selected, to avoid overlap with the selection ring glow?

   _Yes — simplest fix possible (small static offset is fine). Now moot — telescope array moves to Earth orbit arc._

4. Should the moon orbit arc be visible before any lunar orbit projects exist?

   _Yes — show the empty ring as an affordance from the start._
