# Phase 36 — Projects Tab & Signal Economy

## Goals

Add a PROJECTS tab showing completed projects, extend Era 2 project content, and address signal economy issues that cause progress to stall too long near the era caps.

## Completed Work

- ✅ **PROJECTS tab** — new map-area tab listing completed projects with year, reward chips, and grouped landmark stages
- ✅ **Completed project tracking** — `completedProjectIds` migrated to a `Map<id, year>` format to record completion year; world phase populates it
- ✅ **Completed project panel optimisation** — `CompletedProjectsPanel.svelte` refactored; map tab logic updated
- ✅ **Panel heading standardisation** — consistent heading style across BLOCS, COMMITTEE, and PROJECTS tabs
- ✅ **Atmospheric Monitoring Station** — reduces climate pressure by 0.1/turn when built
- ✅ **Era 2 single-stage projects** — four new nearSpace projects spanning tiers 1–4 added to `projects.json`
- ✅ **Card draw deduplication** — `drawCards` now prevents two cards with the same `defId` entering hand simultaneously; existing hand defIds also excluded from draw candidates
- ✅ **Project reward bug fixes** — `orbitalStation_stage1` politicalWill moved under `resources`; `orbitalStation_stage3` signal boost replaced with +30 Political Will
- ✅ **Deep Space Relay Network cost reduction** — research recipe cut by ~33% (180 → 120 total field-points) so the signal stall near 33%/66% resolves sooner
- ✅ **`paradigmRevision` event** — rare (weight 0.15) `noCounter` event that reduces signal progress by 10, bypassing era stall caps; wires up the previously-deferred `signalProgress` field in `applyEventEffect`
