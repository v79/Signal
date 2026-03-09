// =============================================================================
// SIGNAL — Core Type Definitions
// All game state is expressed in terms of these types.
// GameState is a plain JSON-serializable object — no class instances, no
// functions, no circular references. This guarantees free save/load and
// deterministic seeded runs.
// =============================================================================

// ---------------------------------------------------------------------------
// Primitives and enumerations
// ---------------------------------------------------------------------------

export type Seed = string;

/** The six research fields. Field points accumulate passively each turn. */
export type ResearchField =
  | 'physics'
  | 'mathematics'
  | 'engineering'
  | 'biochemistry'
  | 'computing'
  | 'socialScience';

export type FieldPoints = Record<ResearchField, number>;

/** The three player resources. */
export type ResourceKind = 'funding' | 'materials' | 'politicalWill';

export type Resources = Record<ResourceKind, number>;

/** The three game eras. Later eras unlock additional map layers. */
export type Era = 'earth' | 'nearSpace' | 'deepSpace';

/**
 * Push factor selected at game start.
 * Affects starting conditions and which events can appear.
 */
export type PushFactor = 'climateChange' | 'geopoliticalTension';

/** Will volatility model — differs by bloc type. */
export type WillProfile = 'democratic' | 'authoritarian';

/** The five turn phases, in order. */
export type TurnPhase = 'event' | 'draw' | 'action' | 'bank' | 'world';

// ---------------------------------------------------------------------------
// Hex map (Era 1 — Earth)
// ---------------------------------------------------------------------------

export type TileType =
  | 'urban'
  | 'industrial'
  | 'coastal'
  | 'highland'
  | 'forested'
  | 'arid'
  | 'agricultural';

/** Axial hex coordinates (q, r). */
export interface HexCoord {
  q: number;
  r: number;
}

/**
 * A tile that has been rendered permanently unusable by an environmental
 * or geopolitical event. Null means the tile is intact (though it may
 * still have reduced productivity).
 *
 * - flooded:    Coastal inundation from sea level rise (climate push factor)
 * - dustbowl:   Agricultural/forested tiles dried out by sustained drought
 * - irradiated: Contamination from industrial accident or conflict
 *               (more likely under geopolitical tension push factor)
 */
export type TileDestroyedStatus = 'flooded' | 'dustbowl' | 'irradiated';

export interface MapTile {
  coord: HexCoord;
  type: TileType;
  /** Null if intact; set when the tile is permanently taken out of use. */
  destroyedStatus: TileDestroyedStatus | null;
  /**
   * 0–1. Degrades over time due to climate change or resource exhaustion.
   * Affects productivity of facilities on this tile.
   */
  productivity: number;
  /** ID of the facility built here, if any. */
  facilityId: string | null;
  /**
   * ID of an OngoingAction currently in progress on this tile (construction
   * or demolition). Null when the tile is idle.
   */
  pendingActionId: string | null;
}

// ---------------------------------------------------------------------------
// Near Space map (Era 2)
// ---------------------------------------------------------------------------

export type SpaceNodeType = 'lowEarthOrbit' | 'lagrangePoint' | 'lunarOrbit' | 'lunarSurface';

export interface SpaceNode {
  id: string;
  type: SpaceNodeType;
  label: string;
  /** Launch cost in Materials to place a facility here. */
  launchCost: number;
  facilityId: string | null;
}

// ---------------------------------------------------------------------------
// Asteroid Belt / Deep Space map (Era 3)
// Node-graph, not a tile grid.
// ---------------------------------------------------------------------------

export type BeltNodeType = 'asteroid' | 'jovianMoon' | 'transitPoint' | 'heliopause' | 'wormhole';

export interface BeltNode {
  id: string;
  type: BeltNodeType;
  label: string;
  /** Whether this node has been prospected (revealed). */
  prospected: boolean;
  /** Estimated Materials output per turn if mined. Null until prospected. */
  materialYield: number | null;
  facilityId: string | null;
}

export interface BeltEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** Whether a transit route has been established between these nodes. */
  active: boolean;
  /** Materials cost to establish the route. */
  establishCost: number;
}

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

/**
 * Static definition for a facility type — lives in src/data/facilities.ts.
 * Contains all the rules; FacilityInstance holds runtime state.
 */
export interface FacilityDef {
  id: string;
  name: string;
  description: string;
  era: Era;
  /** Tile types this facility may be placed on. Empty = no restriction. */
  allowedTileTypes: TileType[];
  buildCost: Partial<Resources>;
  upkeepCost: Partial<Resources>;
  /** Turns to construct. 0 = instant (placed immediately). */
  buildTime: number;
  /** Turns to demolish. 0 = instant. */
  deleteTime: number;
  /** Whether this facility can be demolished by the player. False for HQ. */
  canDelete: boolean;
  /** Base field points generated per turn. */
  fieldOutput: Partial<FieldPoints>;
  /** Base resource delta per turn (positive = generated, negative = consumed). */
  resourceOutput: Partial<Resources>;
  /** Adjacency rules: pairs of [facilityDefId, effect]. */
  adjacencyBonuses: AdjacencyRule[];
  adjacencyPenalties: AdjacencyRule[];
  /** If true, the facility's Materials output depletes over time (mines). */
  depletes: boolean;
  /**
   * Tech def ID that must be discovered before this facility can be built.
   * Null means available from game start.
   */
  requiredTechId: string | null;
}

export interface AdjacencyRule {
  /** The facility def ID that triggers the rule when adjacent. */
  neighborDefId: string;
  /** Applied to both facilities involved in the adjacency. */
  fieldBonus?: Partial<FieldPoints>;
  resourceBonus?: Partial<Resources>;
  fieldPenalty?: Partial<FieldPoints>;
  resourcePenalty?: Partial<Resources>;
}

/** A facility that has been built and placed in the world. */
export interface FacilityInstance {
  id: string;
  defId: string;
  /** Location key: hex coord string for Earth, node ID for space/belt. */
  locationKey: string;
  /** 0–1. Degrades for depleting facilities (mines). */
  condition: number;
  /** Turn it was built. */
  builtTurn: number;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectType = 'landmark' | 'scientific' | 'commercial' | 'narrative';

/** Whether a landmark project gates an era transition. */
export type LandmarkGate =
  | 'unlocksNearSpaceAccess'
  | 'opensEra2'
  | 'opensEra3'
  | 'activatesBeltMap'
  | null;

export interface ProjectDef {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  era: Era;
  cost: Partial<Resources>;
  /** Additional per-turn resource cost while the project is in progress. */
  upkeepCost: Partial<Resources>;
  /** Estimated turns to complete (may vary with Will). */
  baseDuration: number;
  /** One-time rewards on completion. */
  reward: ProjectReward;
  /** Landmark gate this project opens, if any. */
  landmarkGate: LandmarkGate;
  /** Conditions that must be true for this project to be available. */
  prerequisites: ProjectPrerequisites;
}

export interface ProjectReward {
  resources?: Partial<Resources>;
  fields?: Partial<FieldPoints>;
  /** Card IDs added to the player's deck on completion. */
  unlocksCards?: string[];
  /** Signal decode progress added on completion. */
  signalProgress?: number;
  /** Narrative event ID fired on completion. */
  triggersEventId?: string;
}

export interface ProjectPrerequisites {
  era?: Era;
  /** Tech IDs that must be discovered. */
  requiredTechs?: string[];
  /** Facility def IDs that must exist on the map. */
  requiredFacilityDefs?: string[];
  /** Project IDs that must be completed. */
  requiredProjects?: string[];
  minResources?: Partial<Resources>;
}

export interface ProjectInstance {
  id: string;
  defId: string;
  startTurn: number;
  /** Turns elapsed since start. */
  turnsElapsed: number;
  /** Effective duration after Will modifier. */
  effectiveDuration: number;
}

// ---------------------------------------------------------------------------
// Research & Technology
// ---------------------------------------------------------------------------

/**
 * Static definition of a technology.
 * The actual recipe thresholds are generated per-run from the base shape
 * using the seeded RNG — see ResearchSystem.
 */
export interface TechDef {
  id: string;
  name: string;
  /** Flavour hint shown in research feed at Rumour stage. */
  rumourText: string;
  /** Base field requirements (before per-run randomisation). */
  baseRecipe: Partial<FieldPoints>;
  /**
   * Variance factor 0–1 applied to each field threshold during recipe
   * generation. 0 = no variance; 0.2 = ±20%.
   */
  recipeVariance: number;
  /** If true, ALL listed fields must reach threshold simultaneously. */
  requiresSimultaneous: boolean;
  /** Cards unlocked when this tech is discovered. */
  unlocksCards: string[];
  /** Projects unlocked when this tech is discovered. */
  unlocksProjects: string[];
  /** Facility defs unlocked when this tech is discovered. */
  unlocksFacilities: string[];
  /** Whether this tech can only be found via signal analysis. */
  signalDerived: boolean;
}

/** Per-run recipe generated from TechDef.baseRecipe + RNG. */
export type TechRecipe = Partial<FieldPoints>;

export type TechDiscoveryStage = 'unknown' | 'rumour' | 'progress' | 'discovered';

export interface TechState {
  defId: string;
  stage: TechDiscoveryStage;
  /** The randomised recipe for this run. Null until stage >= rumour. */
  recipe: TechRecipe | null;
  /** Turn the tech was discovered. Null if not yet discovered. */
  discoveredTurn: number | null;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardZone = 'deck' | 'hand' | 'bank' | 'discard';

export interface CardDef {
  id: string;
  name: string;
  description: string;
  /** Flavour text shown on card face. */
  flavourText: string;
  era: Era;
  /** The primary effect when played as an action. */
  effect: CardEffect;
  /**
   * Counter use: played reactively during Event phase against an event.
   * Null if this card has no counter function.
   */
  counterEffect: CounterEffect | null;
  /**
   * If set, this card replaces (upgrades) the listed card def ID when
   * the relevant technology is discovered.
   */
  upgradesFrom: string | null;
}

export interface CardEffect {
  resources?: Partial<Resources>;
  fields?: Partial<FieldPoints>;
  signalProgress?: number;
  /** Event IDs this card can trigger when played. */
  triggersEvent?: string;
  /** Description for effects that need custom engine logic. */
  customEffectKey?: string;
}

export interface CounterEffect {
  /** Event tag this card can counter. */
  countersEventTag: string;
  /** Cost paid when used as a counter (on top of normal play cost). */
  additionalCost: Partial<Resources>;
  /** Whether using as a counter fully neutralises the event. */
  fullNeutralise: boolean;
  /** Description for custom counter logic. */
  customEffectKey?: string;
}

/** A card instance in the player's collection. */
export interface CardInstance {
  id: string;
  defId: string;
  zone: CardZone;
  /** Turn this card entered the bank. Used to calculate decay cost. */
  bankedSinceTurn: number | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventResponseTier = 'fullCounter' | 'partialMitigation' | 'noCounter';

export interface EventDef {
  id: string;
  name: string;
  description: string;
  /** Flavour text for the event card. */
  flavourText: string;
  /**
   * Tags used to match counter cards and filter event pools.
   * e.g. 'crisis', 'diplomatic', 'climate', 'sabotage', 'scandal'
   */
  tags: string[];
  /** Which eras this event can appear in. */
  eras: Era[];
  /** Which push factors this event is limited to. Null = any. */
  pushFactors: PushFactor[] | null;
  /** Bloc IDs this event is limited to. Null = any bloc. */
  blocIds: string[] | null;
  /** Number of turns before the event resolves automatically. */
  countdownTurns: number;
  responseTier: EventResponseTier;
  /** Effect if the event is not countered / resolves unfavourably. */
  negativeEffect: EventEffect;
  /** Effect if the event is accepted (opportunity events). */
  positiveEffect: EventEffect | null;
  /** Partial mitigation cost (if responseTier is 'partialMitigation'). */
  mitigationCost?: Partial<Resources>;
  /** Mitigation reduces the negative effect by this fraction. */
  mitigationFactor?: number;
}

export interface EventEffect {
  resources?: Partial<Resources>;
  fields?: Partial<FieldPoints>;
  /** Destroy a tile: coord string + the status to apply. */
  destroyTile?: { coordKey: string; status: TileDestroyedStatus };
  /** Standing action IDs to restrict. */
  restrictActions?: string[];
  /** Number of turns the restriction lasts. */
  restrictionDuration?: number;
  /** Bloc ID to eliminate. */
  eliminateBloc?: string;
  signalProgress?: number;
  triggersEventId?: string;
  customEffectKey?: string;
}

export interface EventInstance {
  id: string;
  defId: string;
  /** Turn this event arrived. */
  arrivedTurn: number;
  /** Turns remaining before auto-resolution. */
  countdownRemaining: number;
  /** Whether the player has responded to this event. */
  resolved: boolean;
  resolvedWith: 'counter' | 'mitigation' | 'accepted' | 'expired' | null;
}

// ---------------------------------------------------------------------------
// Standing Actions
// ---------------------------------------------------------------------------

/** Standing actions are always available unless restricted by an event. */
export interface StandingActionDef {
  id: string;
  name: string;
  description: string;
  /** Resource cost to use. */
  cost: Partial<Resources>;
  /** Custom action key for engine dispatch. */
  actionKey: string;
}

export interface StandingActionRestriction {
  actionId: string;
  /** Turn the restriction expires. */
  expiresAfterTurn: number;
}

// ---------------------------------------------------------------------------
// Blocs (NPC simulation)
// ---------------------------------------------------------------------------

export type VictoryBias =
  | 'wormhole'
  | 'ecologicalRestoration'
  | 'economicHegemony'
  | 'terraforming'
  | 'obstruction'
  | 'wildcard';

export interface BlocDef {
  id: string;
  name: string;
  willProfile: WillProfile;
  victoryBias: VictoryBias;
  /** Starting resource levels (relative scale 0–100). */
  startingResources: Resources;
  /** Starting field point biases (head start in certain fields). */
  startingFields: Partial<FieldPoints>;
  /** Victory path cost modifiers. Values < 1 = cheaper for this bloc. */
  victoryCostModifiers: Partial<Record<VictoryBias, number>>;
  /** Event pool tags specific to this bloc. */
  specificEventTags: string[];
  /** Will ceiling (max achievable Will, 0–100). */
  willCeiling: number;
  /** Will floor — authoritarian collapse risk below this threshold. */
  willCollapsThreshold: number;
}

export interface BlocState {
  defId: string;
  /** 0–100. */
  resources: Resources;
  fields: FieldPoints;
  /** 0–100. */
  will: number;
  era: Era;
  /** True if this bloc has been eliminated. */
  eliminated: boolean;
  eliminatedTurn: number | null;
  /** IDs of projects this bloc has completed (for news ticker). */
  completedProjectIds: string[];
}

// ---------------------------------------------------------------------------
// Board (named characters)
// ---------------------------------------------------------------------------

export type BoardRole =
  | 'chiefScientist'
  | 'directorOfEngineering'
  | 'headOfFinance'
  | 'politicalLiaison'
  | 'directorOfOperations'
  | 'securityDirector'
  | 'signalAnalyst';

/** A character's buff or debuff expressed as modifiers to game outputs. */
export interface CharacterModifier {
  description: string;
  /** Field output multipliers (e.g. 1.15 = +15%). */
  fieldMultipliers?: Partial<FieldPoints>;
  /** Resource output multipliers per turn. */
  resourceMultipliers?: Partial<Resources>;
  /**
   * If set, this character automatically counters events with this tag
   * at no card cost (but other costs may still apply).
   */
  autoCountersEventTag?: string;
  customModifierKey?: string;
}

export interface BoardMemberDef {
  id: string;
  name: string;
  role: BoardRole;
  buffs: CharacterModifier[];
  debuffs: CharacterModifier[];
  /** Whether this is an AI board member (available only in Era 3). */
  isAI: boolean;
}

export interface BoardMemberInstance {
  id: string;
  defId: string;
  role: BoardRole;
  /** Game-start year is turn 1. Age in years. */
  age: number;
  /** Turn this character joined the board. */
  joinedTurn: number;
  /** Turn this character left the board (retired/resigned/died). Null if active. */
  leftTurn: number | null;
  leftReason: 'retired' | 'resigned' | 'died' | 'sacrificed' | null;
}

/** Board seats — a slot may be vacant. */
export type BoardSlots = Partial<Record<BoardRole, BoardMemberInstance>>;

// ---------------------------------------------------------------------------
// Signal Track
// ---------------------------------------------------------------------------

export type SignalEraStrength = 'faint' | 'structured' | 'urgent';

/**
 * The wormhole climax presents the player with candidate responses.
 * How many and how confident is determined by signal investment.
 */
export interface SignalResponseOption {
  id: string;
  label: string;
  /** Confidence indicator shown to player. null = no guidance. */
  confidenceHint: 'high' | 'medium' | 'low' | null;
  correct: boolean;
}

export interface SignalState {
  /** 0–100. Increases via facilities, projects, and Physics/Math fields. */
  decodeProgress: number;
  eraStrength: SignalEraStrength;
  /**
   * True once the player has committed to a response at the wormhole climax.
   * Locks the wormhole path open or closed.
   */
  responseCommitted: boolean;
  responseCorrect: boolean | null;
  /**
   * True once the wormhole has been activated (correct response committed).
   * A new belt node of type 'wormhole' is added to the belt map.
   */
  wormholeActivated: boolean;
}

// ---------------------------------------------------------------------------
// Victory & Loss
// ---------------------------------------------------------------------------

export type VictoryCondition =
  | 'wormhole'
  | 'ecologicalRestoration'
  | 'economicHegemony'
  | 'terraforming';

export type LossCondition =
  | 'climateCollapse'
  | 'signalMisinterpretation'
  | 'politicalCollapse'
  | 'resourceExhaustion';

export type MoralOutcome = 'abandonedEarth' | null;

export interface GameOutcome {
  type: 'victory' | 'loss';
  condition: VictoryCondition | LossCondition;
  turn: number;
  /** Moral outcome appended to post-game summary. */
  moralOutcome: MoralOutcome;
}

// ---------------------------------------------------------------------------
// Construction queue
// ---------------------------------------------------------------------------

export type OngoingActionType = 'construct' | 'demolish';

export interface OngoingAction {
  id: string;
  type: OngoingActionType;
  /** DefId of the facility being constructed or demolished. */
  facilityDefId: string;
  /** Axial coord key of the target Earth tile. */
  coordKey: string;
  turnsRemaining: number;
  /** Original duration, used to compute progress bar fraction. */
  totalTurns: number;
}

// ---------------------------------------------------------------------------
// Root game state
// ---------------------------------------------------------------------------

export interface PlayerState {
  blocDefId: string;
  resources: Resources;
  /** Accumulated research field points this run. */
  fields: FieldPoints;
  will: number;
  willProfile: WillProfile;
  facilities: FacilityInstance[];
  completedProjectIds: string[];
  activeProjects: ProjectInstance[];
  techs: TechState[];
  cards: CardInstance[];
  board: BoardSlots;
  /** News items queued for display in the ticker. */
  newsFeed: NewsItem[];
  activeEventRestrictions: StandingActionRestriction[];
  /** Active multi-turn construction and demolition tasks. */
  constructionQueue: OngoingAction[];
}

export interface NewsItem {
  id: string;
  turn: number;
  text: string;
}

export interface MapState {
  earthTiles: MapTile[];
  spaceNodes: SpaceNode[];
  beltNodes: BeltNode[];
  beltEdges: BeltEdge[];
}

export interface GameState {
  /** Seed string for this run. Drives all RNG. */
  seed: Seed;
  /** Current turn number (starts at 1). */
  turn: number;
  /** In-world year (cosmetic). Set at game start based on bloc/push factor. */
  year: number;
  era: Era;
  phase: TurnPhase;
  pushFactor: PushFactor;
  player: PlayerState;
  blocs: BlocState[];
  map: MapState;
  signal: SignalState;
  activeEvents: EventInstance[];
  /** Set when the game ends. */
  outcome: GameOutcome | null;
  /**
   * Earth welfare score 0–100. Tracked independently of player resources
   * to determine Abandoned Earth moral outcome.
   */
  earthWelfareScore: number;
  /**
   * Climate pressure level 0–100. Increases each turn; drives tile flooding
   * schedule and Earth welfare decay.
   */
  climatePressure: number;
}
