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
    turn: 1,
    year: config.startYear,
    era: 'earth' as Era,
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
    seenNarrativeIds: [],
    narrativeQueue: [],
    availableBoardDefIds: [],
    boardGracePeriodEnds: 4,
    committeeNotifications: [],
    boardProposalFired: false,
    orbitalStationAuthorised: false,
    orbitalStationDeferCount: 0,
    orbitalStationDeferResurfaceTurn: null,
  };
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

/** Serialise the full game state to a JSON string for save/load. */
export function serialiseGameState(state: GameState): string {
  return JSON.stringify(state);
}

/** Deserialise a JSON string back to a GameState. No migration yet. */
export function deserialiseGameState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
