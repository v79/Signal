import type {
  TechDef,
  TechState,
  TechRecipe,
  TechDiscoveryStage,
  FieldPoints,
  SignalEraStrength,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Named constants
// ---------------------------------------------------------------------------

// Minimum field points guaranteed to each applicable tech per field per turn
export const MIN_POINTS_PER_TECH_PER_FIELD = 1;

// Rumour → Progress thresholds:
// Either ALL required fields reach PROGRESS_ALL_FRACTION of threshold,
// OR at least PROGRESS_PARTIAL_FIELD_FRACTION of fields reach PROGRESS_PARTIAL_FRACTION.
export const PROGRESS_ALL_FRACTION = 0.33;
export const PROGRESS_PARTIAL_FRACTION = 0.5;
export const PROGRESS_PARTIAL_FIELD_FRACTION = 0.33;

// ---------------------------------------------------------------------------
// Recipe generation
// ---------------------------------------------------------------------------

/**
 * Generate a randomised recipe for one tech from its base shape.
 *
 * Each field threshold is scaled by (1 + variance * rng.nextFloat(-1, 1)),
 * then clamped to a minimum of 1. Variance 0.2 gives ±20% swing.
 *
 * PRNG call order: for each tech (in the order techDefs is iterated),
 * one nextFloat(-1, 1) call per field listed in baseRecipe.
 * This order must remain stable — inserting tech defs changes the
 * downstream RNG sequence for all subsequent techs.
 */
export function generateTechRecipes(techDefs: TechDef[], rng: Rng): Map<string, TechRecipe> {
  const recipes = new Map<string, TechRecipe>();

  for (const def of techDefs) {
    const recipe: TechRecipe = {};
    for (const field of Object.keys(def.baseRecipe) as (keyof FieldPoints)[]) {
      const base = def.baseRecipe[field] ?? 0;
      const swing = def.recipeVariance * rng.nextFloat(-1, 1);
      recipe[field] = Math.max(1, Math.round(base * (1 + swing)));
    }
    recipes.set(def.id, recipe);
  }

  return recipes;
}

/**
 * Initialise TechState for all tech defs at game start.
 * Generates recipes immediately (stored internally; UI visibility is
 * controlled by stage) and sets all techs to 'unknown'.
 */
export function initialiseTechs(techDefs: TechDef[], rng: Rng): TechState[] {
  const recipes = generateTechRecipes(techDefs, rng);
  return techDefs.map((def) => ({
    defId: def.id,
    stage: 'unknown' as TechDiscoveryStage,
    recipe: recipes.get(def.id) ?? null,
    fieldProgress: {},
    unlockedByBreakthrough: false,
    discoveredTurn: null,
  }));
}

// ---------------------------------------------------------------------------
// Prerequisite check
// ---------------------------------------------------------------------------

export function prerequisitesMet(
  techDef: TechDef,
  allTechs: TechState[],
): boolean {
  if (techDef.requiredTechIds.length === 0) return true;
  return techDef.requiredTechIds.every((reqId) => {
    const t = allTechs.find((s) => s.defId === reqId);
    return t?.stage === 'progress' || t?.stage === 'discovered';
  });
}

// ---------------------------------------------------------------------------
// Discovery stage computation
// ---------------------------------------------------------------------------

/**
 * Determine which discovery stage a tech should be in given current
 * fieldProgress and prerequisites. Stages are computed fresh each call —
 * the caller is responsible for ensuring stages only advance (never regress).
 */
export function getDiscoveryStage(
  tech: TechState,
  def: TechDef,
  allTechs: TechState[],
  techDefs: Map<string, TechDef>,
): TechDiscoveryStage {
  switch (tech.stage) {
    case 'discovered':
      return 'discovered';

    case 'progress': {
      const recipe = tech.recipe;
      if (!recipe) return 'progress';
      const entries = Object.entries(recipe) as [keyof FieldPoints, number][];
      if (entries.every(([f, t]) => (tech.fieldProgress[f] ?? 0) >= t)) return 'discovered';
      return 'progress';
    }

    case 'rumour': {
      const recipe = tech.recipe;
      if (!recipe) return 'rumour';
      const entries = Object.entries(recipe) as [keyof FieldPoints, number][];
      // Check discovered first
      if (entries.every(([f, t]) => (tech.fieldProgress[f] ?? 0) >= t)) return 'discovered';
      // Check progress
      const allAt33 = entries.every(
        ([f, t]) => (tech.fieldProgress[f] ?? 0) >= t * PROGRESS_ALL_FRACTION,
      );
      const halfMetCount = entries.filter(
        ([f, t]) => (tech.fieldProgress[f] ?? 0) >= t * PROGRESS_PARTIAL_FRACTION,
      ).length;
      const thirdCount = Math.ceil(entries.length * PROGRESS_PARTIAL_FIELD_FRACTION);
      if (allAt33 || halfMetCount >= thirdCount) return 'progress';
      return 'rumour';
    }

    case 'unknown':
      if (prerequisitesMet(def, allTechs)) return 'rumour';
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Research point distribution
// ---------------------------------------------------------------------------

export function distributeResearchPoints(
  techs: TechState[],
  techDefs: Map<string, TechDef>,
  fieldOutput: FieldPoints,
  rng: Rng,
): TechState[] {
  // Applicable: rumour or progress, still needs at least one field
  const applicable = techs.filter((tech) => {
    if (tech.stage !== 'rumour' && tech.stage !== 'progress') return false;
    if (!tech.recipe) return false;
    const entries = Object.entries(tech.recipe) as [keyof FieldPoints, number][];
    return entries.some(([f, t]) => (tech.fieldProgress[f] ?? 0) < t);
  });

  if (applicable.length === 0) return techs;

  // Mutable copies of field output and fieldProgress per tech
  const remaining: Partial<FieldPoints> = { ...fieldOutput };
  const progressMap = new Map<string, TechRecipe>();
  for (const tech of applicable) {
    progressMap.set(tech.defId, { ...tech.fieldProgress });
  }

  // Step 2: guaranteed minimums — one pass per field, one point per applicable tech
  for (const field of Object.keys(fieldOutput) as (keyof FieldPoints)[]) {
    let rem = remaining[field] ?? 0;
    if (rem <= 0) continue;
    for (const tech of applicable) {
      if (rem <= 0) break;
      const threshold = tech.recipe![field];
      if (!threshold) continue;
      const progress = progressMap.get(tech.defId)!;
      if ((progress[field] ?? 0) >= threshold) continue;
      const give = Math.min(MIN_POINTS_PER_TECH_PER_FIELD, rem);
      progress[field] = (progress[field] ?? 0) + give;
      rem -= give;
    }
    remaining[field] = rem;
  }

  // Step 3: distribute remaining randomly — all remainder for each field goes to one random eligible tech
  for (const field of Object.keys(fieldOutput) as (keyof FieldPoints)[]) {
    const rem = remaining[field] ?? 0;
    if (rem <= 0) continue;
    const eligible = applicable.filter((tech) => {
      const threshold = tech.recipe![field];
      if (!threshold) return false;
      const progress = progressMap.get(tech.defId)!;
      return (progress[field] ?? 0) < threshold;
    });
    if (eligible.length === 0) continue; // discard remainder
    const idx = Math.floor(rng.nextFloat(0, 1) * eligible.length);
    const chosen = eligible[idx];
    const progress = progressMap.get(chosen.defId)!;
    progress[field] = (progress[field] ?? 0) + rem;
    remaining[field] = 0;
  }

  // Return updated TechState[] — only modify applicable techs
  return techs.map((tech) => {
    const newProgress = progressMap.get(tech.defId);
    if (!newProgress) return tech;
    return { ...tech, fieldProgress: newProgress };
  });
}

// ---------------------------------------------------------------------------
// Breakthrough conditions
// ---------------------------------------------------------------------------

export interface BreakthroughResult {
  techId: string;
}

export function checkBreakthroughConditions(
  techs: TechState[],
  techDefs: Map<string, TechDef>,
  fieldOutput: FieldPoints,
  activeFacilityDefIds: string[],
): BreakthroughResult[] {
  const results: BreakthroughResult[] = [];

  for (const tech of techs) {
    if (tech.stage !== 'unknown') continue;
    const def = techDefs.get(tech.defId);
    if (!def?.breakthroughCondition) continue;

    const cond = def.breakthroughCondition;

    // Check field output thresholds
    const fieldsMet = (
      Object.entries(cond.fieldOutputThresholds) as [keyof FieldPoints, number][]
    ).every(([f, threshold]) => fieldOutput[f] >= threshold);
    if (!fieldsMet) continue;

    // Check required facility types (at least one of each must be active)
    if (cond.facilityDefIds && cond.facilityDefIds.length > 0) {
      const facilitiesMet = cond.facilityDefIds.every((defId) =>
        activeFacilityDefIds.includes(defId),
      );
      if (!facilitiesMet) continue;
    }

    // Check total facility count
    if (cond.facilityCount !== undefined && activeFacilityDefIds.length < cond.facilityCount) {
      continue;
    }

    results.push({ techId: tech.defId });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stage transitions
// ---------------------------------------------------------------------------

export interface ResearchProgressResult {
  updatedTechs: TechState[];
  /** Def IDs of techs that moved to 'discovered' this turn. */
  newDiscoveries: string[];
  /** Def IDs of techs that moved to 'rumour' this turn. */
  newRumours: string[];
  /** Def IDs of techs that moved to 'progress' this turn. */
  newProgressTechs: string[];
}

const STAGE_ORDER: TechDiscoveryStage[] = ['unknown', 'rumour', 'progress', 'discovered'];

export function applyStageTransitions(
  techs: TechState[],
  techDefs: Map<string, TechDef>,
  turn: number,
  signalEraStrength: SignalEraStrength = 'faint',
): ResearchProgressResult {
  const newDiscoveries: string[] = [];
  const newRumours: string[] = [];
  const newProgressTechs: string[] = [];

  const updatedTechs = techs.map((tech) => {
    if (tech.stage === 'discovered') return tech;

    const def = techDefs.get(tech.defId);
    if (!def) return tech;

    // Signal-derived techs locked until signal is structured
    if (def.signalDerived && signalEraStrength === 'faint') return tech;

    const newStage = getDiscoveryStage(tech, def, techs, techDefs);

    // Only advance, never regress
    if (STAGE_ORDER.indexOf(newStage) <= STAGE_ORDER.indexOf(tech.stage)) return tech;

    if (newStage === 'discovered') newDiscoveries.push(tech.defId);
    else if (newStage === 'progress') newProgressTechs.push(tech.defId);
    else if (newStage === 'rumour') newRumours.push(tech.defId);

    return {
      ...tech,
      stage: newStage,
      discoveredTurn: newStage === 'discovered' ? turn : tech.discoveredTurn,
    };
  });

  return { updatedTechs, newDiscoveries, newRumours, newProgressTechs };
}
