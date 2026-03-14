import { describe, it, expect } from 'vitest';
import { getTechTier } from './techTree';
import { TECH_DEFS } from '../data/technologies';
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
  it('integratedCircuits → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('integratedCircuits')!)).toBe(1);
  });
  it('rocketGuidanceSystems → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('rocketGuidanceSystems')!)).toBe(1);
  });
  it('satelliteCommunications → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('satelliteCommunications')!)).toBe(1);
  });
  it('microprocessors → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('microprocessors')!)).toBe(1);
  });

  // Tier 2
  it('personalComputing → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('personalComputing')!)).toBe(2);
  });
  it('geneticSequencing → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('geneticSequencing')!)).toBe(2);
  });
  it('globalPositioningNetwork → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('globalPositioningNetwork')!)).toBe(2);
  });
  it('roboticsAutomation → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('roboticsAutomation')!)).toBe(2);
  });

  // Tier 3
  it('internetProtocols → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('internetProtocols')!)).toBe(3);
  });
  it('digitisedTelemetry → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('digitisedTelemetry')!)).toBe(3);
  });
  it('signalPatternAnalysis → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('signalPatternAnalysis')!)).toBe(3);
  });

  // Tier 4
  it('orbitalMechanics → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('orbitalMechanics')!)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Distribution: Era 1 has 4/4/3/1 techs across tiers 1–4
// ---------------------------------------------------------------------------

describe('getTechTier — Era 1 distribution', () => {
  it('produces a 4/4/3/1 distribution across the four tiers', () => {
    const counts = [0, 0, 0, 0];
    for (const def of TECH_DEFS.values()) {
      counts[getTechTier(def) - 1]++;
    }
    expect(counts).toEqual([4, 4, 3, 1]);
  });
});
