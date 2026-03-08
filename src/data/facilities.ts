// =============================================================================
// SIGNAL — Facility Definitions
// Static definitions for all buildable facility types, across all three eras.
//
// Tech gates (requiredTechId):
//   Era 1 base facilities are available from game start (null).
//   deepSpaceArray requires satelliteCommunications — a proper signal tracking
//     array needs orbital relay infrastructure.
//   computingHub requires microprocessors — high-performance clusters depend
//     on integrated microprocessor architecture.
//   All Era 2 facilities require orbitalMechanics.
//   All Era 3 facilities require their respective Era 3 techs (Phase 16).
// =============================================================================

import type { FacilityDef } from '../engine/types';

export const FACILITY_DEFS: Map<string, FacilityDef> = new Map([
  // ---------------------------------------------------------------------------
  // Era 1 — Earth (available from 1970; some gated by mid-era techs)
  // ---------------------------------------------------------------------------
  ['researchLab', {
    id: 'researchLab',
    name: 'Research Laboratory',
    description: 'Generates Physics and Mathematics field points each turn.',
    era: 'earth',
    allowedTileTypes: ['urban', 'highland'],
    buildCost: { funding: 30, materials: 10 },
    upkeepCost: { funding: 5 },
    fieldOutput: { physics: 3, mathematics: 2 },
    resourceOutput: {},
    adjacencyBonuses: [
      {
        neighborDefId: 'publicUniversity',
        fieldBonus: { physics: 2, mathematics: 1 },
      },
    ],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
  }],

  ['mine', {
    id: 'mine',
    name: 'Resource Mine',
    description: 'Extracts raw materials each turn. Output depletes over time.',
    era: 'earth',
    allowedTileTypes: ['highland', 'arid', 'industrial'],
    buildCost: { materials: 20 },
    upkeepCost: { funding: 2 },
    fieldOutput: {},
    resourceOutput: { materials: 8 },
    adjacencyBonuses: [],
    adjacencyPenalties: [
      {
        neighborDefId: 'researchLab',
        fieldPenalty: { physics: 1 },
      },
    ],
    depletes: true,
    requiredTechId: null,
  }],

  ['solarFarm', {
    id: 'solarFarm',
    name: 'Solar Farm',
    description: 'Generates steady Funding and minor Engineering field points.',
    era: 'earth',
    allowedTileTypes: ['arid', 'agricultural', 'coastal'],
    buildCost: { materials: 15, funding: 10 },
    upkeepCost: {},
    fieldOutput: { engineering: 1 },
    resourceOutput: { funding: 5 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
  }],

  ['publicUniversity', {
    id: 'publicUniversity',
    name: 'Public University',
    description: 'Broad research output across multiple fields. High upkeep.',
    era: 'earth',
    allowedTileTypes: ['urban', 'agricultural'],
    buildCost: { funding: 50, materials: 5 },
    upkeepCost: { funding: 8, politicalWill: 2 },
    fieldOutput: { physics: 2, mathematics: 2, computing: 2, socialScience: 3 },
    resourceOutput: {},
    adjacencyBonuses: [
      {
        neighborDefId: 'researchLab',
        fieldBonus: { physics: 2, mathematics: 1 },
      },
    ],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
  }],

  ['engineeringWorks', {
    id: 'engineeringWorks',
    name: 'Engineering Works',
    description: 'Heavy manufacturing; generates Engineering and Materials.',
    era: 'earth',
    allowedTileTypes: ['industrial', 'urban'],
    buildCost: { funding: 20, materials: 30 },
    upkeepCost: { funding: 3 },
    fieldOutput: { engineering: 4 },
    resourceOutput: { materials: 4 },
    adjacencyBonuses: [],
    adjacencyPenalties: [
      {
        neighborDefId: 'publicUniversity',
        fieldPenalty: { socialScience: 1 },
      },
    ],
    depletes: false,
    requiredTechId: null,
  }],

  ['bioResearchCentre', {
    id: 'bioResearchCentre',
    name: 'Bioresearch Centre',
    description: 'Advanced life science research. Generates Biochemistry and Social Science.',
    era: 'earth',
    allowedTileTypes: ['forested', 'agricultural', 'coastal'],
    buildCost: { funding: 40, materials: 15 },
    upkeepCost: { funding: 6 },
    fieldOutput: { biochemistry: 5, socialScience: 2 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
  }],

  ['deepSpaceArray', {
    id: 'deepSpaceArray',
    name: 'Deep Space Array',
    description: 'Dedicated signal decoding infrastructure. Accelerates decode progress each turn. Requires satellite communications infrastructure.',
    era: 'earth',
    allowedTileTypes: ['highland', 'arid', 'coastal'],
    buildCost: { funding: 60, materials: 40 },
    upkeepCost: { funding: 8 },
    fieldOutput: { physics: 5, computing: 3 },
    resourceOutput: {},
    adjacencyBonuses: [
      {
        neighborDefId: 'researchLab',
        fieldBonus: { physics: 3, mathematics: 2 },
      },
    ],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: 'satelliteCommunications',
  }],

  ['computingHub', {
    id: 'computingHub',
    name: 'Computing Hub',
    description: 'High-performance computing cluster. Strong Computing output; moderate Mathematics. Requires microprocessor architecture.',
    era: 'earth',
    allowedTileTypes: ['urban', 'industrial'],
    buildCost: { funding: 35, materials: 20 },
    upkeepCost: { funding: 7 },
    fieldOutput: { computing: 6, mathematics: 3 },
    resourceOutput: {},
    adjacencyBonuses: [
      {
        neighborDefId: 'deepSpaceArray',
        fieldBonus: { computing: 3 },
      },
    ],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: 'microprocessors',
  }],

  // ---------------------------------------------------------------------------
  // Era 2 — Near Space (all require orbitalMechanics)
  // ---------------------------------------------------------------------------
  ['orbitalPlatform', {
    id: 'orbitalPlatform',
    name: 'Orbital Research Platform',
    description: 'Low-gravity environment enables unique materials science and physics research. Requires applied orbital mechanics.',
    era: 'nearSpace',
    allowedTileTypes: [],
    buildCost: { funding: 80, materials: 60 },
    upkeepCost: { funding: 12, materials: 5 },
    fieldOutput: { physics: 8, engineering: 5 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: 'orbitalMechanics',
  }],

  ['lunarMine', {
    id: 'lunarMine',
    name: 'Lunar Extraction Facility',
    description: 'Harvests regolith and subsurface ice. High yield, finite deposits. Requires applied orbital mechanics.',
    era: 'nearSpace',
    allowedTileTypes: [],
    buildCost: { materials: 50, funding: 30 },
    upkeepCost: { funding: 5 },
    fieldOutput: { engineering: 2 },
    resourceOutput: { materials: 18 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: true,
    requiredTechId: 'orbitalMechanics',
  }],

  // ---------------------------------------------------------------------------
  // Era 3 — Asteroid Belt / Deep Space
  // ---------------------------------------------------------------------------
  ['asteroidMiner', {
    id: 'asteroidMiner',
    name: 'Asteroid Mining Rig',
    description: 'Autonomous extraction from metallic asteroid bodies. Requires advanced robotics.',
    era: 'deepSpace',
    allowedTileTypes: [],
    buildCost: { materials: 80, funding: 40 },
    upkeepCost: { funding: 8 },
    fieldOutput: { engineering: 3 },
    resourceOutput: { materials: 25 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: true,
    requiredTechId: 'roboticsAutomation',
  }],

  ['heliopauseRelay', {
    id: 'heliopauseRelay',
    name: 'Heliopause Signal Relay',
    description: 'Positioned at the outer boundary of the solar system; critical for wormhole communication.',
    era: 'deepSpace',
    allowedTileTypes: [],
    buildCost: { funding: 120, materials: 80 },
    upkeepCost: { funding: 15 },
    fieldOutput: { physics: 12, mathematics: 8, computing: 6 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    // advancedPropulsion is a Phase 15 tech; gating will be added then.
    requiredTechId: null,
  }],
]);
