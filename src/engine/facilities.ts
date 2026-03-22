import type {
  FacilityDef,
  FacilityInstance,
  MapTile,
  HexCoord,
  FieldPoints,
  Resources,
  WillProfile,
  OngoingAction,
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
  return HEX_DIRECTIONS.map((d) => coordKey({ q: coord.q + d.q, r: coord.r + d.r }));
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
// Multi-slot helpers
// ---------------------------------------------------------------------------

/**
 * Returns the unique FacilityInstances present on a tile, deduplicating
 * multi-slot entries that repeat the same instance ID.
 */
export function getFacilitiesOnTile(tile: MapTile, facilities: FacilityInstance[]): FacilityInstance[] {
  const seen = new Set<string>();
  const result: FacilityInstance[] = [];
  for (const id of tile.facilitySlots) {
    if (id && !seen.has(id)) {
      seen.add(id);
      const f = facilities.find((fac) => fac.id === id);
      if (f) result.push(f);
    }
  }
  return result;
}

/**
 * Find the lowest slot index where `slotCost` contiguous free slots exist.
 * Returns null if no contiguous space is available.
 */
export function findContiguousFreeStart(
  slots: [string | null, string | null, string | null],
  slotCost: number,
): number | null {
  for (let i = 0; i <= 3 - slotCost; i++) {
    if (slots.slice(i, i + slotCost).every((s) => s === null)) return i;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Adjacency
// ---------------------------------------------------------------------------

/**
 * Net adjacency effect on a single facility instance, accumulated across
 * all its hex neighbours and same-tile peers. Applied after base output,
 * not scaled by condition.
 */
export interface AdjacencyEffect {
  facilityInstanceId: string;
  fieldBonus: FieldPoints;
  resourceBonus: Resources;
}

/** Apply a facility's adjacency rules against a single neighbour. */
function applyAdjacencyRules(
  def: FacilityDef,
  neighbor: FacilityInstance,
  effect: AdjacencyEffect,
): void {
  for (const rule of def.adjacencyBonuses) {
    if (rule.neighborDefId !== neighbor.defId) continue;
    if (rule.fieldBonus) addPartialFields(effect.fieldBonus, rule.fieldBonus);
    if (rule.resourceBonus) addPartialResources(effect.resourceBonus, rule.resourceBonus);
  }
  for (const rule of def.adjacencyPenalties) {
    if (rule.neighborDefId !== neighbor.defId) continue;
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

/**
 * Pre-compute adjacency effects for all Earth-map facilities.
 * Call once per World Phase before computeFacilityOutput.
 *
 * Checks both hex-adjacent tiles and same-tile peers (intra-tile adjacency).
 */
export function computeAdjacencyEffects(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  earthTiles: MapTile[],
): AdjacencyEffect[] {
  // Build coord-key → unique FacilityInstance[] per tile, skipping destroyed tiles
  const keyToFacilities = new Map<string, FacilityInstance[]>();
  for (const tile of earthTiles) {
    if (tile.destroyedStatus !== null) continue;
    const tileFacilities = getFacilitiesOnTile(tile, facilities);
    if (tileFacilities.length > 0) {
      keyToFacilities.set(coordKey(tile.coord), tileFacilities);
    }
  }

  const effects: AdjacencyEffect[] = [];

  for (const [key, tileFacilities] of keyToFacilities) {
    const coord = parseCoordKey(key);

    for (const facility of tileFacilities) {
      const def = facilityDefs.get(facility.defId);
      if (!def) continue;

      const effect: AdjacencyEffect = {
        facilityInstanceId: facility.id,
        fieldBonus: { ...ZERO_FIELDS },
        resourceBonus: { ...ZERO_RESOURCES },
      };

      // Hex neighbours
      for (const nKey of neighborKeys(coord)) {
        const neighbors = keyToFacilities.get(nKey);
        if (!neighbors) continue;
        for (const neighbor of neighbors) {
          applyAdjacencyRules(def, neighbor, effect);
        }
      }

      // Intra-tile peers
      for (const peer of tileFacilities) {
        if (peer.id === facility.id) continue;
        applyAdjacencyRules(def, peer, effect);
      }

      effects.push(effect);
    }
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
 * Facilities on destroyed tiles produce nothing (productivity = 0).
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

  const adjById = new Map(adjacencyEffects.map((e) => [e.facilityInstanceId, e]));

  // Tile productivity by locationKey for Earth facilities.
  // Destroyed tiles get 0 so any remaining facilities produce nothing.
  const tileProductivity = new Map<string, number>();
  for (const tile of earthTiles) {
    const key = coordKey(tile.coord);
    if (tile.destroyedStatus !== null) {
      if (tile.facilitySlots.some((s) => s !== null)) {
        tileProductivity.set(key, 0);
      }
    } else if (tile.facilitySlots.some((s) => s !== null)) {
      tileProductivity.set(key, tile.productivity);
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
// Per-facility resource breakdown (for HUD tooltips)
// ---------------------------------------------------------------------------

export interface ResourceBreakdownEntry {
  label: string;
  /** Net contribution this turn (positive = income, negative = cost). */
  amount: number;
}

export interface ResourceBreakdown {
  funding: ResourceBreakdownEntry[];
  materials: ResourceBreakdownEntry[];
  politicalWill: ResourceBreakdownEntry[];
}

/**
 * Returns a per-facility-name breakdown of net resource contributions for the
 * current turn. Facilities of the same type are grouped and their amounts
 * summed. Adjacency bonuses are included.
 */
export function computeResourceBreakdown(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  adjacencyEffects: AdjacencyEffect[],
  earthTiles: MapTile[],
): ResourceBreakdown {
  const adjById = new Map(adjacencyEffects.map((e) => [e.facilityInstanceId, e]));

  const tileProductivity = new Map<string, number>();
  for (const tile of earthTiles) {
    const key = coordKey(tile.coord);
    if (tile.destroyedStatus !== null) {
      if (tile.facilitySlots.some((s) => s !== null)) {
        tileProductivity.set(key, 0);
      }
    } else if (tile.facilitySlots.some((s) => s !== null)) {
      tileProductivity.set(key, tile.productivity);
    }
  }

  // Accumulate net per facility def name
  const nameToNet = new Map<string, Partial<Resources>>();

  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;

    const scale = facility.condition * (tileProductivity.get(facility.locationKey) ?? 1);
    const net: Partial<Resources> = {};

    for (const [k, v] of Object.entries(def.resourceOutput) as [keyof Resources, number][]) {
      if (v) net[k] = (net[k] ?? 0) + v * scale;
    }
    for (const [k, v] of Object.entries(def.upkeepCost) as [keyof Resources, number][]) {
      if (v) net[k] = (net[k] ?? 0) - v;
    }
    const adj = adjById.get(facility.id);
    if (adj) {
      for (const [k, v] of Object.entries(adj.resourceBonus) as [keyof Resources, number][]) {
        if (v) net[k] = (net[k] ?? 0) + v;
      }
    }

    const existing = nameToNet.get(def.name);
    if (existing) {
      for (const [k, v] of Object.entries(net) as [keyof Resources, number][]) {
        existing[k] = (existing[k] ?? 0) + (v as number);
      }
    } else {
      nameToNet.set(def.name, { ...net });
    }
  }

  const result: ResourceBreakdown = { funding: [], materials: [], politicalWill: [] };
  const resourceKeys: (keyof Resources)[] = ['funding', 'materials', 'politicalWill'];

  for (const [name, net] of nameToNet) {
    for (const key of resourceKeys) {
      const amount = Math.round(net[key] ?? 0);
      if (amount !== 0) result[key].push({ label: name, amount });
    }
  }

  for (const key of resourceKeys) {
    result[key].sort((a, b) => b.amount - a.amount);
  }

  return result;
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
 * Also decrements `mineDepletion` on the tile so the seam level persists
 * independently of whether a mine is currently built there.
 * Returns updated facilities and tiles — does not mutate inputs.
 */
export function tickMineDepletion(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  tiles: MapTile[],
): { facilities: FacilityInstance[]; tiles: MapTile[] } {
  const depletingKeys = new Set<string>();

  const updatedFacilities = facilities.map((facility) => {
    const def = facilityDefs.get(facility.defId);
    if (!def?.depletes) return facility;
    depletingKeys.add(facility.locationKey);
    return { ...facility, condition: Math.max(0, facility.condition - MINE_DEPLETION_RATE) };
  });

  const updatedTiles = tiles.map((tile) => {
    const key = `${tile.coord.q},${tile.coord.r}`;
    if (!depletingKeys.has(key)) return tile;
    return { ...tile, mineDepletion: Math.max(0, tile.mineDepletion - MINE_DEPLETION_RATE) };
  });

  return { facilities: updatedFacilities, tiles: updatedTiles };
}

// ---------------------------------------------------------------------------
// HQ bonus
// ---------------------------------------------------------------------------

/**
 * Per-turn resource and field bonus granted by the HQ facility.
 * Democratic blocs get Computing and SocialScience research trickles;
 * authoritarian blocs get an additional Materials trickle instead.
 */
export interface HqBonus {
  resources: Partial<Resources>;
  fields: Partial<FieldPoints>;
}

export function computeHqBonus(
  willProfile: WillProfile,
  techFieldBonus: Partial<FieldPoints> = {},
): HqBonus {
  const baseFields: Partial<FieldPoints> =
    willProfile === 'democratic' ? { computing: 1, socialScience: 1 } : {};
  const baseResources: Partial<Resources> =
    willProfile === 'authoritarian'
      ? { funding: 2, politicalWill: 1, materials: 2 }
      : { funding: 2, politicalWill: 1 };

  const fields: Partial<FieldPoints> = { ...baseFields };
  for (const k of Object.keys(techFieldBonus) as (keyof FieldPoints)[]) {
    fields[k] = (fields[k] ?? 0) + (techFieldBonus[k] ?? 0);
  }

  return { resources: baseResources, fields };
}

// ---------------------------------------------------------------------------
// Tile summary (for hover tooltip)
// ---------------------------------------------------------------------------

export interface TileSummary {
  tileType: string;
  facilityNames: string[];
  /** Net field output per turn (base + adjacency) aggregated across all tile facilities. */
  fieldOutput: Partial<FieldPoints>;
  /** Net resource output per turn (base + adjacency - upkeep) aggregated across all tile facilities. */
  resourceOutput: Partial<Resources>;
  productivity: number;
  destroyedStatus: string | null;
  canDelete: boolean;
}

/**
 * Compute a human-readable summary of a tile for the hover tooltip.
 * Adjacency effects are included when a full adjacency map is provided.
 */
export function getTileSummary(
  tile: MapTile,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  adjacencyEffects: AdjacencyEffect[],
): TileSummary {
  const tileFacilities = getFacilitiesOnTile(tile, facilities);

  if (tileFacilities.length === 0) {
    return {
      tileType: tile.type,
      facilityNames: [],
      fieldOutput: {},
      resourceOutput: {},
      productivity: tile.productivity,
      destroyedStatus: tile.destroyedStatus,
      canDelete: false,
    };
  }

  const fieldOutput: Partial<FieldPoints> = {};
  const resourceOutput: Partial<Resources> = {};
  let canDelete = false;

  for (const facility of tileFacilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;
    if (def.canDelete) canDelete = true;

    for (const k of Object.keys(def.fieldOutput) as (keyof FieldPoints)[]) {
      fieldOutput[k] = (fieldOutput[k] ?? 0) + (def.fieldOutput[k] ?? 0);
    }
    for (const k of Object.keys(def.resourceOutput) as (keyof Resources)[]) {
      resourceOutput[k] = (resourceOutput[k] ?? 0) + (def.resourceOutput[k] ?? 0);
    }
    for (const k of Object.keys(def.upkeepCost) as (keyof Resources)[]) {
      resourceOutput[k] = (resourceOutput[k] ?? 0) - (def.upkeepCost[k] ?? 0);
    }

    const adj = adjacencyEffects.find((e) => e.facilityInstanceId === facility.id);
    if (adj) {
      for (const k of Object.keys(adj.fieldBonus) as (keyof FieldPoints)[]) {
        if (adj.fieldBonus[k]) fieldOutput[k] = (fieldOutput[k] ?? 0) + adj.fieldBonus[k];
      }
      for (const k of Object.keys(adj.resourceBonus) as (keyof Resources)[]) {
        if (adj.resourceBonus[k]) resourceOutput[k] = (resourceOutput[k] ?? 0) + adj.resourceBonus[k];
      }
    }
  }

  return {
    tileType: tile.type,
    facilityNames: tileFacilities.map((f) => facilityDefs.get(f.defId)?.name ?? f.defId),
    fieldOutput,
    resourceOutput,
    productivity: tile.productivity,
    destroyedStatus: tile.destroyedStatus,
    canDelete,
  };
}

// ---------------------------------------------------------------------------
// Construction queue tick
// ---------------------------------------------------------------------------

export interface ConstructionTickResult {
  updatedQueue: OngoingAction[];
  updatedFacilities: FacilityInstance[];
  updatedTiles: MapTile[];
  completedActions: OngoingAction[];
}

/**
 * Advance the construction queue by one turn.
 * For each action whose turnsRemaining reaches 0:
 *   - 'construct': creates a FacilityInstance and fills the tile's facilitySlots.
 *   - 'demolish':  removes the FacilityInstance and clears its slots.
 * In both cases tile.pendingActionId is cleared.
 * Returns new arrays — does not mutate inputs.
 */
export function tickConstructionQueue(
  queue: OngoingAction[],
  facilities: FacilityInstance[],
  tiles: MapTile[],
  completedTurn: number,
  facilityDefs: Map<string, FacilityDef> = new Map(),
): ConstructionTickResult {
  const updatedQueue: OngoingAction[] = [];
  let updatedFacilities = [...facilities];
  let updatedTiles = [...tiles];
  const completedActions: OngoingAction[] = [];

  for (const action of queue) {
    const next = { ...action, turnsRemaining: action.turnsRemaining - 1 };

    if (next.turnsRemaining > 0) {
      updatedQueue.push(next);
      continue;
    }

    // Action complete
    completedActions.push(next);

    if (action.type === 'construct') {
      const facilityId = `${action.facilityDefId}-${action.coordKey}-t${completedTurn}`;
      const def = facilityDefs.get(action.facilityDefId);
      const slotCost = def?.slotCost ?? 1;
      const tile = updatedTiles.find((t) => coordKey(t.coord) === action.coordKey);
      const startCondition = def?.depletes && tile ? tile.mineDepletion : 1.0;
      const newInstance: FacilityInstance = {
        id: facilityId,
        defId: action.facilityDefId,
        locationKey: action.coordKey,
        condition: startCondition,
        builtTurn: completedTurn,
      };
      updatedFacilities = [...updatedFacilities, newInstance];
      updatedTiles = updatedTiles.map((t) => {
        if (coordKey(t.coord) !== action.coordKey) return t;
        const newSlots = [...t.facilitySlots] as [string | null, string | null, string | null];
        for (let i = action.slotIndex; i < action.slotIndex + slotCost; i++) {
          if (i < 3) newSlots[i] = facilityId;
        }
        return { ...t, facilitySlots: newSlots, pendingActionId: null };
      });
    } else {
      // demolish: find the instance at slotIndex, remove it and clear all its slots
      const targetTile = updatedTiles.find((t) => coordKey(t.coord) === action.coordKey);
      const instanceId = targetTile?.facilitySlots[action.slotIndex] ?? null;
      if (instanceId) {
        updatedFacilities = updatedFacilities.filter((f) => f.id !== instanceId);
      }
      updatedTiles = updatedTiles.map((t) => {
        if (coordKey(t.coord) !== action.coordKey) return t;
        const newSlots = t.facilitySlots.map((s) =>
          s === instanceId ? null : s,
        ) as [string | null, string | null, string | null];
        return { ...t, facilitySlots: newSlots, pendingActionId: null };
      });
    }
  }

  return { updatedQueue, updatedFacilities, updatedTiles, completedActions };
}

// ---------------------------------------------------------------------------
// Unique facility guard
// ---------------------------------------------------------------------------

/**
 * Returns true if a facility with the given def ID is already built
 * (present in the facilities list or still in the construction queue).
 * Used to enforce the `unique` constraint before starting construction.
 */
export function isUniqueAlreadyBuilt(
  facilities: FacilityInstance[],
  queue: OngoingAction[],
  defId: string,
): boolean {
  return (
    facilities.some((f) => f.defId === defId) ||
    queue.some((a) => a.type === 'construct' && a.facilityDefId === defId)
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseCoordKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}
