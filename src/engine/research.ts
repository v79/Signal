import type {
  TechDef,
  TechState,
  TechRecipe,
  TechDiscoveryStage,
  FieldPoints,
  SignalEraStrength,
  Era,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Named constants
// ---------------------------------------------------------------------------

const ERA_ORDER: Record<Era, number> = { earth: 0, nearSpace: 1, deepSpace: 2 };

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
 *
 * @param preDiscoverEra - If provided, all techs belonging to this era are
 *   immediately set to 'discovered' (discoveredTurn: 0). Used for dev starts
 *   that skip earlier eras.
 */
export function initialiseTechs(techDefs: TechDef[], rng: Rng, preDiscoverEra?: Era): TechState[] {
  const recipes = generateTechRecipes(techDefs, rng);
  return techDefs.map((def) => {
    const techEra: Era = def.era ?? 'earth';
    const preDiscover = preDiscoverEra !== undefined && techEra === preDiscoverEra;
    return {
      defId: def.id,
      stage: (preDiscover ? 'discovered' : 'unknown') as TechDiscoveryStage,
      recipe: recipes.get(def.id) ?? null,
      fieldProgress: {},
      unlockedByBreakthrough: false,
      discoveredTurn: preDiscover ? 0 : null,
    };
  });
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
    return t?.stage === 'discovered';
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
  currentEra: Era = 'earth',
): TechState[] {
  // Applicable: rumour or progress, still needs at least one field,
  // and must belong to the current era or earlier (never a future era).
  function needsField(tech: TechState, field: keyof FieldPoints, pm: Map<string, TechRecipe>): boolean {
    const threshold = tech.recipe![field];
    if (!threshold) return false;
    return (pm.get(tech.defId)![field] ?? 0) < threshold;
  }

  function isApplicable(tech: TechState): boolean {
    if (tech.stage !== 'rumour' && tech.stage !== 'progress') return false;
    if (!tech.recipe) return false;
    const def = techDefs.get(tech.defId);
    if (def?.era !== undefined && ERA_ORDER[def.era] > ERA_ORDER[currentEra]) return false;
    const entries = Object.entries(tech.recipe) as [keyof FieldPoints, number][];
    return entries.some(([f, t]) => (tech.fieldProgress[f] ?? 0) < t);
  }

  const progressTechs = techs.filter((t) => t.stage === 'progress' && isApplicable(t));
  const rumourTechs   = techs.filter((t) => t.stage === 'rumour'   && isApplicable(t));

  if (progressTechs.length === 0 && rumourTechs.length === 0) return techs;

  // Mutable copies of field output and fieldProgress per tech
  const remaining: Partial<FieldPoints> = { ...fieldOutput };
  const progressMap = new Map<string, TechRecipe>();
  for (const tech of [...progressTechs, ...rumourTechs]) {
    progressMap.set(tech.defId, { ...tech.fieldProgress });
  }

  // Step 2: guaranteed minimums — progress techs first, then rumour techs.
  // This ensures an in-progress tech that is blocked on a low-income field
  // always receives its minimum allocation before rumour techs consume it.
  for (const field of Object.keys(fieldOutput) as (keyof FieldPoints)[]) {
    let rem = remaining[field] ?? 0;
    if (rem <= 0) continue;
    for (const tech of [...progressTechs, ...rumourTechs]) {
      if (rem <= 0) break;
      if (!needsField(tech, field, progressMap)) continue;
      const give = Math.min(MIN_POINTS_PER_TECH_PER_FIELD, rem);
      progressMap.get(tech.defId)![field] = (progressMap.get(tech.defId)![field] ?? 0) + give;
      rem -= give;
    }
    remaining[field] = rem;
  }

  // Step 3: distribute remaining — prefer progress techs over rumour techs.
  // Remainder for a field is spread evenly across all eligible techs in the
  // higher-priority pool (progress if any remain eligible, else rumour),
  // with any integer rounding leftover given to a random tech in the pool.
  for (const field of Object.keys(fieldOutput) as (keyof FieldPoints)[]) {
    const rem = remaining[field] ?? 0;
    if (rem <= 0) continue;
    const eligibleProgress = progressTechs.filter((t) => needsField(t, field, progressMap));
    const eligibleRumour   = rumourTechs.filter((t) => needsField(t, field, progressMap));
    const pool = eligibleProgress.length > 0 ? eligibleProgress : eligibleRumour;
    if (pool.length === 0) continue; // discard remainder
    const share = Math.floor(rem / pool.length);
    const leftover = rem - share * pool.length;
    for (const tech of pool) {
      progressMap.get(tech.defId)![field] = (progressMap.get(tech.defId)![field] ?? 0) + share;
    }
    if (leftover > 0) {
      const lucky = pool[Math.floor(rng.nextFloat(0, 1) * pool.length)];
      progressMap.get(lucky.defId)![field] = (progressMap.get(lucky.defId)![field] ?? 0) + leftover;
    }
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
