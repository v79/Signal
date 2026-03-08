// =============================================================================
// SIGNAL — Technology Definitions (Era 1: Earth, 1970–2010)
// Static definitions for all researchable technologies in Era 1.
// Era 2 (Near Space) and Era 3 (Asteroid Belt) techs are deferred to
// Phase 15 and Phase 16 content passes respectively.
//
// Field threshold design (40-turn Era 1):
//   Tier 1 (~30–60 pts):   turns 5–12   (years 1975–1982)
//   Tier 2 (~75–120 pts):  turns 12–22  (years 1982–1992)
//   Tier 3 (~120–160 pts): turns 22–34  (years 1992–2004)
//   Tier 4 (~180–200 pts): turns 30–40  (years 2000–2010) — Era 2 gate
// =============================================================================

import type { TechDef } from '../engine/types';

export const TECH_DEFS: Map<string, TechDef> = new Map([

  // ---------------------------------------------------------------------------
  // Tier 1 — Foundation Technologies (1975–1982)
  // ---------------------------------------------------------------------------

  ['integratedCircuits', {
    id: 'integratedCircuits',
    name: 'Integrated Circuit Arrays',
    rumourText: 'Miniaturised components are being tested that may replace entire banks of discrete transistors.',
    baseRecipe: { engineering: 40, computing: 25 },
    recipeVariance: 0.20,
    requiresSimultaneous: false,
    unlocksCards: ['softwareGrant'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['rocketGuidanceSystems', {
    id: 'rocketGuidanceSystems',
    name: 'Precision Rocket Guidance',
    rumourText: 'Navigation accuracy beyond the atmosphere may soon allow reliable orbital insertion on first attempt.',
    baseRecipe: { physics: 35, mathematics: 30, engineering: 40 },
    recipeVariance: 0.15,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['satelliteCommunications', {
    id: 'satelliteCommunications',
    name: 'Satellite Communications',
    rumourText: 'A relay station in orbit could link every ground facility on the globe simultaneously.',
    baseRecipe: { physics: 45, engineering: 50 },
    recipeVariance: 0.20,
    requiresSimultaneous: false,
    unlocksCards: ['globalBroadcast'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['microprocessors', {
    id: 'microprocessors',
    name: 'Microprocessor Architecture',
    rumourText: 'A single chip carrying a complete instruction set has been demonstrated in prototype form.',
    baseRecipe: { computing: 55, mathematics: 40 },
    recipeVariance: 0.20,
    requiresSimultaneous: false,
    unlocksCards: ['computerModellingRun'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  // ---------------------------------------------------------------------------
  // Tier 2 — Orbital Era Technologies (1982–1992)
  // ---------------------------------------------------------------------------

  ['personalComputing', {
    id: 'personalComputing',
    name: 'Personal Computing',
    rumourText: 'Desktop machines with sufficient power for scientific calculation may reach civilian researchers within years.',
    baseRecipe: { computing: 80, socialScience: 45 },
    recipeVariance: 0.25,
    requiresSimultaneous: false,
    unlocksCards: ['digitalCoordination'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['geneticSequencing', {
    id: 'geneticSequencing',
    name: 'Genetic Sequencing Technology',
    rumourText: 'The chemical language of DNA is almost legible — automated reading may be possible within a decade.',
    baseRecipe: { biochemistry: 75, computing: 55 },
    recipeVariance: 0.25,
    requiresSimultaneous: false,
    unlocksCards: ['biomedicalAdvance'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['globalPositioningNetwork', {
    id: 'globalPositioningNetwork',
    name: 'Global Positioning Network',
    rumourText: 'A constellation of precision timing satellites could yield metre-accuracy navigation across the entire planet.',
    baseRecipe: { mathematics: 85, physics: 65, computing: 60 },
    recipeVariance: 0.15,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['roboticsAutomation', {
    id: 'roboticsAutomation',
    name: 'Robotics and Remote Automation',
    rumourText: 'Articulated machines capable of sustained remote operation in hostile environments have passed field trials.',
    baseRecipe: { engineering: 90, computing: 70 },
    recipeVariance: 0.20,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    // Facility unlocks (asteroidMiner) deferred to Phase 16 (Era 3 content pass).
    signalDerived: false,
  }],

  // ---------------------------------------------------------------------------
  // Tier 3 — Digital Age & Signal Foundations (1992–2004)
  // ---------------------------------------------------------------------------

  ['internetProtocols', {
    id: 'internetProtocols',
    name: 'Global Internetwork Protocols',
    rumourText: 'A common packet-routing standard may allow every research facility on Earth to share data in real time.',
    baseRecipe: { computing: 130, mathematics: 95 },
    recipeVariance: 0.20,
    requiresSimultaneous: false,
    unlocksCards: ['openSourceResearch'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['digitisedTelemetry', {
    id: 'digitisedTelemetry',
    name: 'Digitised Space Telemetry',
    rumourText: 'Standardised digital transmission formats for deep-space probes would dramatically improve the precision of signal analysis.',
    baseRecipe: { physics: 120, computing: 100, mathematics: 85 },
    recipeVariance: 0.15,
    requiresSimultaneous: false,
    unlocksCards: ['signalDeconvolution'],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
  }],

  ['signalPatternAnalysis', {
    id: 'signalPatternAnalysis',
    name: 'Signal Pattern Analysis',
    rumourText: 'The transmission is not random. The interval structure repeats at a period inconsistent with any known pulsar or natural source.',
    baseRecipe: { computing: 150, mathematics: 125, physics: 100 },
    recipeVariance: 0.10,
    requiresSimultaneous: true,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    // Gated: only enters the rumour pool once signal.eraStrength >= 'structured'.
    signalDerived: true,
  }],

  // ---------------------------------------------------------------------------
  // Tier 4 — Era 2 Gate (2000–2010)
  // ---------------------------------------------------------------------------

  ['orbitalMechanics', {
    id: 'orbitalMechanics',
    name: 'Applied Orbital Mechanics',
    rumourText: 'Sustained human habitation in low orbit is within theoretical reach — the mathematics is there; the engineering must follow.',
    baseRecipe: { physics: 200, mathematics: 140 },
    recipeVariance: 0.15,
    requiresSimultaneous: true,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: ['orbitalPlatform'],
    // Simultaneous requirement: the player must invest in both physics AND mathematics.
    // Neglecting mathematics for physics leaves the Near Space era permanently locked.
    signalDerived: false,
  }],
]);
