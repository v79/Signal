import type { TechDef, TechState, TechRecipe, TechDiscoveryStage, FieldPoints } from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Stage transition thresholds
//
// These fractions of the recipe threshold determine when a tech moves
// between discovery stages.
//
// For standard techs (requiresSimultaneous: false):
//   - Rumour:    ANY required field >= 30% of its threshold
//   - Progress:  ALL required fields >= 60% of their thresholds
//   - Discovered: ALL required fields >= 100% of their thresholds
//
// For cross-field breakthrough techs (requiresSimultaneous: true):
//   - Rumour:    ALL required fields >= 30% — forces a balanced approach
//   - Progress:  ALL required fields >= 60%
//   - Discovered: ALL required fields >= 100%
//
// The simultaneous distinction means breakthrough techs give no early
// signals from a single-field lead — the player must develop multiple
// fields together before anything surfaces.
// ---------------------------------------------------------------------------

const RUMOUR_FRACTION = 0.3;
const PROGRESS_FRACTION = 0.6;

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
  return techDefs.map(def => ({
    defId: def.id,
    stage: 'unknown' as TechDiscoveryStage,
    recipe: recipes.get(def.id) ?? null,
    discoveredTurn: null,
  }));
}

// ---------------------------------------------------------------------------
// Discovery stage computation
// ---------------------------------------------------------------------------

/**
 * Determine which discovery stage a tech should be in given current field
 * totals. Stages are computed fresh each call — the caller is responsible
 * for ensuring stages only advance (never regress).
 */
export function getDiscoveryStage(
  fields: FieldPoints,
  recipe: TechRecipe,
  requiresSimultaneous: boolean,
): TechDiscoveryStage {
  const entries = Object.entries(recipe) as [keyof FieldPoints, number][];

  if (entries.length === 0) return 'discovered'; // no-requirement tech: immediately available

  // Discovery: all fields at 100%
  if (entries.every(([f, t]) => fields[f] >= t)) return 'discovered';

  // Progress: all fields at 60%
  if (entries.every(([f, t]) => fields[f] >= t * PROGRESS_FRACTION)) return 'progress';

  // Rumour: depends on simultaneity requirement
  if (requiresSimultaneous) {
    // Cross-field breakthrough — ALL fields must show at least 30%
    if (entries.every(([f, t]) => fields[f] >= t * RUMOUR_FRACTION)) return 'rumour';
  } else {
    // Standard tech — ANY field at 30% triggers the hint
    if (entries.some(([f, t]) => fields[f] >= t * RUMOUR_FRACTION)) return 'rumour';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Progress check
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

/**
 * Check all techs against current field totals and advance stages where
 * conditions are met. Call at the end of the World Phase after field
 * points have been updated.
 *
 * Signal-derived techs are included in the check here; filtering them
 * by signal infrastructure investment is handled in Phase 9.
 */
export function checkResearchProgress(
  techs: TechState[],
  techDefs: Map<string, TechDef>,
  fields: FieldPoints,
  turn: number,
): ResearchProgressResult {
  const newDiscoveries: string[] = [];
  const newRumours: string[] = [];
  const newProgressTechs: string[] = [];

  const updatedTechs = techs.map(tech => {
    if (tech.stage === 'discovered') return tech;
    if (!tech.recipe) return tech;

    const def = techDefs.get(tech.defId);
    const requiresSimultaneous = def?.requiresSimultaneous ?? false;

    const newStage = getDiscoveryStage(fields, tech.recipe, requiresSimultaneous);
    if (newStage === tech.stage) return tech;

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
