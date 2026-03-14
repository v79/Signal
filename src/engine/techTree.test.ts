import { describe, it, expect } from 'vitest';
import { getTechTier } from './techTree';
import { TECH_DEFS } from '../data/technologies';
import type { TechDef } from './types';

// ---------------------------------------------------------------------------
// Helper: build a minimal TechDef with a given baseRecipe sum
// ---------------------------------------------------------------------------
function defWithSum(sum: number): TechDef {
  return {
    id: 'test',
    name: 'Test Tech',
    rumourText: '',
    baseRecipe: { physics: sum },
    recipeVariance: 0,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
    tier: 1,
    requiredTechIds: [],
  };
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('getTechTier — edge cases', () => {
  it('returns tier 1 for an empty recipe (sum = 0)', () => {
    const def: TechDef = { ...defWithSum(0), baseRecipe: {} };
    expect(getTechTier(def)).toBe(1);
  });

  it('returns tier 1 for sum exactly at the tier-1 boundary (100)', () => {
    expect(getTechTier(defWithSum(100))).toBe(1);
  });

  it('returns tier 2 for sum exactly at the tier-2 boundary (165)', () => {
    expect(getTechTier(defWithSum(165))).toBe(2);
  });

  it('returns tier 3 for sum exactly at the tier-3 boundary (255)', () => {
    expect(getTechTier(defWithSum(255))).toBe(3);
  });

  it('returns tier 4 for a very high recipe sum', () => {
    expect(getTechTier(defWithSum(1000))).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Era 1 tech assignments (all 12 techs)
// Expanded baseRecipes (Phase 21) change the sums and tier distribution.
// ---------------------------------------------------------------------------

describe('getTechTier — Era 1 tech assignments', () => {
  // Tier 1 (sum ≤ 100)
  it('integratedCircuits (eng:40 + com:25 + phy:20 + mat:15 = 100) → tier 1', () => {
    expect(getTechTier(TECH_DEFS.get('integratedCircuits')!)).toBe(1);
  });

  // Tier 2 (101–165)
  it('rocketGuidanceSystems (phy:35 + mat:30 + eng:40 + com:20 = 125) → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('rocketGuidanceSystems')!)).toBe(2);
  });

  it('satelliteCommunications (phy:45 + eng:50 + com:30 + mat:25 = 150) → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('satelliteCommunications')!)).toBe(2);
  });

  it('microprocessors (com:55 + mat:40 + eng:30 + phy:20 = 145) → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('microprocessors')!)).toBe(2);
  });

  it('personalComputing (com:80 + soc:45 + eng:35 = 160) → tier 2', () => {
    expect(getTechTier(TECH_DEFS.get('personalComputing')!)).toBe(2);
  });

  // Tier 3 (166–255)
  it('geneticSequencing (bio:75 + com:55 + mat:45 + soc:40 = 215) → tier 3', () => {
    expect(getTechTier(TECH_DEFS.get('geneticSequencing')!)).toBe(3);
  });

  // Tier 4 (> 255)
  it('globalPositioningNetwork (mat:85 + phy:65 + com:60 + eng:55 + soc:40 = 305) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('globalPositioningNetwork')!)).toBe(4);
  });

  it('roboticsAutomation (eng:90 + com:70 + phy:55 + mat:45 = 260) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('roboticsAutomation')!)).toBe(4);
  });

  it('internetProtocols (com:130 + mat:95 + soc:75 + eng:60 + phy:55 = 415) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('internetProtocols')!)).toBe(4);
  });

  it('digitisedTelemetry (phy:120 + com:100 + mat:85 + eng:70 = 375) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('digitisedTelemetry')!)).toBe(4);
  });

  it('orbitalMechanics (phy:200 + mat:140 + eng:120 + com:100 + soc:80 = 640) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('orbitalMechanics')!)).toBe(4);
  });

  it('signalPatternAnalysis (com:150 + mat:125 + phy:100 + eng:80 + bio:60 = 515) → tier 4', () => {
    expect(getTechTier(TECH_DEFS.get('signalPatternAnalysis')!)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Distribution sanity check
// Phase 21 expanded recipes: 1/4/1/6 distribution across the four tiers
// ---------------------------------------------------------------------------

describe('getTechTier — Era 1 distribution', () => {
  it('produces a 1/4/1/6 distribution across the four tiers', () => {
    const counts = [0, 0, 0, 0];
    for (const def of TECH_DEFS.values()) {
      counts[getTechTier(def) - 1]++;
    }
    expect(counts).toEqual([1, 4, 1, 6]);
  });
});
