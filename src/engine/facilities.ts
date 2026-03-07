import type {
  FacilityDef,
  FacilityInstance,
  MapTile,
  HexCoord,
  FieldPoints,
  Resources,
} from './types';
import { ZERO_FIELDS, ZERO_RESOURCES } from './state';

// ---------------------------------------------------------------------------
// Hex grid helpers
// ---------------------------------------------------------------------------

const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

export function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function neighborKeys(coord: HexCoord): string[] {
  return HEX_DIRECTIONS.map(d => coordKey({ q: coord.q + d.q, r: coord.r + d.r }));
}

// ---------------------------------------------------------------------------
// Accumulation helpers (mutate an accumulator object)
// ---------------------------------------------------------------------------

function addPartialFields(acc: FieldPoints, delta: Partial<FieldPoints>): void {
  for (const k of Object.keys(delta) as (keyof FieldPoints)[]) {
    acc[k] += delta[k] ?? 0;
  }
}

function addPartialResources(acc: Resources, delta: Partial<Resources>): void {
  for (const k of Object.keys(delta) as (keyof Resources)[]) {
    acc[k] += delta[k] ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

/**
 * Net adjacency effect on a single facility instance, accumulated across
 * all its hex neighbours. Applied after base output, not scaled by condition.
 */
export interface AdjacencyEffect {
  facilityInstanceId: string;
  fieldBonus: FieldPoints;
  resourceBonus: Resources;
}

/**
 * Pre-compute adjacency effects for all Earth-map facilities.
 * Call once per World Phase before computeFacilityOutput.
 *
 * The adjacency rules are directional: a FacilityDef declares which
 * neighbour def IDs trigger its own bonuses/penalties. Both the University
 * and the Research Lab carry matching rules so both receive the bonus —
 * this mirrors the GDD intent without requiring symmetric auto-application.
 */
export function computeAdjacencyEffects(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  earthTiles: MapTile[],
): AdjacencyEffect[] {
  // Build coord-key → facility lookup for Earth tiles
  const keyToFacility = new Map<string, FacilityInstance>();
  for (const tile of earthTiles) {
    if (!tile.facilityId || tile.destroyedStatus !== null) continue;
    const facility = facilities.find(f => f.id === tile.facilityId);
    if (facility) keyToFacility.set(coordKey(tile.coord), facility);
  }

  const effects: AdjacencyEffect[] = [];

  for (const [key, facility] of keyToFacility) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;

    const coord = parseCoordKey(key);
    const effect: AdjacencyEffect = {
      facilityInstanceId: facility.id,
      fieldBonus: { ...ZERO_FIELDS },
      resourceBonus: { ...ZERO_RESOURCES },
    };

    for (const nKey of neighborKeys(coord)) {
      const neighbor = keyToFacility.get(nKey);
      if (!neighbor) continue;

      for (const rule of def.adjacencyBonuses) {
        if (rule.neighborDefId !== neighbor.defId) continue;
        if (rule.fieldBonus) addPartialFields(effect.fieldBonus, rule.fieldBonus);
        if (rule.resourceBonus) addPartialResources(effect.resourceBonus, rule.resourceBonus);
      }

      for (const rule of def.adjacencyPenalties) {
        if (rule.neighborDefId !== neighbor.defId) continue;
        // Penalties subtract from the bonus accumulators
        if (rule.fieldPenalty) {
          for (const k of Object.keys(rule.fieldPenalty) as (keyof FieldPoints)[]) {
            effect.fieldBonus[k] -= rule.fieldPenalty[k] ?? 0;
          }
        }
        if (rule.resourcePenalty) {
          for (const k of Object.keys(rule.resourcePenalty) as (keyof Resources)[]) {
            effect.resourceBonus[k] -= rule.resourcePenalty[k] ?? 0;
          }
        }
      }
    }

    effects.push(effect);
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Facility output
// ---------------------------------------------------------------------------

export interface FacilityOutput {
  totalFields: FieldPoints;
  totalResources: Resources;
}

/**
 * Compute the combined field and resource output of all facilities for
 * one World Phase tick.
 *
 * Output is scaled by:
 *   - facility.condition (0–1): depletion factor for mines; always 1 for others
 *   - tile.productivity (0–1): climate/exhaustion degradation of the tile
 *
 * Adjacency bonuses are structural effects applied at full value regardless
 * of condition or productivity.
 *
 * Upkeep costs are subtracted from totalResources so the caller receives
 * the net delta to apply to player resources.
 */
export function computeFacilityOutput(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  adjacencyEffects: AdjacencyEffect[],
  earthTiles: MapTile[],
): FacilityOutput {
  const totalFields: FieldPoints = { ...ZERO_FIELDS };
  const totalResources: Resources = { ...ZERO_RESOURCES };

  const adjById = new Map(adjacencyEffects.map(e => [e.facilityInstanceId, e]));

  // Tile productivity by locationKey (coord string) for Earth facilities
  const tileProductivity = new Map<string, number>();
  for (const tile of earthTiles) {
    if (tile.facilityId && tile.destroyedStatus === null) {
      tileProductivity.set(coordKey(tile.coord), tile.productivity);
    }
  }

  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;

    const tileProd = tileProductivity.get(facility.locationKey) ?? 1;
    const scale = facility.condition * tileProd;

    // Scaled base output
    for (const k of Object.keys(def.fieldOutput) as (keyof FieldPoints)[]) {
      totalFields[k] += (def.fieldOutput[k] ?? 0) * scale;
    }
    for (const k of Object.keys(def.resourceOutput) as (keyof Resources)[]) {
      totalResources[k] += (def.resourceOutput[k] ?? 0) * scale;
    }

    // Unscaled adjacency bonuses
    const adj = adjById.get(facility.id);
    if (adj) {
      addPartialFields(totalFields, adj.fieldBonus);
      addPartialResources(totalResources, adj.resourceBonus);
    }

    // Upkeep (subtracted at full cost regardless of condition)
    for (const k of Object.keys(def.upkeepCost) as (keyof Resources)[]) {
      totalResources[k] -= def.upkeepCost[k] ?? 0;
    }
  }

  return { totalFields, totalResources };
}

// ---------------------------------------------------------------------------
// Mine depletion
// ---------------------------------------------------------------------------

/**
 * Rate at which mine condition degrades per turn.
 * At 2% per turn a fully-conditioned mine reaches 0 in 50 turns (50 years).
 */
export const MINE_DEPLETION_RATE = 0.02;

/**
 * Advance depletion for all depleting facilities.
 * Returns a new facilities array — does not mutate the input.
 */
export function tickMineDepletion(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
): FacilityInstance[] {
  return facilities.map(facility => {
    const def = facilityDefs.get(facility.defId);
    if (!def?.depletes) return facility;
    return { ...facility, condition: Math.max(0, facility.condition - MINE_DEPLETION_RATE) };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseCoordKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}
