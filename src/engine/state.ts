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
    completedProjectIds: {},
    projectHostFacilityIds: {},
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
    tabSeen: {},
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

  if (!state.tabSeen) {
    const legacy = state as unknown as {
      nearSpaceTabSeen?: boolean;
      asteroidTabSeen?: boolean;
    };
    state.tabSeen = {};
    if (legacy.nearSpaceTabSeen === false) state.tabSeen.space = false;
    if (legacy.asteroidTabSeen === false) state.tabSeen.belt = false;
    delete legacy.nearSpaceTabSeen;
    delete legacy.asteroidTabSeen;
  }

  return state;
}

// ---------------------------------------------------------------------------
// Launch capacity
// ---------------------------------------------------------------------------

/**
 * Recompute total launch capacity from capacity-granting facilities and techs.
 *
 * Capacity sources:
 *   - spaceLaunchCentre (Earth):         +3 each
 *   - fuelDepot (cislunar/trojan):       +2 each
 *   - lunarLaunchFacility (lunar):       +2 each
 *   - lunarSpaceport (lunar upgrade):    +4 each
 *   - reusableLaunchSystems (tech):      +2
 *   - cislunarTransportNetwork (tech):   +2
 */
export interface LaunchCapacityBreakdown {
  total: number;
  entries: { label: string; amount: number }[];
}

const LAUNCH_CAPACITY_BY_DEF: Record<string, number> = {
  spaceLaunchCentre: 3,
  fuelDepot: 2,
  lunarLaunchFacility: 2,
  lunarSpaceport: 4,
};

const LAUNCH_FACILITY_LABELS: Record<string, string> = {
  spaceLaunchCentre: 'Space Launch Centre',
  fuelDepot: 'Fuel Depot',
  lunarLaunchFacility: 'Lunar Launch Facility',
  lunarSpaceport: 'Lunar Spaceport',
};

const LAUNCH_CAPACITY_TECHS: Record<string, string> = {
  reusableLaunchSystems: 'Reusable Launch Systems',
  cislunarTransportNetwork: 'Cislunar Transport Network',
};

export function computeLaunchCapacityBreakdown(
  facilities: FacilityInstance[],
  techs: TechState[],
): LaunchCapacityBreakdown {

  const entries: { label: string; amount: number }[] = [];
  let total = 0;

  // Aggregate by facility type
  const countByDef: Record<string, number> = {};
  for (const inst of facilities) {
    if (LAUNCH_CAPACITY_BY_DEF[inst.defId]) {
      countByDef[inst.defId] = (countByDef[inst.defId] ?? 0) + 1;
    }
  }
  for (const [defId, count] of Object.entries(countByDef)) {
    const amount = LAUNCH_CAPACITY_BY_DEF[defId] * count;
    entries.push({ label: count > 1 ? `${LAUNCH_FACILITY_LABELS[defId]} ×${count}` : LAUNCH_FACILITY_LABELS[defId], amount });
    total += amount;
  }

  for (const ts of techs) {
    if (ts.stage === 'discovered' && LAUNCH_CAPACITY_TECHS[ts.defId]) {
      entries.push({ label: LAUNCH_CAPACITY_TECHS[ts.defId], amount: 2 });
      total += 2;
    }
  }

  return { total, entries };
}

export function recomputeLaunchCapacity(
  facilities: FacilityInstance[],
  techs: TechState[],
): number {
  return computeLaunchCapacityBreakdown(facilities, techs).total;
}
