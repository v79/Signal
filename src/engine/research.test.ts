import { describe, it, expect } from 'vitest';
import {
  generateTechRecipes,
  initialiseTechs,
  prerequisitesMet,
  getDiscoveryStage,
  distributeResearchPoints,
  applyStageTransitions,
  checkBreakthroughConditions,
  MIN_POINTS_PER_TECH_PER_FIELD,
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
  tier: 1,
  requiredTechIds: [],
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
  tier: 1,
  requiredTechIds: [],
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
  tier: 2,
  requiredTechIds: ['orbitalMechanics'],
};

// Tech with no prerequisites (Tier 1)
const tier1TechDef: TechDef = {
  id: 'basicResearch',
  name: 'Basic Research',
  rumourText: 'Basic investigations are underway.',
  baseRecipe: { physics: 10 },
  recipeVariance: 0.0,
  requiresSimultaneous: false,
  unlocksCards: [],
  unlocksProjects: [],
  unlocksFacilities: [],
  signalDerived: false,
  tier: 1,
  requiredTechIds: [],
};

const allDefs = [orbitalMechanicsDef, lifeSupport, signalResonanceDef];
const defsMap = new Map(allDefs.map((d) => [d.id, d]));

function makeFields(overrides: Partial<FieldPoints> = {}): FieldPoints {
  return { ...ZERO_FIELDS, ...overrides };
}

function makeTechState(
  defId: string,
  recipe: Record<string, number>,
  stage: TechState['stage'] = 'unknown',
  fieldProgress: Record<string, number> = {},
): TechState {
  return {
    defId,
    stage,
    recipe,
    fieldProgress,
    unlockedByBreakthrough: false,
    discoveredTurn: null,
  };
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

  it('initialises fieldProgress to {} for all techs', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    for (const tech of techs) {
      expect(tech.fieldProgress).toEqual({});
    }
  });

  it('initialises unlockedByBreakthrough to false for all techs', () => {
    const techs = initialiseTechs(allDefs, createRng('init'));
    for (const tech of techs) {
      expect(tech.unlockedByBreakthrough).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// prerequisitesMet
// ---------------------------------------------------------------------------

describe('prerequisitesMet', () => {
  const prereqDef: TechDef = {
    ...orbitalMechanicsDef,
    id: 'advanced',
    requiredTechIds: ['orbitalMechanics', 'lifeSupport'],
  };

  const orbitalDiscovered: TechState = {
    ...makeTechState('orbitalMechanics', { physics: 40 }, 'discovered'),
  };
  const lifeSupportProgress: TechState = {
    ...makeTechState('lifeSupport', { biochemistry: 50 }, 'progress'),
  };
  const lifeSupportRumour: TechState = {
    ...makeTechState('lifeSupport', { biochemistry: 50 }, 'rumour'),
  };
  const lifeSupportUnknown: TechState = {
    ...makeTechState('lifeSupport', { biochemistry: 50 }, 'unknown'),
  };

  it('returns true for Tier 1 tech with empty requiredTechIds', () => {
    const allTechs: TechState[] = [];
    expect(prerequisitesMet(tier1TechDef, allTechs)).toBe(true);
  });

  it('returns false when all prerequisites are at progress (not yet discovered)', () => {
    const allTechs = [
      makeTechState('orbitalMechanics', { physics: 40 }, 'progress'),
      lifeSupportProgress,
    ];
    expect(prerequisitesMet(prereqDef, allTechs)).toBe(false);
  });

  it('returns true when all prerequisites are at discovered', () => {
    const allTechs = [orbitalDiscovered, makeTechState('lifeSupport', { biochemistry: 50 }, 'discovered')];
    expect(prerequisitesMet(prereqDef, allTechs)).toBe(true);
  });

  it('returns false when a prerequisite is at rumour', () => {
    const allTechs = [orbitalDiscovered, lifeSupportRumour];
    expect(prerequisitesMet(prereqDef, allTechs)).toBe(false);
  });

  it('returns false when a prerequisite is unknown', () => {
    const allTechs = [orbitalDiscovered, lifeSupportUnknown];
    expect(prerequisitesMet(prereqDef, allTechs)).toBe(false);
  });

  it('returns false when a prerequisite is missing from allTechs', () => {
    const allTechs = [orbitalDiscovered]; // lifeSupport missing
    expect(prerequisitesMet(prereqDef, allTechs)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDiscoveryStage (new signature)
// ---------------------------------------------------------------------------

describe('getDiscoveryStage', () => {
  const tier1Def = orbitalMechanicsDef; // requiredTechIds: []

  const tier2Def: TechDef = {
    ...signalResonanceDef,
    requiredTechIds: ['orbitalMechanics'],
  };

  it('unknown → stays unknown when no prerequisites met', () => {
    const tech = makeTechState('signalResonance', { physics: 60, mathematics: 60 }, 'unknown');
    const prereqTech = makeTechState('orbitalMechanics', { physics: 40 }, 'unknown');
    const allTechs = [tech, prereqTech];
    const techDefsMap = new Map([['signalResonance', tier2Def], ['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier2Def, allTechs, techDefsMap)).toBe('unknown');
  });

  it('unknown → rumour when prerequisites met (Tier 2)', () => {
    const tech = makeTechState('signalResonance', { physics: 60, mathematics: 60 }, 'unknown');
    const prereqTech = makeTechState('orbitalMechanics', { physics: 40 }, 'discovered');
    const allTechs = [tech, prereqTech];
    const techDefsMap = new Map([['signalResonance', tier2Def], ['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier2Def, allTechs, techDefsMap)).toBe('rumour');
  });

  it('unknown → rumour when Tier 1 (no prerequisites)', () => {
    const tech = makeTechState('orbitalMechanics', { physics: 40 }, 'unknown');
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('rumour');
  });

  it('rumour → stays rumour when fieldProgress too low', () => {
    // recipe: physics 40, mathematics 30, engineering 20
    // allAt33: need all >= 33% — physics:13.2, math:9.9, eng:6.6
    // partial: need 1 field (ceil(3*0.33)=1) at 50% — physics:20, etc.
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'rumour',
      { physics: 5 }, // very low progress
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('rumour');
  });

  it('rumour → progress when allAt33 threshold met', () => {
    // all fields at >= 33% of their thresholds
    // physics >= 0.33*40=13.2, math >= 0.33*30=9.9, eng >= 0.33*20=6.6
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'rumour',
      { physics: 14, mathematics: 10, engineering: 7 },
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('progress');
  });

  it('rumour → progress when partial threshold met (≥ 50% on 1/3 of fields)', () => {
    // 1 field (ceil(3*0.33)=1) at >= 50%: physics >= 0.5*40=20
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'rumour',
      { physics: 20, mathematics: 0, engineering: 0 },
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('progress');
  });

  it('rumour → discovered directly if fieldProgress meets 100%', () => {
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'rumour',
      { physics: 40, mathematics: 30, engineering: 20 },
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('discovered');
  });

  it('progress → stays progress if fieldProgress not at 100%', () => {
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'progress',
      { physics: 39, mathematics: 30, engineering: 20 },
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('progress');
  });

  it('progress → discovered when fieldProgress meets 100%', () => {
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'progress',
      { physics: 40, mathematics: 30, engineering: 20 },
    );
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('discovered');
  });

  it('discovered → stays discovered always', () => {
    const tech: TechState = {
      defId: 'orbitalMechanics',
      stage: 'discovered',
      recipe: { physics: 40 },
      fieldProgress: {},
      unlockedByBreakthrough: false,
      discoveredTurn: 5,
    };
    const allTechs = [tech];
    const techDefsMap = new Map([['orbitalMechanics', tier1Def]]);
    expect(getDiscoveryStage(tech, tier1Def, allTechs, techDefsMap)).toBe('discovered');
  });
});

// ---------------------------------------------------------------------------
// distributeResearchPoints
// ---------------------------------------------------------------------------

describe('distributeResearchPoints', () => {
  const techA: TechDef = {
    ...tier1TechDef,
    id: 'techA',
    baseRecipe: { physics: 10, computing: 8 },
    requiredTechIds: [],
  };
  const techB: TechDef = {
    ...tier1TechDef,
    id: 'techB',
    baseRecipe: { physics: 10 },
    requiredTechIds: [],
  };
  const techDefsMap = new Map([['techA', techA], ['techB', techB]]);

  it('distributes guaranteed minimum to each applicable tech per field', () => {
    const techs = [
      makeTechState('techA', { physics: 10, computing: 8 }, 'rumour'),
      makeTechState('techB', { physics: 10 }, 'rumour'),
    ];
    const fieldOutput = makeFields({ physics: 5 });
    const rng = createRng('test');
    const result = distributeResearchPoints(techs, techDefsMap, fieldOutput, rng, 'earth');
    // Both techA and techB are applicable for physics
    const a = result.find((t) => t.defId === 'techA')!;
    const b = result.find((t) => t.defId === 'techB')!;
    // Each should have received at least MIN_POINTS_PER_TECH_PER_FIELD
    expect(a.fieldProgress['physics'] ?? 0).toBeGreaterThanOrEqual(MIN_POINTS_PER_TECH_PER_FIELD);
    expect(b.fieldProgress['physics'] ?? 0).toBeGreaterThanOrEqual(MIN_POINTS_PER_TECH_PER_FIELD);
  });

  it('remainder is fully distributed across eligible techs', () => {
    const techs = [
      makeTechState('techA', { physics: 100 }, 'rumour'),
      makeTechState('techB', { physics: 100 }, 'rumour'),
    ];
    const fieldOutput = makeFields({ physics: 20 });
    const rng = createRng('remainder-test');
    const result = distributeResearchPoints(techs, techDefsMap, fieldOutput, rng, 'earth');
    const totalPhysics = result.reduce((sum, t) => sum + (t.fieldProgress['physics'] ?? 0), 0);
    // All 20 points should be distributed (2 guaranteed + 18 remainder)
    expect(totalPhysics).toBe(20);
  });

  it('points discarded when no eligible tech needs a field', () => {
    // Both techs have physics already at threshold
    const techs = [
      makeTechState('techA', { physics: 10 }, 'rumour', { physics: 10 }),
      makeTechState('techB', { physics: 10 }, 'rumour', { physics: 10 }),
    ];
    const fieldOutput = makeFields({ physics: 5 });
    const rng = createRng('discard-test');
    const result = distributeResearchPoints(techs, techDefsMap, fieldOutput, rng, 'earth');
    // physics already met — no new points
    expect(result.find((t) => t.defId === 'techA')!.fieldProgress['physics']).toBe(10);
    expect(result.find((t) => t.defId === 'techB')!.fieldProgress['physics']).toBe(10);
  });

  it('unknown techs receive no points', () => {
    const techs = [
      makeTechState('techA', { physics: 10 }, 'unknown'),
      makeTechState('techB', { physics: 10 }, 'rumour'),
    ];
    const fieldOutput = makeFields({ physics: 5 });
    const rng = createRng('unknown-test');
    const result = distributeResearchPoints(techs, techDefsMap, fieldOutput, rng, 'earth');
    const a = result.find((t) => t.defId === 'techA')!;
    // techA is unknown — should not receive points
    expect(a.fieldProgress['physics'] ?? 0).toBe(0);
  });

  it('already-met fields receive no points', () => {
    const techs = [
      makeTechState('techA', { physics: 10, computing: 8 }, 'rumour', { physics: 10, computing: 0 }),
    ];
    const fieldOutput = makeFields({ physics: 5 });
    const rng = createRng('met-fields-test');
    const result = distributeResearchPoints(techs, new Map([['techA', techA]]), fieldOutput, rng, 'earth');
    const a = result.find((t) => t.defId === 'techA')!;
    // physics already met — no more physics points
    expect(a.fieldProgress['physics']).toBe(10);
  });

  it('future-era techs receive no points', () => {
    const era2Tech: TechDef = { ...tier1TechDef, id: 'era2Tech', era: 'nearSpace' };
    const era1Tech: TechDef = { ...tier1TechDef, id: 'era1Tech' };
    const defs = new Map([['era2Tech', era2Tech], ['era1Tech', era1Tech]]);
    const techs = [
      makeTechState('era2Tech', { physics: 100 }, 'rumour'),
      makeTechState('era1Tech', { physics: 100 }, 'rumour'),
    ];
    const fieldOutput = makeFields({ physics: 20 });
    const rng = createRng('era-gate-test');
    const result = distributeResearchPoints(techs, defs, fieldOutput, rng, 'earth');
    // Era 2 tech should receive no points while current era is earth
    expect(result.find((t) => t.defId === 'era2Tech')!.fieldProgress['physics'] ?? 0).toBe(0);
    // All points go to the Era 1 tech
    expect(result.find((t) => t.defId === 'era1Tech')!.fieldProgress['physics'] ?? 0).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// applyStageTransitions
// ---------------------------------------------------------------------------

describe('applyStageTransitions', () => {
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
    tier: 3,
    requiredTechIds: [],
  };

  const signalDerivedMap = new Map([['signalPattern', signalDerivedDef]]);

  function makeSignalTech(stage: TechState['stage'] = 'unknown'): TechState {
    return {
      defId: 'signalPattern',
      stage,
      recipe: { computing: 50, physics: 40 },
      fieldProgress: stage === 'discovered' ? { computing: 50, physics: 40 } : {},
      unlockedByBreakthrough: false,
      discoveredTurn: null,
    };
  }

  it('signal-derived tech stays unknown when signal is faint, even if prerequisites met', () => {
    const tech = { ...makeSignalTech('unknown') };
    const result = applyStageTransitions([tech], signalDerivedMap, 5, 'faint');
    expect(result.updatedTechs[0].stage).toBe('unknown');
    expect(result.newRumours).toHaveLength(0);
  });

  it('signal-derived tech advances when signal is structured', () => {
    // signalDerivedDef has requiredTechIds: [] so prerequisites are always met
    const tech = makeSignalTech('unknown');
    const result = applyStageTransitions([tech], signalDerivedMap, 5, 'structured');
    // Should advance from unknown to rumour (prerequisites empty, so met)
    expect(result.updatedTechs[0].stage).not.toBe('unknown');
    expect(result.newRumours).toContain('signalPattern');
  });

  it('non-regression: stage never decreases', () => {
    const tech = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'progress',
      { physics: 5 }, // low progress — not enough to stay at progress normally, but no regress
    );
    const defs = new Map([['orbitalMechanics', orbitalMechanicsDef]]);
    const result = applyStageTransitions([tech], defs, 5);
    // Should not regress from progress
    expect(result.updatedTechs[0].stage).not.toBe('rumour');
    expect(result.updatedTechs[0].stage).not.toBe('unknown');
  });

  it('multiple techs can transition in same call', () => {
    const techA = makeTechState(
      'orbitalMechanics',
      { physics: 40, mathematics: 30, engineering: 20 },
      'rumour',
      { physics: 40, mathematics: 30, engineering: 20 },
    );
    const techB = makeTechState(
      'lifeSupport',
      { biochemistry: 50, engineering: 35, computing: 20 },
      'rumour',
      { biochemistry: 50, engineering: 35, computing: 20 },
    );
    const defs = new Map([
      ['orbitalMechanics', orbitalMechanicsDef],
      ['lifeSupport', lifeSupport],
    ]);
    const result = applyStageTransitions([techA, techB], defs, 8);
    expect(result.newDiscoveries).toHaveLength(2);
    expect(result.newDiscoveries).toContain('orbitalMechanics');
    expect(result.newDiscoveries).toContain('lifeSupport');
  });
});

// ---------------------------------------------------------------------------
// checkBreakthroughConditions
// ---------------------------------------------------------------------------

describe('checkBreakthroughConditions', () => {
  const breakthroughDef: TechDef = {
    id: 'quantumComputing',
    name: 'Quantum Computing',
    rumourText: 'Something unusual is happening in the lab.',
    baseRecipe: { computing: 200 },
    recipeVariance: 0.1,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
    tier: 3,
    requiredTechIds: ['orbitalMechanics', 'lifeSupport'], // normally requires these
    breakthroughCondition: {
      fieldOutputThresholds: { physics: 20, computing: 15 },
      facilityDefIds: ['dataCentre'],
      facilityCount: 2,
    },
  };

  const techDefsMap = new Map([['quantumComputing', breakthroughDef]]);

  const richFields = makeFields({ physics: 25, computing: 20 });
  const activeFacilities = ['dataCentre', 'researchLab'];

  it('fires when field output thresholds met and required facilities present', () => {
    const tech = makeTechState('quantumComputing', { computing: 200 }, 'unknown');
    const results = checkBreakthroughConditions([tech], techDefsMap, richFields, activeFacilities);
    expect(results).toHaveLength(1);
    expect(results[0].techId).toBe('quantumComputing');
  });

  it('does not fire on non-unknown techs', () => {
    const tech = makeTechState('quantumComputing', { computing: 200 }, 'rumour');
    const results = checkBreakthroughConditions([tech], techDefsMap, richFields, activeFacilities);
    expect(results).toHaveLength(0);
  });

  it('does not fire when field output below threshold', () => {
    const tech = makeTechState('quantumComputing', { computing: 200 }, 'unknown');
    const lowFields = makeFields({ physics: 5, computing: 20 }); // physics too low
    const results = checkBreakthroughConditions([tech], techDefsMap, lowFields, activeFacilities);
    expect(results).toHaveLength(0);
  });

  it('does not fire when required facility not active', () => {
    const tech = makeTechState('quantumComputing', { computing: 200 }, 'unknown');
    const noDataCentre = ['researchLab', 'observatory'];
    const results = checkBreakthroughConditions([tech], techDefsMap, richFields, noDataCentre);
    expect(results).toHaveLength(0);
  });

  it('does not fire when facility count is below minimum', () => {
    const tech = makeTechState('quantumComputing', { computing: 200 }, 'unknown');
    const oneFacility = ['dataCentre']; // only 1, need 2
    const results = checkBreakthroughConditions([tech], techDefsMap, richFields, oneFacility);
    expect(results).toHaveLength(0);
  });

  it('fires when tech has no facilityDefIds requirement (only field thresholds)', () => {
    const simpleBreakthroughDef: TechDef = {
      ...breakthroughDef,
      id: 'simpleBreakthrough',
      breakthroughCondition: {
        fieldOutputThresholds: { physics: 20 },
      },
    };
    const techDefsMap2 = new Map([['simpleBreakthrough', simpleBreakthroughDef]]);
    const tech = makeTechState('simpleBreakthrough', { computing: 200 }, 'unknown');
    const results = checkBreakthroughConditions([tech], techDefsMap2, richFields, []);
    expect(results).toHaveLength(1);
  });
});
