# CSS Audit — Signal

_Generated 2026-04-18 from 26 Svelte files._

This document provides the full distribution of CSS property values across the codebase.
It is the evidence base for designing the token set in Phase 37 Part B.

---

## Table of Contents

1. [Colour — `color`](#1-colour--color)
2. [Colour — `background` / `background-color`](#2-colour--background--background-color)
3. [Colour — `border` colours](#3-colour--border-colours)
4. [Border widths](#4-border-widths)
5. [Border full shorthands](#5-border-full-shorthands)
6. [Font sizes](#6-font-sizes)
7. [Padding](#7-padding)
8. [Gap](#8-gap)
9. [Margin](#9-margin)
10. [Border radius](#10-border-radius)
11. [Font weight](#11-font-weight)
12. [Shared class name candidates](#12-shared-class-name-candidates)

---

## 1. Colour — `color`

| Value | Count | Files |
|---|---|---|
| `#8aacca` | 15 | +page, +page, +page, BlocStatusPanel, HUD, MapContainer, NarrativeModal, NewsTicker |
| `#c8a040` | 14 | CardHand, EventZone, FacilityPicker, HUD, NewsTicker, PhaseControls, ScienceNewsFeed, SpaceNodePicker |
| `#4a9b7a` | 13 | CardHand, EventZone, FacilityPicker, SpaceNodePicker, TileTooltip |
| `#c8d0d8` | 13 | +layout, CardHand, EventZone, FacilityPicker, HUD, SpaceNodePicker |
| `#3a5060` | 12 | FacilityOverview, FacilityPicker, OngoingActionsPanel, ScienceNewsFeed, SpaceNodePicker, TechProgressSummary, TileTooltip |
| `#4a6080` | 10 | BlocStatusPanel, BoardPanel, CompletedProjectsPanel, EventZone, MapContainer |
| `#8aaabb` | 10 | FacilityOverview, MapContainer, NewsTicker, OngoingActionsPanel, SpaceOverview |
| `#3a4858` | 8 | CardHand, FacilityPicker, PhaseControls, SpaceNodePicker |
| `#a0c8e8` | 8 | +page, +page, BlocStatusPanel, CompletedProjectsPanel, MapContainer |
| `#4a5868` | 7 | FacilityPicker, SpaceNodePicker |
| `#4a6070` | 7 | FacilityOverview, NarrativeModal, NewsTicker, SpaceOverview |
| `#5a6878` | 7 | EventZone, FacilityPicker, HUD, SignalTrack |
| `#2a3848` | 6 | CardHand, FacilityPicker, SpaceNodePicker |
| `#3a5070` | 6 | +page, +page, CompletedProjectsPanel |
| `#3a6888` | 5 | SpaceNodePicker, SpaceOverview, TechTreeModal |
| `#4a90c0` | 5 | +page, BlocStatusPanel, MapContainer, SpaceNodePicker |
| `#4a9bd8` | 5 | CompletedProjectsPanel, EventZone, OngoingActionsPanel |
| `#5a4a2a` | 5 | FacilityPicker, SpaceNodePicker |
| `#9b4a4a` | 5 | FacilityPicker, SpaceNodePicker |
| `#2a5070` | 4 | CompletedProjectsPanel, NewsTicker, PhaseControls |
| `#3a5868` | 4 | FacilityOverview, TechTreeModal |
| `#4a7a9a` | 4 | FacilityOverview, MapContainer, SpaceOverview |
| `#4a8ab4` | 4 | HUD, PhaseControls |
| `#4ab870` | 4 | CompletedProjectsPanel, OngoingActionsPanel |
| `#6a8aaa` | 4 | +page, HUD, ScienceNewsFeed |
| `#c8d050` | 4 | FacilityPicker, HUD, SpaceNodePicker |
| `#2e4a5a` | 3 | BoardPanel |
| `#3a4050` | 3 | EventZone, NewsTicker, OngoingActionsPanel |
| `#3a5a7a` | 3 | +page, SpaceNodePicker |
| `#4a5a6a` | 3 | FacilityPicker, SpaceNodePicker |
| `#5ad486` | 3 | BoardPanel, PhaseControls |
| `#6a7888` | 3 | HUD, MapContainer |
| `#6ab0d8` | 3 | NewsTicker, ResearchFeed, ScienceNewsFeed |
| `#7ab4d8` | 3 | BoardPanel |
| `#94a3b8` | 3 | BoardPanel |
| `#c04040` | 3 | FacilityPicker, HUD, OngoingActionsPanel |
| `#c84a4a` | 3 | EventZone, PhaseControls |
| `#c8ddf0` | 3 | +page, +page, HUD |
| `#d46a4a` | 3 | HUD, ResearchFeed |
| `#1e3040` | 2 | TechTreeModal |
| `#2a3a48` | 2 | BoardPanel, ScienceNewsFeed |
| `#2a3a50` | 2 | BlocStatusPanel |
| `#2a4a60` | 2 | ScienceNewsFeed, SpaceOverview |
| `#2a4a6a` | 2 | CompletedProjectsPanel, MapContainer |
| `#2a6090` | 2 | NarrativeModal |
| `#2e5060` | 2 | TechTreeModal |
| `#304858` | 2 | TechTreeModal |
| `#3a4a5a` | 2 | HUD, TechProgressSummary |
| `#3a5a6a` | 2 | BoardPanel, TechTreeModal |
| `#4a6878` | 2 | NewsTicker, TechTreeModal |
| `#4a6a8a` | 2 | +page, EventZone |
| `#4a7080` | 2 | TechTreeModal |
| `#4a7888` | 2 | +page, TechTreeModal |
| `#4a9090` | 2 | SpaceNodePicker, SpaceOverview |
| `#4ad480` | 2 | ResearchFeed |
| `#5a6a7a` | 2 | FacilityPicker, SpaceNodePicker |
| `#6a4040` | 2 | HUD, PhaseControls |
| `#6a5820` | 2 | NewsTicker |
| `#6aaabb` | 2 | TechTreeModal |
| `#6aacca` | 2 | +page, +page |
| `#70d0d0` | 2 | SpaceNodePicker, SpaceOverview |
| `#8a6810` | 2 | TechTreeModal |
| `#8ab8d8` | 2 | ResearchFeed, SpaceNodePicker |
| `#90b8c8` | 2 | TechTreeModal |
| `#9b6a4a` | 2 | FacilityPicker, TileTooltip |
| `#c85050` | 2 | +page |
| `#c89040` | 2 | +page |
| `#c8dce8` | 2 | NarrativeModal |
| `#d08080` | 2 | HUD |
| `#f59e0b` | 2 | BoardPanel |
| `#000` | 1 | BoardPanel |
| `#1a2e3a` | 1 | TechTreeModal |
| `#1a4060` | 1 | ScienceNewsFeed |
| `#1e3c50` | 1 | TechTreeModal |
| `#2a3040` | 1 | HUD |
| `#2a3840` | 1 | ScienceNewsFeed |
| `#2a3e50` | 1 | SpaceOverview |
| `#2a4050` | 1 | TechProgressSummary |
| `#2a6040` | 1 | NewsTicker |
| `#2e4458` | 1 | BoardPanel |
| `#2e5068` | 1 | TechTreeModal |
| `#2e5870` | 1 | TechTreeModal |
| `#3a5030` | 1 | +page |
| `#3a5870` | 1 | SpaceOverview |
| `#3a5878` | 1 | FacilityPicker |
| `#3a6040` | 1 | TechTreeModal |
| `#3a6070` | 1 | SpaceOverview |
| `#3a7050 !important` | 1 | OngoingActionsPanel |
| `#475569` | 1 | BoardPanel |
| `#4a3030` | 1 | BlocStatusPanel |
| `#4a6880` | 1 | TileTooltip |
| `#4a6888` | 1 | HUD |
| `#4a6a30 !important` | 1 | +page |
| `#4a6a4a` | 1 | +page |
| `#4a6a7a` | 1 | TechTreeModal |
| `#4a7060` | 1 | OngoingActionsPanel |
| `#4a7090` | 1 | +page |
| `#4a7aaa` | 1 | EventZone |
| `#4a8070` | 1 | OngoingActionsPanel |
| `#4a8090` | 1 | TechTreeModal |
| `#4a8858` | 1 | TechTreeModal |
| `#4a9060` | 1 | NarrativeModal |
| `#4ade80` | 1 | BoardPanel |
| `#503870` | 1 | NewsTicker |
| `#507060` | 1 | TechTreeModal |
| `#50a870` | 1 | +page |
| `#50c880` | 1 | +page |
| `#587888` | 1 | TechTreeModal |
| `#5a4040` | 1 | FacilityPicker |
| `#5a4818` | 1 | ScienceNewsFeed |
| `#5a7080` | 1 | ResearchFeed |
| `#5a7890` | 1 | NewsTicker |
| `#5a8aaa` | 1 | BlocStatusPanel |
| `#5a9878` | 1 | TileTooltip |
| `#5a9a60` | 1 | TechTreeModal |
| `#5ab880` | 1 | NewsTicker |
| `#607080` | 1 | OngoingActionsPanel |
| `#6070a8` | 1 | NarrativeModal |
| `#60b0e8` | 1 | SpaceOverview |
| `#6a5020` | 1 | CardHand |
| `#6a5880` | 1 | TechTreeModal |
| `#6a8898` | 1 | TileTooltip |
| `#6a8aa8` | 1 | BlocStatusPanel |
| `#6a9a60` | 1 | +page |
| `#6aaad8` | 1 | FacilityPicker |
| `#6aacca !important` | 1 | +page |
| `#702828` | 1 | PhaseControls |
| `#7a6020` | 1 | PhaseControls |
| `#7a6838` | 1 | TechTreeModal |
| `#7a7acd` | 1 | FacilityPicker |
| `#7a8a98` | 1 | NewsTicker |
| `#7a8e9e` | 1 | EventZone |
| `#7a9ab8` | 1 | NewsTicker |
| `#7a9eb8` | 1 | NewsTicker |
| `#7ab880` | 1 | TechTreeModal |
| `#8a3a3a` | 1 | NewsTicker |
| `#8a6040` | 1 | NarrativeModal |
| `#8a6878` | 1 | CardHand |
| `#8a6a20` | 1 | CardHand |
| `#8a7050` | 1 | +page |
| `#8a8a4a` | 1 | OngoingActionsPanel |
| `#8a8a9a` | 1 | EventZone |
| `#8a9aaa` | 1 | EventZone |
| `#8ab870` | 1 | +page |
| `#8ab8c8` | 1 | TechProgressSummary |
| `#8b5e3c` | 1 | HUD |
| `#9060d0` | 1 | CompletedProjectsPanel |
| `#90c8d8` | 1 | TechTreeModal |
| `#90f0aa` | 1 | PhaseControls |
| `#986050` | 1 | TileTooltip |
| `#987840` | 1 | TileTooltip |
| `#98a850` | 1 | TileTooltip |
| `#a07ad8` | 1 | NewsTicker |
| `#a0c0d8` | 1 | +page |
| `#a8c4d8` | 1 | NarrativeModal |
| `#a8c8e8` | 1 | TileTooltip |
| `#aa6040` | 1 | BlocStatusPanel |
| `#aacce8` | 1 | NewsTicker |
| `#b060a0` | 1 | CompletedProjectsPanel |
| `#b07ad0` | 1 | HUD |
| `#c07040` | 1 | SpaceNodePicker |
| `#c07050` | 1 | +page |
| `#c07070` | 1 | PhaseControls |
| `#c09040` | 1 | CompletedProjectsPanel |
| `#c87050` | 1 | HUD |
| `#c88030` | 1 | EventZone |
| `#c8d8f0` | 1 | Tooltip |
| `#c8dce8 !important` | 1 | NarrativeModal |
| `#d47070` | 1 | NewsTicker |
| `#d4a840` | 1 | ResearchFeed |
| `#e05555` | 1 | MapContainer |
| `#e8a820` | 1 | TechTreeModal |
| `#ef4444` | 1 | BoardPanel |
| `#fff` | 1 | BoardPanel |
| `#fff !important` | 1 | NarrativeModal |
| `rgba(255, 255, 255, 0.2)` | 1 | NarrativeModal |


---

## 2. Colour — `background` / `background-color`

| Value | Count | Files |
|---|---|---|
| `transparent` | 17 | +page, +page, CardHand, EventZone, FacilityOverview, FacilityPicker, HUD, MapContainer, PhaseControls, SpaceNodePicker, SpaceOverview |
| `none` | 12 | BoardPanel, HUD, MapContainer, NarrativeModal, NewsTicker, TechTreeModal |
| `#0a1018` | 11 | FacilityPicker, HUD, MapContainer, NewsTicker, SpaceNodePicker, TechProgressSummary, TileTooltip |
| `#0d1520` | 8 | +page, +page, CompletedProjectsPanel, FacilityPicker, SpaceNodePicker |
| `#060a10` | 7 | +page, +page, BlocStatusPanel, MapContainer, NewsTicker, ScienceNewsFeed, TechProgressSummary |
| `#0a2018` | 6 | CardHand, EventZone, FacilityPicker, SpaceNodePicker |
| `#0a0e14` | 5 | BlocStatusPanel, FacilityOverview, MapContainer, SpaceOverview |
| `#0a1420` | 4 | BlocStatusPanel, BoardPanel, SpaceNodePicker, SpaceOverview |
| `#0a2818` | 4 | OngoingActionsPanel, ResearchFeed |
| `#080c12` | 3 | NarrativeModal |
| `#080f18` | 3 | EventZone, OngoingActionsPanel |
| `#0a0f18` | 3 | +page, +page, CompletedProjectsPanel |
| `#0a2e1a` | 3 | BoardPanel, PhaseControls |
| `#0c1018` | 3 | EventZone, NarrativeModal, SignalTrack |
| `#0f4024` | 3 | BoardPanel, PhaseControls |
| `#1a2030` | 3 | HUD, SignalTrack |
| `#1a2535` | 3 | +page, HUD |
| `#1e2530` | 3 | BlocStatusPanel, CardHand, NarrativeModal |
| `#4a90c0` | 3 | +page, MapContainer, SpaceOverview |
| `#040810` | 2 | TechTreeModal |
| `#050a10` | 2 | TechTreeModal |
| `#06090f` | 2 | BoardPanel, TechTreeModal |
| `#060c18` | 2 | ResearchFeed, ScienceNewsFeed |
| `#081828` | 2 | EventZone, OngoingActionsPanel |
| `#0a1828` | 2 | ResearchFeed, SpaceOverview |
| `#0a1a0f` | 2 | CompletedProjectsPanel, EventZone |
| `#0d1820` | 2 | +page, SpaceOverview |
| `#0d1825` | 2 | FacilityPicker, SpaceNodePicker |
| `#0d1a2e` | 2 | +page |
| `#0f1a28` | 2 | +page |
| `#101825` | 2 | FacilityPicker, SpaceNodePicker |
| `#141820` | 2 | BlocStatusPanel |
| `#1a0a0a` | 2 | EventZone, PhaseControls |
| `#1a2530` | 2 | MapContainer, SpaceOverview |
| `#1a2a3a` | 2 | BlocStatusPanel, BoardPanel |
| `#1e0e08` | 2 | ResearchFeed |
| `#2a1a05` | 2 | CardHand, EventZone |
| `#2a6090` | 2 | NarrativeModal, OngoingActionsPanel |
| `rgba(0, 0, 0, 0.45)` | 2 | FacilityPicker, SpaceNodePicker |
| `rgba(212, 168, 32, 0.06)` | 2 | TechTreeModal |
| `#06101a` | 1 | BoardPanel |
| `#070b12` | 1 | PhaseControls |
| `#080c10` | 1 | OngoingActionsPanel |
| `#080c14` | 1 | NewsTicker |
| `#080e18` | 1 | NewsTicker |
| `#080f1a` | 1 | BoardPanel |
| `#090d14` | 1 | CardHand |
| `#0a0a0f` | 1 | +layout |
| `#0a1218` | 1 | +page |
| `#0a1810` | 1 | NewsTicker |
| `#0a1820` | 1 | OngoingActionsPanel |
| `#0a1822` | 1 | CompletedProjectsPanel |
| `#0a1a10` | 1 | OngoingActionsPanel |
| `#0a1a2a` | 1 | CompletedProjectsPanel |
| `#0a2840` | 1 | OngoingActionsPanel |
| `#0d1018` | 1 | HUD |
| `#0d1510` | 1 | +page |
| `#0d1a0d` | 1 | +page |
| `#0d1a28` | 1 | CardHand |
| `#0d1e30` | 1 | PhaseControls |
| `#0e1820` | 1 | TechTreeModal |
| `#0f1e28` | 1 | OngoingActionsPanel |
| `#0f2030` | 1 | OngoingActionsPanel |
| `#0f2038` | 1 | ResearchFeed |
| `#0f3820` | 1 | OngoingActionsPanel |
| `#101018` | 1 | EventZone |
| `#111008` | 1 | CardHand |
| `#121e2e` | 1 | HUD |
| `#131e28` | 1 | TechProgressSummary |
| `#180a0a` | 1 | NewsTicker |
| `#180a2a` | 1 | CompletedProjectsPanel |
| `#181008` | 1 | CardHand |
| `#181808` | 1 | OngoingActionsPanel |
| `#1a0808` | 1 | BoardPanel |
| `#1a0a18` | 1 | CompletedProjectsPanel |
| `#1a0e0e` | 1 | HUD |
| `#1a1018` | 1 | CardHand |
| `#1a1208` | 1 | CompletedProjectsPanel |
| `#1a1400` | 1 | CardHand |
| `#1a2236` | 1 | Tooltip |
| `#1a3a5a` | 1 | BlocStatusPanel |
| `#1e1408` | 1 | ResearchFeed |
| `#1e2a3a` | 1 | BoardPanel |
| `#200808` | 1 | FacilityPicker |
| `#280a0a` | 1 | OngoingActionsPanel |
| `#2a1a10` | 1 | BlocStatusPanel |
| `#2a3a4a` | 1 | NarrativeModal |
| `#2a7050` | 1 | OngoingActionsPanel |
| `#3b82f6` | 1 | BoardPanel |
| `#4ab8d8` | 1 | +page |
| `#60a860` | 1 | +page |
| `#802020` | 1 | OngoingActionsPanel |
| `#8a5a2a` | 1 | SignalTrack |
| `#9060c0` | 1 | +page |
| `#f59e0b` | 1 | BoardPanel |
| `rgba(0, 0, 0, 0.75)` | 1 | NarrativeModal |
| `rgba(10, 24, 40, 0.95)` | 1 | TechTreeModal |
| `rgba(2, 6, 12, 0.88)` | 1 | TechTreeModal |
| `rgba(20, 30, 10, 0.3)` | 1 | +page |
| `rgba(232, 168, 32, 0.08)` | 1 | TechTreeModal |
| `rgba(30, 70, 120, 0.2)` | 1 | +page |
| `rgba(30, 70, 120, 0.3)` | 1 | +page |
| `rgba(30, 80, 50, 0.4)` | 1 | +page |
| `rgba(30, 80, 50, 0.5)` | 1 | +page |
| `rgba(30, 90, 150, 0.35)` | 1 | +page |
| `rgba(4, 8, 16, 0.88)` | 1 | TechTreeModal |
| `rgba(42, 72, 88, 0.12)` | 1 | TechTreeModal |
| `rgba(42, 72, 88, 0.15)` | 1 | TechTreeModal |
| `rgba(42, 88, 112, 0.18)` | 1 | TechTreeModal |
| `rgba(42, 88, 52, 0.18)` | 1 | TechTreeModal |
| `rgba(42, 96, 144, 0.1)` | 1 | NarrativeModal |
| `rgba(42, 96, 144, 0.15)` | 1 | NarrativeModal |
| `rgba(42, 96, 144, 0.2) !important` | 1 | NarrativeModal |
| `rgba(42, 96, 144, 0.3) !important` | 1 | NarrativeModal |
| `rgba(80, 20, 20, 0.5)` | 1 | +page |
| `rgba(80, 30, 20, 0.4)` | 1 | +page |
| `rgba(80, 50, 10, 0.4)` | 1 | +page |


---

## 3. Colour — `border` colours

| Value | Count | Files |
|---|---|---|
| `#1e2530` | 31 | +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, EventZone, FacilityOverview, HUD, MapContainer, NarrativeModal, OngoingActionsPanel, PhaseControls, ScienceNewsFeed, SignalTrack, SpaceOverview, TechProgressSummary |
| `#1a2535` | 12 | +page, +page, CompletedProjectsPanel, FacilityPicker, HUD, SpaceNodePicker |
| `#0e1c28` | 8 | TechTreeModal |
| `#1a2530` | 6 | BoardPanel, NewsTicker, TechProgressSummary |
| `#1a2a3a` | 6 | SpaceNodePicker, TileTooltip |
| `#2a3a50` | 6 | +page, BlocStatusPanel, HUD, MapContainer |
| `#2a5080` | 6 | EventZone, OngoingActionsPanel, ResearchFeed |
| `#1a4030` | 5 | FacilityPicker, OngoingActionsPanel, SpaceNodePicker |
| `#1a5030` | 5 | BoardPanel, OngoingActionsPanel, PhaseControls |
| `#2a4a6a` | 5 | +page, +page, BlocStatusPanel, HUD |
| `#2a6090` | 5 | NarrativeModal, SpaceOverview |
| `#1a2538` | 4 | FacilityPicker |
| `#2a4060` | 4 | CardHand, EventZone, FacilityPicker, HUD |
| `#2a6050` | 4 | CardHand, EventZone, FacilityPicker, SpaceNodePicker |
| `#101820` | 3 | FacilityPicker, SpaceNodePicker |
| `#111820` | 3 | FacilityOverview, SpaceOverview |
| `#162230` | 3 | TechTreeModal |
| `#1a2030` | 3 | OngoingActionsPanel, ResearchFeed |
| `#1a3040` | 3 | TechTreeModal |
| `#1a3050` | 3 | OngoingActionsPanel, PhaseControls, ResearchFeed |
| `#1e2a3a` | 3 | +page, +page, FacilityPicker |
| `#1e2d40` | 3 | FacilityOverview, NewsTicker, SpaceOverview |
| `#2a5870` | 3 | SpaceNodePicker, SpaceOverview, TechTreeModal |
| `#4a80b0` | 3 | +page, +page |
| `#4a90c0` | 3 | +page, NarrativeModal |
| `#7a5a1a` | 3 | CardHand, EventZone |
| `#0e1820` | 2 | BoardPanel |
| `#141820` | 2 | BlocStatusPanel |
| `#141c26` | 2 | ScienceNewsFeed, TechProgressSummary |
| `#2a3545` | 2 | EventZone |
| `#2a4858` | 2 | TechTreeModal |
| `#2a5060` | 2 | TechTreeModal |
| `#2a6040` | 2 | +page, +page |
| `#3a2c08` | 2 | TechTreeModal |
| `#3a6080` | 2 | +page |
| `#4a6070` | 2 | NarrativeModal |
| `#4a8080` | 2 | SpaceNodePicker, SpaceOverview |
| `#4a90c0 !important` | 2 | NarrativeModal |
| `#78350f` | 2 | BoardPanel |
| `transparent` | 2 | HUD, MapContainer |
| `#0c1820` | 1 | TechTreeModal |
| `#0e1a22` | 1 | BoardPanel |
| `#166534` | 1 | BoardPanel |
| `#1a2830` | 1 | OngoingActionsPanel |
| `#1a3020` | 1 | TechTreeModal |
| `#1a3840` | 1 | TechTreeModal |
| `#1a3a50` | 1 | CompletedProjectsPanel |
| `#1a4060` | 1 | CompletedProjectsPanel |
| `#1a4870` | 1 | OngoingActionsPanel |
| `#1a4a20` | 1 | CompletedProjectsPanel |
| `#1a6030` | 1 | OngoingActionsPanel |
| `#1e2a38` | 1 | SpaceNodePicker |
| `#1e2f42` | 1 | CompletedProjectsPanel |
| `#1e3028` | 1 | TechTreeModal |
| `#1e3048` | 1 | SpaceOverview |
| `#1e3050` | 1 | TileTooltip |
| `#1e3a5a` | 1 | SpaceNodePicker |
| `#1e4060` | 1 | SpaceNodePicker |
| `#2a3040` | 1 | HUD |
| `#2a3a20` | 1 | +page |
| `#2a3a4a` | 1 | NarrativeModal |
| `#2a3a56` | 1 | Tooltip |
| `#2a3e18` | 1 | TechTreeModal |
| `#2a5030` | 1 | TechTreeModal |
| `#2a5040` | 1 | NarrativeModal |
| `#2a7040` | 1 | PhaseControls |
| `#2a7050` | 1 | OngoingActionsPanel |
| `#2e2440` | 1 | TechTreeModal |
| `#3a1a60` | 1 | CompletedProjectsPanel |
| `#3a2020` | 1 | PhaseControls |
| `#3a2a08` | 1 | CardHand |
| `#3a2e08` | 1 | TechTreeModal |
| `#3a3018` | 1 | TechTreeModal |
| `#3a3a5a` | 1 | EventZone |
| `#3a5a30` | 1 | +page |
| `#3a5a7a` | 1 | BlocStatusPanel |
| `#3a7040` | 1 | TechTreeModal |
| `#404870` | 1 | NarrativeModal |
| `#475569` | 1 | BoardPanel |
| `#4a1a1a` | 1 | FacilityPicker |
| `#4a1a40` | 1 | CompletedProjectsPanel |
| `#4a2a10` | 1 | FacilityPicker |
| `#4a3010` | 1 | CompletedProjectsPanel |
| `#4a3848` | 1 | CardHand |
| `#4a3a10` | 1 | CardHand |
| `#4a6080` | 1 | +page |
| `#4a8ab4` | 1 | HUD |
| `#504010` | 1 | OngoingActionsPanel |
| `#5a3a10` | 1 | +page |
| `#5a4030` | 1 | NarrativeModal |
| `#5a4a10` | 1 | CardHand |
| `#5a8a40` | 1 | +page |
| `#601010` | 1 | OngoingActionsPanel |
| `#602020` | 1 | FacilityPicker |
| `#603820` | 1 | SpaceNodePicker |
| `#6a2020` | 1 | +page |
| `#6a2a1a` | 1 | +page |
| `#6a4808` | 1 | TechTreeModal |
| `#6a5020` | 1 | SpaceNodePicker |
| `#7a2a2a` | 1 | EventZone |
| `#7a6a10` | 1 | CardHand |
| `#804040` | 1 | PhaseControls |
| `#8b3030` | 1 | HUD |


---

## 4. Border widths

| Value | Count | Files |
|---|---|---|
| `1px` | 160 | +page, +page, +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, EventZone, FacilityOverview, FacilityPicker, HUD, MapContainer, NarrativeModal, NewsTicker, OngoingActionsPanel, PhaseControls, ResearchFeed, ScienceNewsFeed, SignalTrack, SpaceNodePicker, SpaceOverview, TechProgressSummary, TechTreeModal, TileTooltip, Tooltip |
| `2px` | 5 | BoardPanel, MapContainer, TechTreeModal |
| `1.5px` | 1 | BoardPanel |


---

## 5. Border full shorthands

| Value | Count | Files |
|---|---|---|
| `1px solid #1e2530` | 31 | +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, EventZone, FacilityOverview, HUD, MapContainer, NarrativeModal, OngoingActionsPanel, PhaseControls, ScienceNewsFeed, SignalTrack, SpaceOverview, TechProgressSummary |
| `none` | 23 | +page, BoardPanel, FacilityOverview, FacilityPicker, HUD, MapContainer, NewsTicker, OngoingActionsPanel, SpaceNodePicker, SpaceOverview |
| `1px solid #1a2535` | 10 | +page, +page, CompletedProjectsPanel, HUD |
| `1px solid` | 7 | CardHand, EventZone, NarrativeModal, SpaceNodePicker, TechTreeModal |
| `1px solid #0e1c28` | 7 | TechTreeModal |
| `1px solid #1a2530` | 6 | BoardPanel, NewsTicker, TechProgressSummary |
| `1px solid #1a2a3a` | 6 | SpaceNodePicker, TileTooltip |
| `1px solid #2a3a50` | 5 | +page, HUD, MapContainer |
| `1px solid #1a2538` | 4 | FacilityPicker |
| `1px solid #1a5030` | 4 | BoardPanel, OngoingActionsPanel |
| `1px solid #101820` | 3 | FacilityPicker, SpaceNodePicker |
| `1px solid #111820` | 3 | FacilityOverview, SpaceOverview |
| `1px solid #162230` | 3 | TechTreeModal |
| `1px solid #1a2030` | 3 | OngoingActionsPanel, ResearchFeed |
| `1px solid #1a3050` | 3 | OngoingActionsPanel, PhaseControls, ResearchFeed |
| `1px solid #1e2a3a` | 3 | +page, +page, FacilityPicker |
| `1px solid #1e2d40` | 3 | FacilityOverview, NewsTicker, SpaceOverview |
| `1px solid #2a4a6a` | 3 | +page, +page, HUD |
| `1px solid #0e1820` | 2 | BoardPanel |
| `1px solid #141c26` | 2 | ScienceNewsFeed, TechProgressSummary |
| `1px solid #1a3040` | 2 | TechTreeModal |
| `1px solid #1a4030` | 2 | FacilityPicker, SpaceNodePicker |
| `1px solid #2a4060` | 2 | EventZone, FacilityPicker |
| `1px solid #2a5080` | 2 | EventZone, OngoingActionsPanel |
| `1px solid #2a5870` | 2 | SpaceNodePicker, SpaceOverview |
| `1px solid #2a6040` | 2 | +page, +page |
| `1px solid #2a6050` | 2 | FacilityPicker, SpaceNodePicker |
| `1px solid #2a6090` | 2 | NarrativeModal |
| `1px solid #3a2c08` | 2 | TechTreeModal |
| `2px solid #78350f` | 2 | BoardPanel |
| `1.5px dashed #475569` | 1 | BoardPanel |
| `1px dashed #2a3a20` | 1 | +page |
| `1px solid #0c1820` | 1 | TechTreeModal |
| `1px solid #1a2830` | 1 | OngoingActionsPanel |
| `1px solid #1a3020` | 1 | TechTreeModal |
| `1px solid #1a3a50` | 1 | CompletedProjectsPanel |
| `1px solid #1a4060` | 1 | CompletedProjectsPanel |
| `1px solid #1a4870` | 1 | OngoingActionsPanel |
| `1px solid #1a4a20` | 1 | CompletedProjectsPanel |
| `1px solid #1a6030` | 1 | OngoingActionsPanel |
| `1px solid #1e2f42` | 1 | CompletedProjectsPanel |
| `1px solid #1e3048` | 1 | SpaceOverview |
| `1px solid #1e3050` | 1 | TileTooltip |
| `1px solid #1e3a5a` | 1 | SpaceNodePicker |
| `1px solid #2a3040` | 1 | HUD |
| `1px solid #2a3545` | 1 | EventZone |
| `1px solid #2a3a4a` | 1 | NarrativeModal |
| `1px solid #2a3a56` | 1 | Tooltip |
| `1px solid #3a1a60` | 1 | CompletedProjectsPanel |
| `1px solid #3a2020` | 1 | PhaseControls |
| `1px solid #3a2a08` | 1 | CardHand |
| `1px solid #3a2e08` | 1 | TechTreeModal |
| `1px solid #4a1a1a` | 1 | FacilityPicker |
| `1px solid #4a1a40` | 1 | CompletedProjectsPanel |
| `1px solid #4a3010` | 1 | CompletedProjectsPanel |
| `1px solid #504010` | 1 | OngoingActionsPanel |
| `1px solid #5a3a10` | 1 | +page |
| `1px solid #5a4a10` | 1 | CardHand |
| `1px solid #601010` | 1 | OngoingActionsPanel |
| `1px solid #602020` | 1 | FacilityPicker |
| `1px solid #6a2020` | 1 | +page |
| `1px solid #6a2a1a` | 1 | +page |
| `1px solid #6a4808` | 1 | TechTreeModal |
| `1px solid #8b3030` | 1 | HUD |
| `1px solid transparent` | 1 | HUD |
| `2px solid #166534` | 1 | BoardPanel |
| `2px solid #1a3040` | 1 | TechTreeModal |
| `2px solid transparent` | 1 | MapContainer |


---

## 6. Font sizes

| Value | Count | Files |
|---|---|---|
| `0.58rem` | 39 | +page, BlocStatusPanel, BoardPanel, CardHand, EventZone, FacilityOverview, FacilityPicker, OngoingActionsPanel, ScienceNewsFeed, SpaceNodePicker, SpaceOverview, TechProgressSummary, TechTreeModal, TileTooltip |
| `0.65rem` | 39 | +page, +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, EventZone, FacilityOverview, FacilityPicker, HUD, MapContainer, NarrativeModal, NewsTicker, OngoingActionsPanel, PhaseControls, ResearchFeed, SignalTrack, SpaceNodePicker, TechProgressSummary, TechTreeModal |
| `0.6rem` | 35 | +page, +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, EventZone, FacilityOverview, FacilityPicker, HUD, MapContainer, NarrativeModal, NewsTicker, OngoingActionsPanel, PhaseControls, ResearchFeed, SpaceNodePicker, SpaceOverview, TechTreeModal, Tooltip |
| `0.55rem` | 28 | +page, BlocStatusPanel, BoardPanel, CardHand, CompletedProjectsPanel, FacilityOverview, HUD, MapContainer, NarrativeModal, OngoingActionsPanel, ResearchFeed, SpaceOverview, TechProgressSummary, TechTreeModal |
| `0.62rem` | 25 | +page, CardHand, EventZone, FacilityPicker, HUD, MapContainer, NewsTicker, ResearchFeed, ScienceNewsFeed, SpaceNodePicker, SpaceOverview, TechProgressSummary, TechTreeModal, TileTooltip |
| `0.7rem` | 19 | +page, +page, CardHand, EventZone, FacilityOverview, FacilityPicker, HUD, MapContainer, PhaseControls, SignalTrack, SpaceNodePicker, SpaceOverview, TechTreeModal, TileTooltip |
| `0.5rem` | 16 | +page, BlocStatusPanel, BoardPanel, NarrativeModal, PhaseControls, TechTreeModal |
| `0.68rem` | 12 | +page, CardHand, EventZone, FacilityPicker, HUD, NewsTicker, SignalTrack, SpaceNodePicker |
| `0.72rem` | 10 | +page, +page, EventZone, FacilityPicker, HUD, SpaceNodePicker |
| `0.52rem` | 8 | BoardPanel, CompletedProjectsPanel, SpaceNodePicker, SpaceOverview |
| `0.75rem` | 7 | +page, CardHand, FacilityPicker, HUD, SpaceNodePicker |
| `0.8rem` | 5 | +page, EventZone, HUD, TechTreeModal |
| `0.48rem` | 4 | BlocStatusPanel, BoardPanel |
| `0.85rem` | 4 | HUD, NarrativeModal, TechTreeModal |
| `0.54rem` | 3 | TechTreeModal |
| `0.56rem` | 3 | FacilityPicker, SpaceNodePicker |
| `0.76rem` | 3 | FacilityPicker, SpaceNodePicker |
| `1rem` | 3 | HUD, NarrativeModal, TechTreeModal |
| `0.9rem` | 2 | +page, HUD |
| `1.1rem` | 2 | +page, +page |
| `1.2rem` | 2 | +page, CompletedProjectsPanel |
| `0.45rem` | 1 | NarrativeModal |
| `0.63rem` | 1 | OngoingActionsPanel |
| `0.67rem` | 1 | EventZone |
| `0.78rem` | 1 | +page |
| `0.82rem` | 1 | +page |
| `1.3rem` | 1 | +page |
| `1.4rem` | 1 | PhaseControls |
| `1.6rem` | 1 | +page |
| `17px` | 1 | +layout |
| `2.5rem` | 1 | +page |


---

## 7. Padding

| Value | Count | Files |
|---|---|---|
| `0` | 10 | +layout, EventZone, FacilityPicker, HUD, MapContainer, NarrativeModal, PhaseControls, SpaceNodePicker |
| `0.1rem 0.35rem` | 7 | BoardPanel, EventZone, HUD, SpaceNodePicker, TechTreeModal |
| `0.4rem 0.6rem` | 7 | FacilityOverview, HUD, MapContainer, NewsTicker, ResearchFeed, ScienceNewsFeed, SpaceOverview |
| `0.75rem` | 6 | +page, +page, CardHand, CompletedProjectsPanel, TechTreeModal |
| `0 0.2rem` | 5 | FacilityPicker, NewsTicker, SpaceNodePicker |
| `0.1rem 0.3rem` | 5 | BoardPanel, CardHand, NarrativeModal, OngoingActionsPanel, ResearchFeed |
| `0.5rem` | 5 | BoardPanel, CardHand, TechTreeModal |
| `0.6rem` | 5 | CompletedProjectsPanel, EventZone, FacilityPicker, SpaceNodePicker |
| `0.2rem` | 4 | BoardPanel, CardHand, TechTreeModal |
| `0.6rem 0.8rem` | 4 | FacilityPicker, SpaceNodePicker |
| `1px 4px` | 4 | BlocStatusPanel, CompletedProjectsPanel |
| `2rem` | 4 | +page, +page |
| `0 0.1rem` | 3 | FacilityOverview, HUD, SpaceOverview |
| `0.1rem 0.4rem` | 3 | HUD, TechTreeModal |
| `0.5rem 0.6rem` | 3 | NewsTicker, ResearchFeed, TechProgressSummary |
| `0.5rem 0.75rem` | 3 | +page, CardHand |
| `0.8rem` | 3 | FacilityPicker, SpaceNodePicker |
| `8px 12px 6px` | 3 | BlocStatusPanel, BoardPanel, CompletedProjectsPanel |
| `0.05rem` | 2 | NewsTicker, ScienceNewsFeed |
| `0.15rem 0.5rem` | 2 | FacilityPicker, TechTreeModal |
| `0.25rem` | 2 | FacilityPicker |
| `0.25rem 0.5rem` | 2 | BoardPanel, Tooltip |
| `0.25rem 0.6rem` | 2 | FacilityOverview, ScienceNewsFeed |
| `0.28rem 0.65rem` | 2 | FacilityPicker, SpaceNodePicker |
| `0.2rem 0.45rem` | 2 | BoardPanel |
| `0.2rem 0.5rem` | 2 | FacilityPicker, OngoingActionsPanel |
| `0.3rem` | 2 | +page, EventZone |
| `0.3rem 0` | 2 | FacilityOverview, SpaceOverview |
| `0.3rem 0.4rem` | 2 | OngoingActionsPanel |
| `0.3rem 0.5rem` | 2 | BoardPanel, EventZone |
| `0.3rem 0.6rem` | 2 | ScienceNewsFeed, TechProgressSummary |
| `0.45rem 0.8rem` | 2 | FacilityPicker, SpaceNodePicker |
| `0.45rem 0.9rem` | 2 | HUD, TechTreeModal |
| `0.4rem` | 2 | +page, FacilityOverview |
| `0.75rem 1rem` | 2 | +page, +page |
| `0.8rem 1.2rem` | 2 | NarrativeModal |
| `1px 5px` | 2 | +page, SpaceOverview |
| `1rem` | 2 | +page, FacilityOverview |
| `2px 4px 0` | 2 | MapContainer |
| `2px 6px` | 2 | MapContainer, SpaceOverview |
| `6px 8px` | 2 | BlocStatusPanel |
| `0 0.22rem` | 1 | SpaceNodePicker |
| `0 0.25rem` | 1 | FacilityPicker |
| `0 0.3rem` | 1 | EventZone |
| `0 0.6rem` | 1 | NewsTicker |
| `0.08rem 0.3rem` | 1 | TechTreeModal |
| `0.12rem 0.35rem` | 1 | TechTreeModal |
| `0.12rem 0.4rem` | 1 | TechTreeModal |
| `0.15rem 0.25rem` | 1 | NewsTicker |
| `0.15rem 0.35rem` | 1 | OngoingActionsPanel |
| `0.15rem 0.4rem` | 1 | NarrativeModal |
| `0.15rem 0.6rem 0.15rem 0.9rem` | 1 | SpaceOverview |
| `0.18rem 0.45rem` | 1 | TechTreeModal |
| `0.18rem 0.6rem 0.18rem 0.9rem` | 1 | SpaceOverview |
| `0.1rem 0.5rem` | 1 | TechTreeModal |
| `0.25rem 0.4rem` | 1 | CardHand |
| `0.25rem 0.9rem 0.35rem` | 1 | SpaceOverview |
| `0.28rem 0.7rem` | 1 | SpaceNodePicker |
| `0.2rem 0` | 1 | +page |
| `0.2rem 0.4rem` | 1 | EventZone |
| `0.2rem 0.6rem` | 1 | NarrativeModal |
| `0.35rem 0.5rem` | 1 | ResearchFeed |
| `0.35rem 0.5rem 0.4rem` | 1 | OngoingActionsPanel |
| `0.35rem 0.6rem` | 1 | +page |
| `0.35rem 0.9rem` | 1 | NarrativeModal |
| `0.45rem 0.5rem` | 1 | TechProgressSummary |
| `0.45rem 0.6rem` | 1 | TileTooltip |
| `0.45rem 1.1rem` | 1 | PhaseControls |
| `0.45rem 1rem` | 1 | TechTreeModal |
| `0.4rem 0` | 1 | TechProgressSummary |
| `0.4rem 0.5rem` | 1 | BoardPanel |
| `0.4rem 0.6rem 0.2rem` | 1 | SpaceOverview |
| `0.4rem 0.6rem 0.3rem` | 1 | SpaceOverview |
| `0.4rem 0.6rem 0.5rem` | 1 | OngoingActionsPanel |
| `0.4rem 0.8rem` | 1 | SpaceNodePicker |
| `0.4rem 1rem` | 1 | HUD |
| `0.55rem 0` | 1 | +page |
| `0.55rem 0.65rem` | 1 | CardHand |
| `0.55rem 0.85rem` | 1 | HUD |
| `0.55rem 0.9rem` | 1 | HUD |
| `0.5rem 0` | 1 | EventZone |
| `0.5rem 0.75rem 0.5rem 0.75rem` | 1 | PhaseControls |
| `0.5rem 0.8rem` | 1 | FacilityPicker |
| `0.6rem 0.6rem 0` | 1 | SignalTrack |
| `0.6rem 1rem` | 1 | +page |
| `0.6rem 2rem` | 1 | +page |
| `0.7rem 0.8rem` | 1 | SpaceNodePicker |
| `0.7rem 2.5rem` | 1 | +page |
| `0.9rem 0.8rem` | 1 | FacilityPicker |
| `1.2rem 1rem` | 1 | NarrativeModal |
| `1.5rem` | 1 | +page |
| `100%` | 1 | NewsTicker |
| `2rem 0` | 1 | CompletedProjectsPanel |
| `2rem 2.5rem` | 1 | NarrativeModal |
| `3px 8px 4px` | 1 | MapContainer |
| `6px` | 1 | BlocStatusPanel |


---

## 8. Gap

| Value | Count | Files |
|---|---|---|
| `0.5rem` | 29 | +page, +page, BoardPanel, CompletedProjectsPanel, EventZone, FacilityOverview, FacilityPicker, HUD, NarrativeModal, NewsTicker, OngoingActionsPanel, PhaseControls, ResearchFeed, SignalTrack, SpaceNodePicker, SpaceOverview, TechProgressSummary, TechTreeModal |
| `0.4rem` | 18 | +page, EventZone, FacilityOverview, FacilityPicker, HUD, NarrativeModal, NewsTicker, OngoingActionsPanel, ResearchFeed, ScienceNewsFeed, SpaceOverview, TechTreeModal |
| `0.35rem` | 11 | CardHand, EventZone, FacilityPicker, OngoingActionsPanel, SignalTrack, SpaceNodePicker, SpaceOverview, TechProgressSummary, TechTreeModal |
| `0.3rem` | 9 | BoardPanel, CardHand, EventZone, OngoingActionsPanel, SpaceNodePicker, TechProgressSummary, TechTreeModal |
| `0.6rem` | 9 | +page, CardHand, CompletedProjectsPanel, FacilityPicker, HUD, NarrativeModal, SpaceNodePicker, TechTreeModal |
| `0.75rem` | 8 | +page, FacilityPicker, HUD, PhaseControls, SpaceNodePicker |
| `1rem` | 7 | +page, CardHand, HUD, MapContainer, NarrativeModal, SpaceNodePicker, TechTreeModal |
| `0.25rem` | 6 | BoardPanel, HUD, TechProgressSummary, TechTreeModal |
| `0.2rem` | 6 | BoardPanel, CompletedProjectsPanel, HUD, MapContainer, OngoingActionsPanel |
| `3px` | 6 | +page, BlocStatusPanel, CompletedProjectsPanel, TechTreeModal |
| `4px` | 4 | BlocStatusPanel |
| `0` | 3 | CardHand, EventZone, NewsTicker |
| `0.15rem` | 3 | BoardPanel, CardHand, NarrativeModal |
| `1px` | 3 | MapContainer, ScienceNewsFeed |
| `5px` | 3 | +page, MapContainer |
| `6px` | 3 | BlocStatusPanel |
| `0.1rem` | 2 | HUD |
| `0.22rem` | 2 | FacilityPicker, SpaceNodePicker |
| `2px` | 2 | BlocStatusPanel, TechTreeModal |
| `0.45rem` | 1 | FacilityPicker |
| `0.8rem` | 1 | TechTreeModal |
| `1.2rem` | 1 | +page |
| `1.5rem` | 1 | TechTreeModal |
| `12px` | 1 | BlocStatusPanel |
| `8px` | 1 | BlocStatusPanel |


---

## 9. Margin

| Value | Count | Files |
|---|---|---|
| `0` | 16 | +layout, +page, +page, BoardPanel, CardHand, EventZone, NarrativeModal, OngoingActionsPanel, ResearchFeed, SpaceOverview, TechProgressSummary |
| `0.1rem` | 11 | +page, BoardPanel, CardHand, FacilityOverview, OngoingActionsPanel, SpaceOverview, TileTooltip |
| `0.2rem` | 6 | EventZone, NarrativeModal, OngoingActionsPanel, SignalTrack, SpaceOverview |
| `0.3rem` | 4 | +page, CardHand, SpaceNodePicker |
| `0.15rem` | 3 | BoardPanel, FacilityOverview, TileTooltip |
| `0.25rem` | 3 | BoardPanel, SpaceOverview, TechTreeModal |
| `0.4rem` | 3 | +page, NarrativeModal |
| `4px` | 3 | BlocStatusPanel, HUD, MapContainer |
| `auto` | 3 | MapContainer, SpaceNodePicker, TechTreeModal |
| `0.4rem 0 0` | 2 | +page |
| `0.6rem` | 2 | +page |
| `1.5rem` | 2 | +page |
| `2rem` | 2 | +page, +page |
| `-0.15rem` | 1 | BoardPanel |
| `0 0 0.2rem` | 1 | +page |
| `0 0 0.75rem` | 1 | +page |
| `0 0 1.5rem` | 1 | +page |
| `0 0.75rem` | 1 | CardHand |
| `0.1rem 0` | 1 | HUD |
| `0.25rem 0` | 1 | TileTooltip |
| `0.35rem` | 1 | +page |
| `0.5rem` | 1 | +page |
| `1.8rem` | 1 | +page |
| `2px` | 1 | MapContainer |
| `4px 0 2px` | 1 | BlocStatusPanel |


---

## 10. Border radius

| Value | Count | Files |
|---|---|---|
| `2px` | 34 | +page, BlocStatusPanel, BoardPanel, CompletedProjectsPanel, HUD, MapContainer, NewsTicker, OngoingActionsPanel, PhaseControls, ResearchFeed, SignalTrack, SpaceOverview, TechProgressSummary, TechTreeModal |
| `1px` | 21 | BlocStatusPanel, CompletedProjectsPanel, OngoingActionsPanel, SignalTrack, TechTreeModal |
| `3px` | 15 | +page, +page, BoardPanel, CompletedProjectsPanel, Tooltip |
| `50%` | 5 | +page, BoardPanel, NarrativeModal, PhaseControls, TechTreeModal |
| `4px` | 2 | +page, +page |


---

## 11. Font weight

| Value | Count | Files |
|---|---|---|
| `bold` | 4 | +page, HUD, PhaseControls, TechTreeModal |
| `600` | 3 | BoardPanel, ResearchFeed |
| `700` | 3 | BoardPanel, PhaseControls |
| `normal` | 3 | +page, +page, NarrativeModal |


---

## 12. Shared class name candidates

Classes that appear in **2 or more files** — strong candidates for extraction to shared CSS.

| Class | Files (70 shared) |
|---|---|
| `.active` | +page, MapContainer, NarrativeModal, OngoingActionsPanel, TechTreeModal |
| `.close-btn` | FacilityOverview, FacilityPicker, SpaceNodePicker, SpaceOverview, TechTreeModal |
| `.empty` | EventZone, FacilityOverview, SpaceOverview, TechProgressSummary |
| `.era-badge` | +page, BlocStatusPanel, CompletedProjectsPanel, HUD |
| `.panel` | CompletedProjectsPanel, FacilityOverview, OngoingActionsPanel, SpaceOverview |
| `.panel-header` | BlocStatusPanel, CompletedProjectsPanel, FacilityOverview, SpaceOverview |
| `.bloc-name` | +page, BlocStatusPanel, HUD |
| `.disabled` | BoardPanel, CardHand, TechTreeModal |
| `.divider` | HUD, SignalTrack, TileTooltip |
| `.facility-name` | FacilityPicker, SpaceNodePicker, TileTooltip |
| `.facility-row` | FacilityPicker, SpaceNodePicker, SpaceOverview |
| `.panel-title` | BoardPanel, EventZone, SignalTrack |
| `.tile-type` | FacilityOverview, FacilityPicker, TileTooltip |
| `.title` | +page, FacilityOverview, SpaceOverview |
| `.will` | +page, CompletedProjectsPanel, HUD |
| `.backdrop` | NarrativeModal, TechTreeModal |
| `.bar-fill` | +page, HUD |
| `.bar-row` | +page, TechProgressSummary |
| `.bar-track` | +page, HUD |
| `.bottom-row` | +page, PhaseControls |
| `.btn` | CardHand, EventZone |
| `.build-btn` | FacilityPicker, SpaceNodePicker |
| `.build-cost` | FacilityPicker, SpaceNodePicker |
| `.build-section` | FacilityPicker, SpaceNodePicker |
| `.build-time` | FacilityPicker, SpaceNodePicker |
| `.cant-afford` | FacilityPicker, SpaceNodePicker |
| `.card` | CardHand, CompletedProjectsPanel |
| `.card-header` | BoardPanel, CardHand |
| `.card-info` | BoardPanel, CompletedProjectsPanel |
| `.cat-discovery` | NewsTicker, ScienceNewsFeed |
| `.close-build-btn` | FacilityPicker, SpaceNodePicker |
| `.condition-badge` | FacilityPicker, SpaceNodePicker |
| `.count` | FacilityOverview, PhaseControls |
| `.detail-backdrop` | HUD, MapContainer |
| `.expanded` | BlocStatusPanel, OngoingActionsPanel |
| `.facility-action` | FacilityPicker, SpaceNodePicker |
| `.facility-desc` | FacilityPicker, SpaceNodePicker |
| `.facility-info` | FacilityPicker, SpaceNodePicker |
| `.facility-list` | FacilityPicker, SpaceNodePicker |
| `.facility-outputs` | FacilityPicker, SpaceNodePicker |
| `.field` | CompletedProjectsPanel, TileTooltip |
| `.field-value` | BlocStatusPanel, HUD |
| `.funding` | +page, CompletedProjectsPanel |
| `.label` | HUD, PhaseControls |
| `.list` | FacilityOverview, SpaceOverview |
| `.locked` | MapContainer, OngoingActionsPanel |
| `.locked-label` | FacilityPicker, SpaceNodePicker |
| `.locked-name` | FacilityPicker, SpaceNodePicker |
| `.locked-row` | FacilityPicker, SpaceNodePicker |
| `.materials` | +page, CompletedProjectsPanel |
| `.modal-header` | NarrativeModal, TechTreeModal |
| `.modal-title` | NarrativeModal, TechTreeModal |
| `.negative` | EventZone, TileTooltip |
| `.no-facilities` | FacilityPicker, SpaceNodePicker |
| `.node-label` | SpaceNodePicker, SpaceOverview |
| `.open-build-btn` | FacilityPicker, SpaceNodePicker |
| `.overlay` | FacilityOverview, SpaceOverview |
| `.picker` | FacilityPicker, SpaceNodePicker |
| `.picker-backdrop` | FacilityPicker, SpaceNodePicker |
| `.picker-header` | FacilityPicker, SpaceNodePicker |
| `.picker-title` | FacilityPicker, SpaceNodePicker |
| `.project-card` | CompletedProjectsPanel, OngoingActionsPanel |
| `.project-name` | CompletedProjectsPanel, OngoingActionsPanel |
| `.resource` | HUD, TileTooltip |
| `.unaffordable` | FacilityPicker, SpaceNodePicker |
| `.unlock-name` | NarrativeModal, TechTreeModal |
| `.upgrade-btn` | SpaceNodePicker, SpaceOverview |
| `.upgrade-row` | SpaceNodePicker, SpaceOverview |
| `.upkeep` | FacilityPicker, SpaceNodePicker |
| `.vacant-badge` | BoardPanel, SpaceNodePicker |

---

## Summary observations

- **176** distinct `color` values across the codebase. Top 5: `#8aacca`, `#c8a040`, `#4a9b7a`, `#c8d0d8`, `#3a5060`.
- **117** distinct `background` / `background-color` values. Top 5: `transparent`, `none`, `#0a1018`, `#0d1520`, `#060a10`.
- **103** distinct border colour values.
- **31** distinct `font-size` values.
- **96** distinct `padding` values.
- **25** distinct `gap` values.
- **70** class names appear in 2+ files — candidates for shared utility CSS.
