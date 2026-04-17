import type {
  FacilityDef,
  FacilityInstance,
  MapTile,
  HexCoord,
  FieldPoints,
  Resources,
  WillProfile,
  OngoingAction,
  SpaceNode,
  TechState,
  TileActionDef,
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
  const byId = new Map(facilities.map((f) => [f.id, f]));
  return uniqueFacilitiesOnTile(tile, byId);
}

function uniqueFacilitiesOnTile(
  tile: MapTile,
  byId: Map<string, FacilityInstance>,
): FacilityInstance[] {
  const seen = new Set<string>();
  const result: FacilityInstance[] = [];
  for (const id of tile.facilitySlots) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const f = byId.get(id);
    if (f) result.push(f);
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
// Tile productivity map — shared by output and breakdown helpers
// ---------------------------------------------------------------------------

/**
 * Map of coordKey → productivity for tiles that host at least one facility.
 * Destroyed tiles return 0 so any remaining facilities produce nothing.
 */
function buildTileProductivityMap(tiles: MapTile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tile of tiles) {
    if (!tile.facilitySlots.some((s) => s !== null)) continue;
    map.set(coordKey(tile.coord), tile.destroyedStatus !== null ? 0 : tile.productivity);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Unsupplied-space-facility logic — shared guard for output and breakdown
// ---------------------------------------------------------------------------

/**
 * Returns true when a space facility's output should be suppressed because it
 * has not been allocated launch capacity this turn. Upkeep is still paid by
 * the caller in that case. Lunar surface facilities are exempt when ISRU is
 * operational (they are self-sustaining).
 */
function isOutputSuppressed(
  facility: FacilityInstance,
  def: FacilityDef,
  launchAllocation: Record<string, boolean>,
  lunarSurfaceNodeIds: Set<string>,
  isruOperational: boolean,
): boolean {
  if (!def.supplyCost || def.supplyCost <= 0) return false;
  if (launchAllocation[facility.locationKey] !== false) return false;
  if (isruOperational && lunarSurfaceNodeIds.has(facility.locationKey)) return false;
  return true;
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
  // Group each intact tile's unique facilities by coordKey, retaining the coord
  // so we don't have to re-parse keys later.
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const tileEntries = new Map<string, { coord: HexCoord; facilities: FacilityInstance[] }>();
  for (const tile of earthTiles) {
    if (tile.destroyedStatus !== null) continue;
    const tileFacilities = uniqueFacilitiesOnTile(tile, byId);
    if (tileFacilities.length === 0) continue;
    tileEntries.set(coordKey(tile.coord), { coord: tile.coord, facilities: tileFacilities });
  }

  const effects: AdjacencyEffect[] = [];

  for (const { coord, facilities: tileFacilities } of tileEntries.values()) {
    const nKeys = neighborKeys(coord);

    for (const facility of tileFacilities) {
      const def = facilityDefs.get(facility.defId);
      if (!def) continue;

      const effect: AdjacencyEffect = {
        facilityInstanceId: facility.id,
        fieldBonus: { ...ZERO_FIELDS },
        resourceBonus: { ...ZERO_RESOURCES },
      };

      // Hex neighbours
      for (const nKey of nKeys) {
        const neighbors = tileEntries.get(nKey)?.facilities;
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
  launchAllocation: Record<string, boolean> = {},
  spaceNodes: SpaceNode[] = [],
  isruOperational = false,
): FacilityOutput {
  const totalFields: FieldPoints = { ...ZERO_FIELDS };
  const totalResources: Resources = { ...ZERO_RESOURCES };

  const adjById = new Map(adjacencyEffects.map((e) => [e.facilityInstanceId, e]));
  const tileProductivity = buildTileProductivityMap(earthTiles);
  const lunarSurfaceNodeIds = collectLunarSurfaceNodeIds(spaceNodes);

  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;

    const suppressOutput = isOutputSuppressed(
      facility,
      def,
      launchAllocation,
      lunarSurfaceNodeIds,
      isruOperational,
    );

    if (!suppressOutput) {
      const tileProd = tileProductivity.get(facility.locationKey) ?? 1;
      const scale = facility.condition * tileProd;

      // Scaled base output
      for (const k of Object.keys(def.fieldOutput) as (keyof FieldPoints)[]) {
        totalFields[k] += (def.fieldOutput[k] ?? 0) * scale;
      }
      for (const k of Object.keys(def.resourceOutput) as (keyof Resources)[]) {
        totalResources[k] += (def.resourceOutput[k] ?? 0) * scale;
      }

      // Unscaled adjacency bonuses (only when the facility is producing)
      const adj = adjById.get(facility.id);
      if (adj) {
        addPartialFields(totalFields, adj.fieldBonus);
        addPartialResources(totalResources, adj.resourceBonus);
      }
    }

    // Upkeep (subtracted at full cost regardless of condition or supply state)
    for (const k of Object.keys(def.upkeepCost) as (keyof Resources)[]) {
      totalResources[k] -= def.upkeepCost[k] ?? 0;
    }
  }

  return { totalFields, totalResources };
}

function collectLunarSurfaceNodeIds(spaceNodes: SpaceNode[]): Set<string> {
  const ids = new Set<string>();
  for (const n of spaceNodes) {
    if (n.type === 'lunarSurface') ids.add(n.id);
  }
  return ids;
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

const RESOURCE_KEYS: (keyof Resources)[] = ['funding', 'materials', 'politicalWill'];

/**
 * Returns a per-facility-name breakdown of net resource contributions for the
 * current turn. Facilities of the same type are grouped and their amounts
 * summed. Adjacency bonuses are included.
 *
 * Pass `launchAllocation`, `spaceNodes`, and `isruOperational` to correctly
 * exclude output (but not upkeep) from unsupplied space facilities — mirroring
 * the logic in `computeFacilityOutput`.
 */
export function computeResourceBreakdown(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  adjacencyEffects: AdjacencyEffect[],
  earthTiles: MapTile[],
  willExtras?: { bankDecay: number; drift: number },
  launchAllocation: Record<string, boolean> = {},
  spaceNodes: SpaceNode[] = [],
  isruOperational = false,
): ResourceBreakdown {
  const adjById = new Map(adjacencyEffects.map((e) => [e.facilityInstanceId, e]));
  const tileProductivity = buildTileProductivityMap(earthTiles);
  const lunarSurfaceNodeIds = collectLunarSurfaceNodeIds(spaceNodes);

  // Accumulate net per facility def name
  const nameToNet = new Map<string, Partial<Resources>>();

  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def) continue;

    const skipOutput = isOutputSuppressed(
      facility,
      def,
      launchAllocation,
      lunarSurfaceNodeIds,
      isruOperational,
    );

    const scale = facility.condition * (tileProductivity.get(facility.locationKey) ?? 1);
    const net = nameToNet.get(def.name) ?? {};

    if (!skipOutput) {
      for (const [k, v] of Object.entries(def.resourceOutput) as [keyof Resources, number][]) {
        if (v) net[k] = (net[k] ?? 0) + v * scale;
      }
      const adj = adjById.get(facility.id);
      if (adj) {
        for (const [k, v] of Object.entries(adj.resourceBonus) as [keyof Resources, number][]) {
          if (v) net[k] = (net[k] ?? 0) + v;
        }
      }
    }
    for (const [k, v] of Object.entries(def.upkeepCost) as [keyof Resources, number][]) {
      if (v) net[k] = (net[k] ?? 0) - v;
    }

    nameToNet.set(def.name, net);
  }

  const result: ResourceBreakdown = { funding: [], materials: [], politicalWill: [] };

  for (const [name, net] of nameToNet) {
    for (const key of RESOURCE_KEYS) {
      const amount = Math.round(net[key] ?? 0);
      if (amount !== 0) result[key].push({ label: name, amount });
    }
  }

  for (const key of RESOURCE_KEYS) {
    result[key].sort((a, b) => b.amount - a.amount);
  }

  if (willExtras) {
    if (willExtras.bankDecay > 0) {
      result.politicalWill.push({ label: 'Card banking', amount: -willExtras.bankDecay });
    }
    if (willExtras.drift !== 0) {
      result.politicalWill.push({
        label: willExtras.drift > 0 ? 'Natural recovery' : 'Natural drift',
        amount: Math.round(willExtras.drift),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Climate pressure breakdown (for HUD tooltip)
// ---------------------------------------------------------------------------

export interface ClimateBreakdownEntry {
  label: string;
  /** Per-turn contribution. Positive = pollution, negative = mitigation. */
  amount: number;
}

export interface ClimateBreakdown {
  /** Base climate pressure added every turn regardless of facilities. */
  base: number;
  /** Per-facility-type contributions (grouped and summed). */
  entries: ClimateBreakdownEntry[];
}

/**
 * Returns the base rate and per-facility-type climate contributions for use
 * in the HUD climate tooltip.
 */
export function computeClimateBreakdown(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  base: number,
): ClimateBreakdown {
  const nameToAmount = new Map<string, number>();

  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    const impact = def?.climateImpact;
    if (!def || !impact) continue;
    nameToAmount.set(def.name, (nameToAmount.get(def.name) ?? 0) + impact);
  }

  const entries: ClimateBreakdownEntry[] = [];
  for (const [label, amount] of nameToAmount) {
    entries.push({ label, amount });
  }
  // Polluters first (descending), then mitigators (ascending)
  entries.sort((a, b) => b.amount - a.amount);

  return { base, entries };
}

// ---------------------------------------------------------------------------
// Mine depletion
// ---------------------------------------------------------------------------

/**
 * Rate at which mine condition degrades per turn.
 * At 2% per turn a fully-conditioned mine reaches 0 in 50 turns (50 years).
 */
export const MINE_DEPLETION_RATE = 0.02;

export interface MineDepletionResult {
  facilities: FacilityInstance[];
  tiles: MapTile[];
  updatedSpaceNodes: SpaceNode[];
  /** News texts for exhausted space facilities (to be turned into NewsItems by the caller). */
  exhaustionMessages: string[];
}

/**
 * Advance depletion for all depleting facilities.
 * - Earth mines: decrements `facility.condition` and `tile.mineDepletion`.
 * - Space mines: decrements `facility.condition` only (no tile seam tracking).
 *   Unsupplied space facilities do not deplete. When a space mine reaches
 *   condition 0 it is removed and the node is cleared.
 * Returns updated arrays — does not mutate inputs.
 */
export function tickMineDepletion(
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  tiles: MapTile[],
  spaceNodes: SpaceNode[] = [],
  launchAllocation: Record<string, boolean> = {},
): MineDepletionResult {
  const spaceNodesById = new Map(spaceNodes.map((n) => [n.id, n]));
  const earthDepletingKeys = new Set<string>();
  const exhaustedSpaceNodeIds = new Set<string>();
  const exhaustionMessages: string[] = [];

  const updatedFacilities: FacilityInstance[] = [];
  for (const facility of facilities) {
    const def = facilityDefs.get(facility.defId);
    if (!def?.depletes) {
      updatedFacilities.push(facility);
      continue;
    }

    const spaceNode = spaceNodesById.get(facility.locationKey);
    if (spaceNode) {
      // Unsupplied space facilities do not deplete.
      if (launchAllocation[facility.locationKey] === false) {
        updatedFacilities.push(facility);
        continue;
      }
      const newCondition = Math.max(0, facility.condition - MINE_DEPLETION_RATE);
      if (newCondition <= 0) {
        exhaustedSpaceNodeIds.add(facility.locationKey);
        exhaustionMessages.push(
          `${def.name} at ${spaceNode.label} has been exhausted and removed.`,
        );
        continue; // drop the facility
      }
      updatedFacilities.push({ ...facility, condition: newCondition });
      continue;
    }

    // Earth facility
    earthDepletingKeys.add(facility.locationKey);
    updatedFacilities.push({
      ...facility,
      condition: Math.max(0, facility.condition - MINE_DEPLETION_RATE),
    });
  }

  const updatedTiles = earthDepletingKeys.size === 0
    ? tiles
    : tiles.map((tile) => {
        if (!earthDepletingKeys.has(coordKey(tile.coord))) return tile;
        return { ...tile, mineDepletion: Math.max(0, tile.mineDepletion - MINE_DEPLETION_RATE) };
      });

  const updatedSpaceNodes = exhaustedSpaceNodeIds.size === 0
    ? spaceNodes
    : spaceNodes.map((n) =>
        exhaustedSpaceNodeIds.has(n.id) ? { ...n, facilityId: null } : n,
      );

  return { facilities: updatedFacilities, tiles: updatedTiles, updatedSpaceNodes, exhaustionMessages };
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

  const adjById = new Map(adjacencyEffects.map((e) => [e.facilityInstanceId, e]));
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

    const adj = adjById.get(facility.id);
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
  updatedSpaceNodes: SpaceNode[];
  completedActions: OngoingAction[];
  /** Net climate pressure delta from tile actions completing this tick. */
  climateDelta: number;
}

/**
 * Advance the construction queue by one turn.
 * For each action whose turnsRemaining reaches 0:
 *   - Earth 'construct': creates a FacilityInstance and fills the tile's facilitySlots.
 *   - Earth 'demolish':  removes the FacilityInstance and clears its slots.
 *   - Space upgrade (action.spaceNodeId set): replaces the node's facilityId and
 *     removes the old FacilityInstance; inserts the new one.
 * In both cases tile.pendingActionId is cleared.
 * Returns new arrays — does not mutate inputs.
 */
export function tickConstructionQueue(
  queue: OngoingAction[],
  facilities: FacilityInstance[],
  tiles: MapTile[],
  completedTurn: number,
  facilityDefs: Map<string, FacilityDef> = new Map(),
  spaceNodes: SpaceNode[] = [],
  tileActionDefs: Map<string, TileActionDef> = new Map(),
): ConstructionTickResult {
  const updatedQueue: OngoingAction[] = [];
  let updatedFacilities = [...facilities];
  let updatedTiles = [...tiles];
  let updatedSpaceNodes = spaceNodes;
  const completedActions: OngoingAction[] = [];
  let climateDelta = 0;

  for (const action of queue) {
    const next = { ...action, turnsRemaining: action.turnsRemaining - 1 };

    if (next.turnsRemaining > 0) {
      updatedQueue.push(next);
      continue;
    }

    // Action complete
    completedActions.push(next);

    if (action.spaceNodeId) {
      // Space facility upgrade: replace node's facilityId and swap FacilityInstance
      const nodeId = action.spaceNodeId;
      const facilityId = `${action.facilityDefId}-${nodeId}-t${completedTurn}`;
      const newInstance: FacilityInstance = {
        id: facilityId,
        defId: action.facilityDefId,
        locationKey: nodeId,
        condition: 1.0,
        builtTurn: completedTurn,
      };
      updatedFacilities = updatedFacilities
        .filter((f) => f.locationKey !== nodeId)
        .concat(newInstance);
      updatedSpaceNodes = updatedSpaceNodes.map((n) =>
        n.id === nodeId ? { ...n, facilityId: action.facilityDefId } : n,
      );
    } else if (action.type === 'construct') {
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
        for (let i = action.slotIndex; i < action.slotIndex + slotCost && i < 3; i++) {
          newSlots[i] = facilityId;
        }
        return { ...t, facilitySlots: newSlots, pendingActionId: null };
      });
    } else if (action.type === 'tileAction' && action.tileActionDefId) {
      // Tile action: terrain modification (restore, sea wall, urbanise, etc.)
      const taDef = tileActionDefs.get(action.tileActionDefId);
      if (taDef) {
        updatedTiles = updatedTiles.map((t) => {
          if (coordKey(t.coord) !== action.coordKey) return t;
          const updated: MapTile = { ...t, pendingActionId: null };
          if (taDef.transformsTo) updated.type = taDef.transformsTo;
          if (taDef.clearsDestroyedStatus) updated.destroyedStatus = null;
          if (taDef.seaWallProtection) updated.seaWallProtected = true;
          return updated;
        });
        climateDelta += taDef.climateEffect;
      }
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

  return { updatedQueue, updatedFacilities, updatedTiles, updatedSpaceNodes, completedActions, climateDelta };
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
// Facility upgrade helpers
// ---------------------------------------------------------------------------

/**
 * Returns the next-tier FacilityDef for the facility on the given space node,
 * if the player has discovered the required tech. Returns null otherwise.
 *
 * A facility is upgradeable when another def has `upgradesFrom === currentDefId`
 * and its `requiredTechId` has been discovered.
 */
export function canUpgradeFacility(
  nodeId: string,
  spaceNodes: SpaceNode[],
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  techs: TechState[],
): FacilityDef | null {
  const node = spaceNodes.find((n) => n.id === nodeId);
  if (!node || !node.facilityId) return null;

  const currentDefId = node.facilityId;
  const discoveredTechIds = new Set(
    techs.filter((t) => t.stage === 'discovered').map((t) => t.defId),
  );

  for (const def of facilityDefs.values()) {
    if (def.upgradesFrom !== currentDefId) continue;
    if (def.requiredTechId && !discoveredTechIds.has(def.requiredTechId)) continue;
    return def;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lunar chain uniqueness
// ---------------------------------------------------------------------------

/**
 * Walk the upgradesFrom chain to find the root facility def ID.
 * e.g. lunarSpaceport → lunarLaunchFacility (root)
 */
export function getChainRoot(defId: string, facilityDefs: Map<string, FacilityDef>): string {
  let id = defId;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(id)) return id; // guard against cycles in malformed data
    seen.add(id);
    const parent = facilityDefs.get(id)?.upgradesFrom;
    if (!parent) return id;
    id = parent;
  }
}

/**
 * Returns true if any lunarSurface node other than `excludeNodeId` already has
 * a facility (built or queued) from the same chain as `defId`.
 *
 * Used to enforce one-chain-per-type uniqueness across lunar sites.
 */
export function isLunarChainTaken(
  defId: string,
  excludeNodeId: string,
  spaceNodes: SpaceNode[],
  facilityDefs: Map<string, FacilityDef>,
  constructionQueue: OngoingAction[] = [],
): boolean {
  const targetRoot = getChainRoot(defId, facilityDefs);

  const lunarNodeIds = new Set<string>();
  for (const node of spaceNodes) {
    if (node.type !== 'lunarSurface') continue;
    lunarNodeIds.add(node.id);
    if (node.id === excludeNodeId || !node.facilityId) continue;
    if (getChainRoot(node.facilityId, facilityDefs) === targetRoot) return true;
  }

  for (const action of constructionQueue) {
    if (!action.spaceNodeId || action.spaceNodeId === excludeNodeId) continue;
    if (!lunarNodeIds.has(action.spaceNodeId)) continue;
    if (getChainRoot(action.facilityDefId, facilityDefs) === targetRoot) return true;
  }

  return false;
}
