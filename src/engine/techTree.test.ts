import { describe, it, expect } from 'vitest';
import { getTechTier } from './techTree';
import { TECH_DEFS } from '../data/loader';
import type { TechDef } from './types';

// ---------------------------------------------------------------------------
// Helper: build a minimal TechDef with a given tier value
// ---------------------------------------------------------------------------
function defWithTier(tier: number): TechDef {
  return {
    id: 'test',
    name: 'Test Tech',
    rumourText: '',
    baseRecipe: { physics: 50 },
    recipeVariance: 0,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
    tier,
    requiredTechIds: [],
  };
}

// ---------------------------------------------------------------------------
// getTechTier returns def.tier directly
// ---------------------------------------------------------------------------

describe('getTechTier', () => {
  it('returns 1 for a tier-1 def', () => {
    expect(getTechTier(defWithTier(1))).toBe(1);
  });

  it('returns 2 for a tier-2 def', () => {
    expect(getTechTier(defWithTier(2))).toBe(2);
  });

  it('returns 3 for a tier-3 def', () => {
    expect(getTechTier(defWithTier(3))).toBe(3);
  });

  it('returns 4 for a tier-4 def', () => {
    expect(getTechTier(defWithTier(4))).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Era 1 tech tier assignments (from def.tier set in technologies.ts)
// ---------------------------------------------------------------------------

describe('getTechTier — Era 1 tech assignments', () => {
  // Tier 1
  it('microprocessors → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('microprocessors')!)).toBe(1);
  });
  it('liquidThrusters → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('liquidThrusters')!)).toBe(1);
  });
  it('fibreglassComposites → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('fibreglassComposites')!)).toBe(1);
  });
  it('atmosphericChemistry → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('atmosphericChemistry')!)).toBe(1);
  });

  // Tier 2
  it('cryogenicPropulsion → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('cryogenicPropulsion')!)).toBe(2);
  });
  it('photovoltaicSolarCells → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('photovoltaicSolarCells')!)).toBe(2);
  });
  it('orbitalMechanics → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('orbitalMechanics')!)).toBe(2);
  });
  it('personalComputers → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('personalComputers')!)).toBe(2);
  });

  // Tier 3
  it('fibreOptics → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('fibreOptics')!)).toBe(3);
  });
  it('geneticEngineering → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('geneticEngineering')!)).toBe(3);
  });
  it('satelliteCommunications → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('satelliteCommunications')!)).toBe(3);
  });

  // Tier 4
  it('spaceImaging → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('spaceImaging')!)).toBe(4);
  });
  it('particlePhysicsDetectors → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('particlePhysicsDetectors')!)).toBe(4);
  });
  it('signalPatternAnalysis → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('signalPatternAnalysis')!)).toBe(4);
  });
  it('internetProtocols → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('internetProtocols')!)).toBe(4);
  });
});

