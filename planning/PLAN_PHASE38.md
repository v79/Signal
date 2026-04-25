# Phase 38 — Projects Review

A review and clean-up of `src/data/projects.json`. Introduces a new project type, splits rewards into one-off vs ongoing, and anchors Earth's only scientific project (CERN) to its host facility on the map.

## Goals

1. Add a third project type — **contract** — so that short-term commercial/political deals are clearly distinct from long-running scientific installations and from era-unlocking landmarks.
2. Split rewards into `oneOffReward` (applied at completion) and `ongoingReward` (applied every turn after completion, like a facility). Accept that this breaks existing saves.
3. Make scientific and landmark projects visible on the maps. CERN is the only Earth-based case and is handled as a ring around its host `publicUniversity`.
4. Surface project type at a glance in the Completed Projects panel via a glyph.

## Project types

| Type | Rewards | Map presence | Destructible |
|---|---|---|---|
| **contract** | One-off only. Typically Funding / Materials / Will; occasionally a one-off research or signal boost. | None. | N/A (already complete). |
| **scientific** | Primarily ongoing research per turn; optionally a one-off signal boost on completion. | Yes — rendered on the era's map. | No. Scientific projects are not affected by destruction events. |
| **landmark** | Primarily one-off; may include a small ongoing component where narrative fit supports it (e.g. Habitation Ring). Opens eras via `landmarkGate`. | Yes — rendered on the era's map. | No. |

The "scientific projects give rewards per turn" rule is the headline change. Rule for `signalProgress`: it is **always one-off** and the type system will enforce that it can only appear on `oneOffReward`.

## Reward schema

Replaces the existing single `reward` field. Example (CERN):

```json
{
  "oneOffReward":  { "resources": { "funding": 30 } },
  "ongoingReward": { "fields": { "physics": 3, "computing": 3 } }
}
```

Shapes:

- `oneOffReward?: { signalProgress?: number; resources?: Partial<Resources>; fields?: Partial<Fields> }`
- `ongoingReward?: { resources?: Partial<Resources>; fields?: Partial<Fields> }` — **no `signalProgress`**

Either may be omitted. Existing `upkeepCost` continues to apply each turn alongside `ongoingReward`.

**Save compatibility:** not preserved. This is a breaking change; old saves will fail to load. Acceptable at this stage of development.

## Map representation

### CERN (Earth)

- Anchored to the **first-built** `publicUniversity` facility. Engine selects at project-completion time and stores the host facility id on the project's completed-state record.
- Tie-break rule for "first built": `(constructedTurn asc, defId asc, tileCoord lexicographic asc)`. Deterministic for seeded runs.
- **Relocation:** if the host university is later destroyed and another `publicUniversity` exists, CERN's anchor relocates to the new earliest-built university using the same tie-break rule. If no university exists, the anchor becomes `null` and the ring hides; the ongoing reward continues (CERN itself is indestructible).
- **Rendering:** a concentric ring around the host university's existing map glyph. Exact look (halo vs. outline vs. secondary circle) pending a 10-minute check of how `publicUniversity` currently draws in `EarthScene`. Placeholder target: a thin outlined circle ~1.3× the facility glyph radius, styled to match the scientific-project colour we already use in the space arc.

### Near space projects (existing handling)

- `orbitalTelescopeArray`, `hubbleSpaceTelescope` — already on the Earth-orbit arc via `EARTH_ORBIT_PROJECTS` in `SpaceScene.ts`. No change beyond any label/icon tidy-up.
- `orbitalStation_stage1..3` — already drawn at the LEO node with increasing detail per stage count. No change.

### Asteroid era

Out of scope for this phase.

## Per-project changes

| id | Type | `oneOffReward` | `ongoingReward` | Notes |
|---|---|---|---|---|
| `governmentResearchContract` | contract | `funding: 50` | — | Type change only. |
| `computingResearchProgramme` | contract | `fields.computing: 100` | — | Reward rewritten as a single one-off computing boost. |
| `technologyExportAgreement` | contract | `funding: 90` | — | Type change only. |
| `orbitalTelescopeArray` | scientific | `signalProgress: 20` | `fields.physics: 2, fields.computing: 2` | |
| `hubbleSpaceTelescope` | scientific | `politicalWill: 20` | `fields.physics: 3, fields.biochemistry: 1` | |
| `cern` | scientific | `funding: 30` | `fields.physics: 3, fields.computing: 3` | Anchored to a `publicUniversity`; indestructible by events. |
| `orbitalStation_stage1` | landmark | `signalProgress: 5, politicalWill: 20` | — | No change. |
| `orbitalStation_stage2` | landmark | — | `fields.biochemistry: 1, fields.socialScience: 1` | Deviates from the "landmark = one-off" norm but fits the narrative: the ring is a working lab. |
| `orbitalStation_stage3` | landmark | `signalProgress: 10, politicalWill: 20` | — | `landmarkGate: "opensEra2"` retained. |
| `lunarProspectingMission` | contract | `materials: 50, fields.engineering: 30` | — | Type + reward change. |
| `longDurationOrbitalStudy` | — | — | — | **Deleted.** Replacement deferred. |
| `autonomousLunarSurveyGrid` | contract | `signalProgress: 15, materials: 40` | — | Type change only. |
| `outerSystemProbe` | scientific | `signalProgress: 30, fields.physics: 15` | — | No change this phase. Flag: this is the only "scientific" project without an ongoing reward; revisit after balance pass. |
| `moonColony_stage1` | landmark | `signalProgress: 5, politicalWill: 20` | — | No change. |
| `moonColony_stage2` | landmark | `signalProgress: 5` | — | No change. |
| `moonColony_stage3` | landmark | `signalProgress: 15, politicalWill: 40` | — | `landmarkGate: "opensEra3"` retained. |

## Completed Projects panel

Prefix each row with a glyph matching the project's type. Placeholder set (swap for real icons later):

- scientific → `!`
- landmark → `=`
- contract → `¤`

Also filter/group by type is a nice-to-have but out of scope.

## Implementation checklist

### Engine (`src/engine/`)

- ✅ `types.ts`: add `"contract"` to `ProjectType`. Replace `ProjectDef.reward` with optional `oneOffReward` and `ongoingReward`; type-lock `signalProgress` to the one-off shape.
- ✅ `types.ts`: added `projectHostFacilityIds: Record<string, string | null>` to `PlayerState` (generalised form of the planned `hostFacilityInstanceId`).
- ✅ Project-completion path: apply `oneOffReward`. For CERN, resolve and persist the host `publicUniversity` id using the tie-break rule.
- ✅ `turn.ts`: step 5b applies `ongoingReward` for every completed scientific/landmark project, after facility output, before signal decode.
- ✅ Event effects that destroy facilities: `reanchorCern` called in `destroyTileAndFacility`; scientific/landmark projects themselves are never removed.
- ✅ `save.ts`: bumped `SAVE_FORMAT_VERSION` to 2; old saves rejected.

### Data

- ✅ Rewrite `src/data/projects.json` per the table above.
- ✅ Delete `longDurationOrbitalStudy` entry.

### Rendering

- ✅ `EarthScene.ts`: double concentric ring drawn on the CERN-host tile; hides when anchor is `null`.
- ✅ `SpaceScene.ts`: `EARTH_ORBIT_PROJECTS` entries confirmed matching data (orbitalTelescopeArray, hubbleSpaceTelescope unchanged).

### UI

- ✅ `CompletedProjectsPanel.svelte`: type glyph (!/=/¤) added; ongoing reward shown as separate green `/t` chips.
- ✅ `OngoingActionsPanel.svelte`: reward summary notes "ongoing output" for scientific projects.

### Tests

- ✅ one-off reward applied exactly once on completion — covered by existing `tickActiveProjects` tests.
- [ ] ongoing reward ticks every world phase after completion — not yet explicitly tested.
- ✅ `signalProgress` rejected at type-level in `ongoingReward` — enforced by `tsc --noEmit`.
- [ ] CERN anchor resolution (earliest-built, relocate on destruction, null when none) — not yet tested.
- [ ] Destruction events cannot remove a scientific project — not yet tested.
- [ ] Save test: v1 envelope rejected with a clear error — not yet tested.

### Docs / memory

- [ ] Update `MEMORY.md` phase list once merged.
- [ ] No project changelog exists; save-format bump documented in this plan only.

## Out of scope / deferred

- Replacement for `longDurationOrbitalStudy` (lunar-orbit generational life-support study).
- Proper type icons — glyphs are placeholders.
- `outerSystemProbe` reward rework.
- Wider balance pass on ongoing research magnitudes vs. facility output.
- Asteroid-era project visual representation.
- Type/era filtering in the Completed Projects panel.
- CERN tile tooltip: the ring renders correctly but the tile hover tooltip has no awareness of anchored projects (only facilities). A player who didn't build CERN wouldn't know what the ring means. Fix when next touching tile tooltip infrastructure — add a "projects on this tile" section driven by `projectHostFacilityIds`.
