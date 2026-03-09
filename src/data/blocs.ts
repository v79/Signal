// =============================================================================
// SIGNAL — Bloc Definitions
// NPC bloc simulation: starting resources, will profiles, victory biases.
// =============================================================================

import type { BlocDef } from '../engine/types';

export const BLOC_DEFS: Map<string, BlocDef> = new Map([
  [
    'northAmerica',
    {
      id: 'northAmerica',
      name: 'North American Alliance',
      willProfile: 'democratic',
      victoryBias: 'economicHegemony',
      startingResources: { funding: 80, materials: 60, politicalWill: 70 },
      startingFields: { physics: 15, engineering: 20 },
      victoryCostModifiers: {},
      specificEventTags: ['trade', 'technology'],
      willCeiling: 90,
      willCollapsThreshold: 0,
    },
  ],
  [
    'eastAsia',
    {
      id: 'eastAsia',
      name: 'East Asian Consortium',
      willProfile: 'authoritarian',
      victoryBias: 'terraforming',
      startingResources: { funding: 70, materials: 80, politicalWill: 50 },
      startingFields: { engineering: 25, physics: 8 },
      victoryCostModifiers: {},
      specificEventTags: ['industrial', 'expansion'],
      willCeiling: 75,
      willCollapsThreshold: 15,
    },
  ],
  [
    'southAmerica',
    {
      id: 'southAmerica',
      name: 'South American Union',
      willProfile: 'democratic',
      victoryBias: 'ecologicalRestoration',
      startingResources: { funding: 50, materials: 55, politicalWill: 65 },
      startingFields: { biochemistry: 12, socialScience: 10 },
      victoryCostModifiers: {},
      specificEventTags: ['environment', 'diplomatic'],
      willCeiling: 85,
      willCollapsThreshold: 0,
    },
  ],
  [
    'africaCoalition',
    {
      id: 'africaCoalition',
      name: 'African Coalition',
      willProfile: 'democratic',
      victoryBias: 'wormhole',
      startingResources: { funding: 45, materials: 65, politicalWill: 60 },
      startingFields: { socialScience: 10, biochemistry: 6 },
      victoryCostModifiers: {},
      specificEventTags: ['diplomatic', 'environment'],
      willCeiling: 80,
      willCollapsThreshold: 0,
    },
  ],
  [
    'eurozone',
    {
      id: 'eurozone',
      name: 'European Union',
      willProfile: 'democratic',
      victoryBias: 'ecologicalRestoration',
      startingResources: { funding: 75, materials: 50, politicalWill: 68 },
      startingFields: { physics: 18, mathematics: 12, socialScience: 8 },
      victoryCostModifiers: { ecologicalRestoration: 0.85 },
      specificEventTags: ['diplomatic', 'scientific'],
      willCeiling: 88,
      willCollapsThreshold: 0,
    },
  ],
  [
    'southAsia',
    {
      id: 'southAsia',
      name: 'South Asian Federation',
      willProfile: 'democratic',
      victoryBias: 'wormhole',
      startingResources: { funding: 55, materials: 70, politicalWill: 58 },
      startingFields: { mathematics: 15, engineering: 10 },
      victoryCostModifiers: {},
      specificEventTags: ['scientific', 'industrial'],
      willCeiling: 82,
      willCollapsThreshold: 0,
    },
  ],
  [
    'middlewEast',
    {
      id: 'middleEast',
      name: 'Gulf Consortium',
      willProfile: 'authoritarian',
      victoryBias: 'economicHegemony',
      startingResources: { funding: 90, materials: 45, politicalWill: 55 },
      startingFields: { engineering: 12, physics: 5 },
      victoryCostModifiers: { economicHegemony: 0.8 },
      specificEventTags: ['trade', 'diplomatic'],
      willCeiling: 70,
      willCollapsThreshold: 20,
    },
  ],
]);
