import { describe, it, expect } from 'vitest';
import {
  generateTechRecipes,
  initialiseTechs,
  getDiscoveryStage,
  checkResearchProgress,
} from './research';
import { createRng } from './rng';
import type { TechDef, TechState, FieldPoints } from './types';
import { ZERO_FIELDS } from './state';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const orbitalMechanicsDef: TechDef = {
  id: 'orbitalMechanics',
  name: 'Orbital Mechanics',
  rumourText: 'Your physicists are discussing unconventional trajectories.',
  baseRecipe: { physics: 40, mathematics: 30, engineering: 20 },
  recipeVariance: 0.2,
  requiresSimultaneous: false,
  unlocksCards: [],
  unlocksProjects: ['firstSatellite'],
  unlocksFacilities: [],
  signalDerived: false,
};

const lifeSupport: TechDef = {
  id: 'lifeSupport',
  name: 'Closed-Loop Life Support',
  rumourText: 'Biologists are exploring long-duration habitation challenges.',
  baseRecipe: { biochemistry: 50, engineering: 35, computing: 20 },
  recipeVariance: 0.2,
  requiresSimultaneous: false,
  unlocksCards: [],
  unlocksProjects: [],
  unlocksFacilities: [],
  signalDerived: false,
};

// Cross-field breakthrough tech
const signalResonanceDef: TechDef = {
  id: 'signalResonance',
  name: 'Signal Resonance Theory',
  rumourText: 'Mathematicians and physicists are collaborating on something unusual.',
  baseRecipe: { physics: 60, mathematics: 60 },
  recipeVariance: 0.1,
  requiresSimultaneous: true,
  unlocksCards: [],
  unlocksProjects: [],
  unlocksFacilities: [],
  signalDerived: false,
};

const allDefs = [orbitalMechanicsDef, lifeSupport, signalResonanceDef];
const defsMap = new Map(allDefs.map((d) => [d.id, d]));

function makeFields(overrides: Partial<FieldPoints> = {}): FieldPoints {
  return { ...ZERO_FIELDS, ...overrides };
}

// ---------------------------------------------------------------------------
// generateTechRecipes
// ---------------------------------------------------------------------------

describe('generateTechRecipes', () => {
  it('generates a recipe for every tech def', () => {
    const rng = createRng('seed-1');
    const recipes = generateTechRecipes(allDefs, rng);
    expect(recipes.size).toBe(allDefs.length);
    for (const def of allDefs) {
      expect(recipes.has(def.id)).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    const r1 = generateTechRecipes(allDefs, createRng('det-seed'));
    const r2 = generateTechRecipes(allDefs, createRng('det-seed'));
    for (const def of allDefs) {
      expect(r1.get(def.id)).toEqual(r2.get(def.id));
    }
  });

  it('produces different recipes for different seeds', () => {
    const r1 = generateTechRecipes(allDefs, createRng('seed-a'));
    const r2 = generateTechRecipes(allDefs, createRng('seed-b'));
    // At least one recipe should differ
    const anyDiffers = allDefs.some((def) => {
      const rec1 = r1.get(def.id);
      const rec2 = r2.get(def.id);
      return JSON.stringify(rec1) !== JSON.stringify(rec2);
    });
    expect(anyDiffers).toBe(true);
  });

  it('keeps thresholds within variance bounds of the base recipe', () => {
    const rng = createRng('bounds-seed');
    const recipes = generateTechRecipes(allDefs, rng);

    for (const def of allDefs) {
      const recipe = recipes.get(def.id)!;
      for (const [field, base] of Object.entries(def.baseRecipe) as [keyof FieldPoints, number][]) {
        const threshold = recipe[field]!;
        const lower = Math.max(1, Math.round(base * (1 - def.recipeVariance)));
        const upper = Math.round(base * (1 + def.recipeVariance));
        expect(threshold).toBeGreaterThanOrEqual(lower);
        expect(threshold).toBeLessThanOrEqual(upper);
      }
    }
  });

  it('clamps all thresholds to a minimum of 1', () => {
    const zeroBaseDef: TechDef = {
      ...orbitalMechanicsDef,
      id: 'zeroBase',
      baseRecipe: { physics: 1 },
      recipeVariance: 1.0, // maximum variance
    };
    const recipes = generateTechRecipes([zeroBaseDef], createRng('clamp-test'));
    expect(recipes.get('zeroBase')!.physics).toBeGreaterThanOrEqual(1);
  });

  it('only includes fields listed in baseRecipe', () => {
    const rng = createRng('fields-test');
    const recipes = generateTechRecipes([orbitalMechanicsDef], rng);
    const recipe = recipes.get('orbitalMechanics')!;
    expect(Object.keys(recipe)).toEqual(
      expect.arrayContaining(['physics', 'mathematics', 'engineering']),
    );
    expect(Object.keys(recipe)).not.toContain('biochemistry');
    expect(Object.keys(recipe)).not.toContain('computing');
  });
});

// ---------------------------------------------------------------------------
// initialiseTechs
// ---------------------------------------------------------------------------

describe('initialiseTechs', () => {
  it('creates a TechState for every def', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    expect(techs).toHaveLength(allDefs.length);
  });

  it('initialises all techs to unknown stage', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    for (const tech of techs) {
      expect(tech.stage).toBe('unknown');
    }
  });

  it('pre-generates all recipes (none are null)', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    for (const tech of techs) {
      expect(tech.recipe).not.toBeNull();
    }
  });

  it('sets discoveredTurn to null for all techs', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    for (const tech of techs) {
      expect(tech.discoveredTurn).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// getDiscoveryStage — standard tech (requiresSimultaneous: false)
// ---------------------------------------------------------------------------

describe('getDiscoveryStage (standard tech)', () => {
  // Recipe: physics 40, mathematics 30, engineering 20
  const recipe = { physics: 40, mathematics: 30, engineering: 20 };

  it('returns unknown when fields are well below threshold', () => {
    const fields = makeFields({ physics: 1, mathematics: 1 });
    expect(getDiscoveryStage(fields, recipe, false)).toBe('unknown');
  });

  it('returns rumour when any field reaches 30% of its threshold', () => {
    // 30% of physics threshold (40) = 12
    const fields = makeFields({ physics: 12 });
    expect(getDiscoveryStage(fields, recipe, false)).toBe('rumour');
  });

  it('returns progress when all fields reach 60% of their thresholds', () => {
    // 60%: physics 24, mathematics 18, engineering 12
    const fields = makeFields({ physics: 24, mathematics: 18, engineering: 12 });
    expect(getDiscoveryStage(fields, recipe, false)).toBe('progress');
  });

  it('does not return progress if only some fields hit 60%', () => {
    const fields = makeFields({ physics: 40, mathematics: 30, engineering: 5 }); // engineering short
    expect(getDiscoveryStage(fields, recipe, false)).not.toBe('progress');
  });

  it('returns discovered when all fields meet 100% threshold', () => {
    const fields = makeFields({ physics: 40, mathematics: 30, engineering: 20 });
    expect(getDiscoveryStage(fields, recipe, false)).toBe('discovered');
  });

  it('returns discovered when fields exceed 100% threshold', () => {
    const fields = makeFields({ physics: 100, mathematics: 100, engineering: 100 });
    expect(getDiscoveryStage(fields, recipe, false)).toBe('discovered');
  });

  it('returns discovered for an empty recipe', () => {
    expect(getDiscoveryStage(makeFields(), {}, false)).toBe('discovered');
  });
});

// ---------------------------------------------------------------------------
// getDiscoveryStage — cross-field breakthrough (requiresSimultaneous: true)
// ---------------------------------------------------------------------------

describe('getDiscoveryStage (simultaneous breakthrough)', () => {
  // Recipe: physics 60, mathematics 60
  const recipe = { physics: 60, mathematics: 60 };

  it('returns unknown when only one field is above 30%', () => {
    // physics at 40% but mathematics at 0 — breakthrough requires BOTH
    const fields = makeFields({ physics: 24 });
    expect(getDiscoveryStage(fields, recipe, true)).toBe('unknown');
  });

  it('returns rumour only when ALL fields reach 30%', () => {
    const fields = makeFields({ physics: 18, mathematics: 18 }); // both at 30%
    expect(getDiscoveryStage(fields, recipe, true)).toBe('rumour');
  });

  it('contrast: standard tech would give rumour from single field at 30%', () => {
    const fields = makeFields({ physics: 18 }); // only physics at 30%
    expect(getDiscoveryStage(fields, recipe, false)).toBe('rumour'); // standard: yes
    expect(getDiscoveryStage(fields, recipe, true)).toBe('unknown'); // simultaneous: no
  });
});

// ---------------------------------------------------------------------------
// checkResearchProgress
// ---------------------------------------------------------------------------

describe('checkResearchProgress', () => {
  function makeTechState(defId: string, recipe: Record<string, number>): TechState {
    return { defId, stage: 'unknown', recipe, discoveredTurn: null };
  }

  it('returns unchanged techs when fields are too low', () => {
    const techs = [makeTechState('orbitalMechanics', { physics: 40, mathematics: 30 })];
    const result = checkResearchProgress(techs, defsMap, makeFields(), 1);
    expect(result.updatedTechs[0].stage).toBe('unknown');
    expect(result.newDiscoveries).toHaveLength(0);
    expect(result.newRumours).toHaveLength(0);
  });

  it('advances to rumour when any field crosses 30%', () => {
    const techs = [makeTechState('orbitalMechanics', { physics: 40, mathematics: 30 })];
    const fields = makeFields({ physics: 12 }); // 30% of 40
    const result = checkResearchProgress(techs, defsMap, fields, 5);
    expect(result.updatedTechs[0].stage).toBe('rumour');
    expect(result.newRumours).toContain('orbitalMechanics');
  });

  it('advances directly to progress if fields already meet 60%', () => {
    const techs = [makeTechState('orbitalMechanics', { physics: 40, mathematics: 30 })];
    const fields = makeFields({ physics: 30, mathematics: 25 }); // both above 60%
    const result = checkResearchProgress(techs, defsMap, fields, 5);
    expect(result.updatedTechs[0].stage).toBe('progress');
    expect(result.newProgressTechs).toContain('orbitalMechanics');
  });

  it('advances to discovered and records the turn', () => {
    const techs = [makeTechState('orbitalMechanics', { physics: 40, mathematics: 30 })];
    const fields = makeFields({ physics: 40, mathematics: 30 });
    const result = checkResearchProgress(techs, defsMap, fields, 12);
    expect(result.updatedTechs[0].stage).toBe('discovered');
    expect(result.updatedTechs[0].discoveredTurn).toBe(12);
    expect(result.newDiscoveries).toContain('orbitalMechanics');
  });

  it('does not re-advance already-discovered techs', () => {
    const discovered: TechState = {
      defId: 'orbitalMechanics',
      stage: 'discovered',
      recipe: { physics: 40 },
      discoveredTurn: 5,
    };
    const result = checkResearchProgress([discovered], defsMap, makeFields({ physics: 100 }), 10);
    expect(result.updatedTechs[0].discoveredTurn).toBe(5); // unchanged
    expect(result.newDiscoveries).toHaveLength(0);
  });

  it('handles multiple techs advancing in the same turn', () => {
    const techs = [
      makeTechState('orbitalMechanics', { physics: 40, mathematics: 30 }),
      makeTechState('lifeSupport', { biochemistry: 50, engineering: 35 }),
    ];
    const fields = makeFields({ physics: 40, mathematics: 30, biochemistry: 50, engineering: 35 });
    const result = checkResearchProgress(techs, defsMap, fields, 8);
    expect(result.newDiscoveries).toHaveLength(2);
  });

  it('skips techs with null recipe', () => {
    const tech: TechState = {
      defId: 'orbitalMechanics',
      stage: 'unknown',
      recipe: null,
      discoveredTurn: null,
    };
    const result = checkResearchProgress([tech], defsMap, makeFields({ physics: 100 }), 1);
    expect(result.updatedTechs[0].stage).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// signalEraStrength gate for signal-derived techs
// ---------------------------------------------------------------------------

describe('checkResearchProgress — signalDerived gate', () => {
  const signalDerivedDef: TechDef = {
    id: 'signalPattern',
    name: 'Signal Pattern Analysis',
    rumourText: 'The transmission is not random.',
    baseRecipe: { computing: 50, physics: 40 },
    recipeVariance: 0.0,
    requiresSimultaneous: true,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: true,
  };

  const signalDerivedMap = new Map([['signalPattern', signalDerivedDef]]);

  const richFields = makeFields({ computing: 100, physics: 100 });

  function makeSignalTech(stage: TechState['stage'] = 'unknown'): TechState {
    return {
      defId: 'signalPattern',
      stage,
      recipe: { computing: 50, physics: 40 },
      discoveredTurn: null,
    };
  }

  it('keeps signal-derived tech unknown when signal is faint, even if fields meet threshold', () => {
    const result = checkResearchProgress(
      [makeSignalTech()],
      signalDerivedMap,
      richFields,
      5,
      'faint',
    );
    expect(result.updatedTechs[0].stage).toBe('unknown');
    expect(result.newRumours).toHaveLength(0);
  });

  it('promotes signal-derived tech once signal reaches structured', () => {
    const result = checkResearchProgress(
      [makeSignalTech()],
      signalDerivedMap,
      richFields,
      5,
      'structured',
    );
    expect(result.updatedTechs[0].stage).toBe('discovered');
    expect(result.newDiscoveries).toContain('signalPattern');
  });

  it('promotes signal-derived tech when signal is urgent', () => {
    const result = checkResearchProgress(
      [makeSignalTech()],
      signalDerivedMap,
      richFields,
      5,
      'urgent',
    );
    expect(result.updatedTechs[0].stage).toBe('discovered');
  });

  it('default signalEraStrength is faint — preserves backwards compatibility', () => {
    // Called without the fifth argument (as existing tests do)
    const result = checkResearchProgress([makeSignalTech()], signalDerivedMap, richFields, 5);
    expect(result.updatedTechs[0].stage).toBe('unknown');
  });

  it('non-signal-derived techs are unaffected by signal strength parameter', () => {
    const tech: TechState = {
      defId: 'orbitalMechanics',
      stage: 'unknown',
      recipe: { physics: 40, mathematics: 30, engineering: 20 },
      discoveredTurn: null,
    };
    const fields = makeFields({ physics: 40, mathematics: 30, engineering: 20 });
    const result = checkResearchProgress([tech], defsMap, fields, 5, 'faint');
    expect(result.updatedTechs[0].stage).toBe('discovered');
  });
});
