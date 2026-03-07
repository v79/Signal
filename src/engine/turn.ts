import type { GameState, FacilityDef } from './types';
import { computeAdjacencyEffects, computeFacilityOutput, tickMineDepletion } from './facilities';
import { tickWill, computeBankDecay, applyFieldDeltas, applyResourceDeltas, DEFAULT_WILL_CONFIG } from './resources';
import { ZERO_RESOURCES } from './state';

// ---------------------------------------------------------------------------
// World Phase
//
// The World Phase is the last of the five turn phases (Event → Draw → Action
// → Bank → World). It applies all passive effects: facility output, resource
// ticks, Will drift, mine depletion, and climate progression.
//
// PRNG call order within this phase (must remain stable for seed reproducibility):
//   1. Climate degradation RNG calls (Phase 5, not yet implemented)
//   2. Bloc simulation RNG calls (Phase 7, not yet implemented)
//   3. Event pool RNG calls (Phase 4, not yet implemented)
//
// ---------------------------------------------------------------------------

/** Climate pressure increase per turn (in points, 0–100 scale). */
const CLIMATE_PRESSURE_PER_TURN = 0.5;

/**
 * Execute the World Phase for one turn.
 *
 * Accepts a FacilityDef lookup map from the data layer so the engine
 * remains independent of src/data imports.
 *
 * ProjectDef lookup will be added in Phase 4 when the project system
 * is implemented; project upkeep is zero until then.
 */
export function executeWorldPhase(
  state: GameState,
  facilityDefs: Map<string, FacilityDef>,
): GameState {
  const { player, map } = state;

  // 1. Adjacency effects (Earth map only for now)
  const adjacencyEffects = computeAdjacencyEffects(
    player.facilities,
    facilityDefs,
    map.earthTiles,
  );

  // 2. Facility output (fields + resources, net of upkeep)
  const { totalFields, totalResources } = computeFacilityOutput(
    player.facilities,
    facilityDefs,
    adjacencyEffects,
    map.earthTiles,
  );

  // 3. Bank decay and project upkeep
  const bankDecay = computeBankDecay(player.cards);
  const projectUpkeep = ZERO_RESOURCES; // Phase 4: wire in actual project upkeep

  // 4. Apply changes to player
  const newFields = applyFieldDeltas(player.fields, totalFields);
  const newResources = applyResourceDeltas(player.resources, totalResources, bankDecay, projectUpkeep);

  // 5. Will natural drift
  const willConfig = DEFAULT_WILL_CONFIG[player.willProfile];
  const newWill = tickWill(player.will, willConfig);

  // 6. Mine depletion
  const newFacilities = tickMineDepletion(player.facilities, facilityDefs);

  // 7. Climate pressure
  const newClimatePressure = Math.min(100, state.climatePressure + CLIMATE_PRESSURE_PER_TURN);

  return {
    ...state,
    turn: state.turn + 1,
    year: state.year + 1,
    phase: 'event', // reset to first phase for next turn
    climatePressure: newClimatePressure,
    player: {
      ...player,
      resources: newResources,
      fields: newFields,
      will: newWill,
      facilities: newFacilities,
    },
  };
}
