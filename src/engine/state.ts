import type {
  GameState,
  PushFactor,
  Era,
  TurnPhase,
  PlayerState,
  MapState,
  SignalState,
  Resources,
  FieldPoints,
  WillProfile,
  FacilityInstance,
  TechState,
} from './types';

// ---------------------------------------------------------------------------
// GameConfig — passed to createGameState() at the start of a new run.
// Bloc-specific starting values come from src/data/blocs.ts (wired in during
// Phase 7). For now, callers provide them directly.
// ---------------------------------------------------------------------------

export interface GameConfig {
  seed: string;
  playerBlocDefId: string;
  pushFactor: PushFactor;
  /** Starting calendar year (cosmetic label only). */
  startYear: number;
  willProfile: WillProfile;
  /** Starting Will (0–100). */
  startingWill: number;
  startingResources: Resources;
  /** Starting field point biases — fields not listed start at 0. */
  startingFields?: Partial<FieldPoints>;
  /** Dev: override starting era (defaults to 'earth'). */
  startEra?: Era;
  /** Dev: override starting turn number (defaults to 1). */
  startTurn?: number;
}

// ---------------------------------------------------------------------------
// Zero-value constants — useful as base values in arithmetic helpers.
// ---------------------------------------------------------------------------

export const ZERO_RESOURCES: Resources = {
  funding: 0,
  materials: 0,
  politicalWill: 0,
};

export const ZERO_FIELDS: FieldPoints = {
  physics: 0,
  mathematics: 0,
  engineering: 0,
  biochemistry: 0,
  computing: 0,
  socialScience: 0,
};

// ---------------------------------------------------------------------------
// Sub-state factories
// ---------------------------------------------------------------------------

function createPlayerState(config: GameConfig): PlayerState {
  return {
    blocDefId: config.playerBlocDefId,
    resources: { ...config.startingResources },
    fields: { ...ZERO_FIELDS, ...config.startingFields },
    will: config.startingWill,
    willProfile: config.willProfile,
    facilities: [],
    completedProjectIds: [],
    activeProjects: [],
    techs: [],
    cards: [],
    board: {},
    newsFeed: [],
    constructionQueue: [],
  };
}

function createMapState(): MapState {
  return {
    earthTiles: [],
    spaceNodes: [],
    beltNodes: [],
    beltEdges: [],
  };
}

function createSignalState(): SignalState {
  return {
    decodeProgress: 0,
    eraStrength: 'faint',
    responseCommitted: false,
    responseCorrect: null,
    wormholeActivated: false,
  };
}

// ---------------------------------------------------------------------------
// Root factory
// ---------------------------------------------------------------------------

export function createGameState(config: GameConfig): GameState {
  return {
    seed: config.seed,
    turn: config.startTurn ?? 1,
    year: config.startYear,
    era: (config.startEra ?? 'earth') as Era,
    phase: 'event' as TurnPhase,
    pushFactor: config.pushFactor,
    player: createPlayerState(config),
    blocs: [],
    map: createMapState(),
    signal: createSignalState(),
    activeEvents: [],
    outcome: null,
    earthWelfareScore: 75,
    climatePressure: 10,
    actionsThisTurn: 0,
    maxActionsPerTurn: 3,
    bonusActionsNextTurn: 0,
    bonusActionsThisTurn: 0,
    launchCapacity: 0,
    launchAllocation: {},
    seenNarrativeIds: [],
    narrativeQueue: [],
    availableBoardDefIds: [],
    boardGracePeriodEnds: 4,
    committeeNotifications: [],
    boardProposalFired: false,
    orbitalStationAuthorised: false,
    orbitalStationDeferCount: 0,
    orbitalStationDeferResurfaceTurn: null,
    moonColonyProposalFired: false,
    moonColonyAuthorised: false,
    moonColonyDeferCount: 0,
    moonColonyDeferResurfaceTurn: null,
    isruOperational: false,
  };
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialise the full game state to a JSON string for save/load. */
export function serialiseGameState(state: GameState): string {
  return JSON.stringify(state);
}

/** Deserialise a JSON string back to a GameState, applying any forward migrations. */
export function deserialiseGameState(json: string): GameState {
  const state = JSON.parse(json) as GameState;

  // Migration: ensure all current space nodes are present and typed correctly.
  const knownIds = new Set(state.map.spaceNodes.map((n) => n.id));

  // Add L4/L5 if missing (added Phase 33).
  if (!knownIds.has('l4')) {
    state.map.spaceNodes.push({ id: 'l4', type: 'trojanPoint', label: 'Trojan L4', launchCost: 30, facilityId: null });
  }
  if (!knownIds.has('l5')) {
    state.map.spaceNodes.push({ id: 'l5', type: 'trojanPoint', label: 'Trojan L5', launchCost: 30, facilityId: null });
  }

  // Upgrade lagrangePoint → cislunarPoint/trojanPoint (added Phase 34).
  for (const node of state.map.spaceNodes) {
    if ((node.type as string) === 'lagrangePoint') {
      node.type = node.id === 'l4' || node.id === 'l5' ? 'trojanPoint' : 'cislunarPoint';
    }
  }

  // Add two new lunar surface nodes (added Phase 34).
  if (!knownIds.has('lunarSouth')) {
    state.map.spaceNodes.push({ id: 'lunarSouth', type: 'lunarSurface', label: 'Shackleton Crater', launchCost: 45, facilityId: null });
  }
  if (!knownIds.has('lunarFar')) {
    state.map.spaceNodes.push({ id: 'lunarFar', type: 'lunarSurface', label: 'Mare Imbrium', launchCost: 50, facilityId: null });
  }

  // Relabel original lunar node (added Phase 34).
  const origLunar = state.map.spaceNodes.find((n) => n.id === 'lunarSurface');
  if (origLunar && origLunar.label === 'Lunar Surface') {
    origLunar.label = 'Mare Tranquillitatis';
    origLunar.launchCost = 40;
  }

  return state;
}

// ---------------------------------------------------------------------------
// Launch capacity
// ---------------------------------------------------------------------------

/**
 * Recompute total launch capacity from capacity-granting facilities.
 *
 * Capacity sources:
 *   - spaceLaunchCentre (Earth):      +3 each
 *   - fuelDepot (cislunar/trojan):    +2 each
 *   - lunarLaunchFacility (lunar):    +2 each
 *   - lunarSpaceport (lunar upgrade): +4 each
 *
 * Tech progression reduces effective supply cost per facility via
 * `computeSpaceSupplyCostReduction` rather than adding raw capacity.
 */
export function recomputeLaunchCapacity(
  facilities: FacilityInstance[],
  _techs: TechState[],
): number {
  const CAPACITY_BY_DEF: Record<string, number> = {
    spaceLaunchCentre: 3,
    fuelDepot: 2,
    lunarLaunchFacility: 2,
    lunarSpaceport: 4,
  };
  let capacity = 0;
  for (const inst of facilities) {
    capacity += CAPACITY_BY_DEF[inst.defId] ?? 0;
  }
  return capacity;
}

/**
 * Compute how many supply-cost units to subtract from each space facility's
 * base `supplyCost`. Applied as `Math.max(0, supplyCost - reduction)`.
 *
 * Sources:
 *   - `reusableLaunchSystems` discovered:   -1 (cheaper launch logistics)
 *   - `cislunarTransportNetwork` discovered: -1 (efficient transit corridors)
 */
export function computeSpaceSupplyCostReduction(techs: TechState[]): number {
  const REDUCING_TECHS = new Set(['reusableLaunchSystems', 'cislunarTransportNetwork']);
  let reduction = 0;
  for (const ts of techs) {
    if (ts.stage === 'discovered' && REDUCING_TECHS.has(ts.defId)) {
      reduction += 1;
    }
  }
  return reduction;
}
