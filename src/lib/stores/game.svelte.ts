import type {
  GameState,
  CardDef,
  EventDef,
  StandingActionDef,
  FacilityDef,
  FacilityInstance,
  BlocDef,
  BlocState,
  MapTile,
  TileType,
  BoardMemberDef,
  BoardRole,
  FieldPoints,
  SpaceNode,
  BeltNode,
  BeltEdge,
  Era,
} from '../../engine/types';
import { initialiseBlocStates } from '../../engine/blocs';
import { createGameState } from '../../engine/state';
import { createRng } from '../../engine/rng';
import {
  endBankPhase,
  executeWorldPhase,
  executeEventPhase,
  executeDrawPhase,
} from '../../engine/turn';
import { recruitBoardMember, removeBoardMember, isBoardSlotVacant } from '../../engine/board';
import { generateWormholeOptions, commitSignalResponse } from '../../engine/signal';
import type { SignalResponseOption } from '../../engine/types';

// ---------------------------------------------------------------------------
// Stub content definitions (replaced by src/data/ in the content pass)
// ---------------------------------------------------------------------------

export const STUB_CARD_DEFS: Map<string, CardDef> = new Map([
  ['lobbying', {
    id: 'lobbying',
    name: 'Political Lobbying',
    description: 'Rally political support for the programme.',
    flavourText: 'The corridors of power must be navigated carefully.',
    era: 'earth',
    effect: { resources: { politicalWill: 5 } },
    counterEffect: {
      countersEventTag: 'interference',
      additionalCost: { politicalWill: 10 },
      fullNeutralise: true,
    },
    upgradesFrom: null,
  }],
  ['emergencyProcurement', {
    id: 'emergencyProcurement',
    name: 'Emergency Procurement',
    description: 'Rush order for critical materials.',
    flavourText: 'No time for the usual channels.',
    era: 'earth',
    effect: { resources: { materials: 15, funding: -10 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['publicAppeal', {
    id: 'publicAppeal',
    name: 'Public Outreach',
    description: 'Broadcast the mission to the public.',
    flavourText: 'The people deserve to know what is at stake.',
    era: 'earth',
    effect: { resources: { politicalWill: 8, funding: 5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['academicConference', {
    id: 'academicConference',
    name: 'Academic Conference',
    description: 'Host international researchers.',
    flavourText: 'The best minds of a generation, gathered.',
    era: 'earth',
    effect: { fields: { physics: 8, mathematics: 6 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['coalitionBuilding', {
    id: 'coalitionBuilding',
    name: 'Coalition Building',
    description: 'Coordinate with allied pressure groups.',
    flavourText: 'There is strength in numbers.',
    era: 'earth',
    effect: { resources: { politicalWill: 12 } },
    counterEffect: {
      countersEventTag: 'scandal',
      additionalCost: { politicalWill: 5 },
      fullNeutralise: false,
    },
    upgradesFrom: null,
  }],
]);

export const STUB_EVENT_DEFS: Map<string, EventDef> = new Map([
  ['fundingCrisis', {
    id: 'fundingCrisis',
    name: 'Funding Crisis',
    description: 'Budget shortfall threatens operations.',
    flavourText: 'The finance committee is alarmed.',
    tags: ['crisis', 'funding'],
    eras: ['earth'],
    pushFactors: null,
    blocIds: null,
    countdownTurns: 3,
    responseTier: 'partialMitigation',
    negativeEffect: { resources: { funding: -30 } },
    positiveEffect: null,
    mitigationCost: { funding: 15 },
    mitigationFactor: 0.5,
  }],
  ['diplomaticOverture', {
    id: 'diplomaticOverture',
    name: 'Diplomatic Overture',
    description: 'A rival bloc proposes a materials deal.',
    flavourText: 'An offer has arrived through back channels.',
    tags: ['diplomatic'],
    eras: ['earth', 'nearSpace'],
    pushFactors: null,
    blocIds: null,
    countdownTurns: 2,
    responseTier: 'noCounter',
    negativeEffect: { resources: { politicalWill: -5 } },
    positiveEffect: { resources: { materials: 25 } },
  }],
  ['signalInterference', {
    id: 'signalInterference',
    name: 'Signal Interference',
    description: 'Atmospheric disturbances are corrupting signal readings.',
    flavourText: 'The transmission is becoming harder to distinguish from noise.',
    tags: ['signal', 'interference'],
    eras: ['earth'],
    pushFactors: null,
    blocIds: null,
    countdownTurns: 3,
    responseTier: 'partialMitigation',
    negativeEffect: { fields: { physics: -10, mathematics: -5 } },
    positiveEffect: null,
    mitigationCost: { funding: 20 },
    mitigationFactor: 0.5,
  }],
  ['signalBreakthrough', {
    id: 'signalBreakthrough',
    name: 'Signal Breakthrough',
    description: 'Analysts have isolated a coherent pattern in the transmission.',
    flavourText: 'The mathematics underlying the signal have become unmistakable.',
    tags: ['signal'],
    eras: ['nearSpace', 'deepSpace'],
    pushFactors: null,
    blocIds: null,
    countdownTurns: 2,
    responseTier: 'noCounter',
    negativeEffect: {},
    positiveEffect: { fields: { physics: 20, mathematics: 15 } },
  }],
]);

export const STUB_STANDING_ACTIONS: StandingActionDef[] = [
  { id: 'build',     name: 'Build',     description: 'Construct a facility on the map.',              cost: { materials: 20 },                    actionKey: 'build' },
  { id: 'recruit',   name: 'Recruit',   description: 'Hire a new board member.',                      cost: { funding: 15, politicalWill: 10 },   actionKey: 'recruit' },
  { id: 'trade',     name: 'Trade',     description: 'Exchange resources with a bloc.',               cost: { politicalWill: 5 },                 actionKey: 'trade' },
  { id: 'survey',    name: 'Survey',    description: 'Survey new territory or asteroid nodes.',       cost: { materials: 5 },                     actionKey: 'survey' },
  { id: 'negotiate', name: 'Negotiate', description: 'Conduct diplomatic negotiations with a bloc.',  cost: { funding: 10, politicalWill: 8 },    actionKey: 'negotiate' },
];

export const STUB_FACILITY_DEFS: Map<string, FacilityDef> = new Map([
  ['researchLab', {
    id: 'researchLab',
    name: 'Research Laboratory',
    description: 'Generates Physics and Mathematics field points each turn.',
    era: 'earth',
    allowedTileTypes: ['urban', 'highland'],
    buildCost: { funding: 30, materials: 10 },
    upkeepCost: { funding: 5 },
    fieldOutput: { physics: 3, mathematics: 2 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
  }],
  ['mine', {
    id: 'mine',
    name: 'Resource Mine',
    description: 'Extracts raw materials each turn. Output depletes over time.',
    era: 'earth',
    allowedTileTypes: ['highland', 'arid', 'industrial'],
    buildCost: { materials: 20 },
    upkeepCost: { funding: 2 },
    fieldOutput: {},
    resourceOutput: { materials: 8 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: true,
  }],
  ['solarFarm', {
    id: 'solarFarm',
    name: 'Solar Farm',
    description: 'Generates steady Funding and minor Engineering field points.',
    era: 'earth',
    allowedTileTypes: ['arid', 'agricultural', 'coastal'],
    buildCost: { materials: 15, funding: 10 },
    upkeepCost: {},
    fieldOutput: { engineering: 1 },
    resourceOutput: { funding: 5 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
  }],
  ['publicUniversity', {
    id: 'publicUniversity',
    name: 'Public University',
    description: 'Broad research output across multiple fields. High upkeep.',
    era: 'earth',
    allowedTileTypes: ['urban', 'agricultural'],
    buildCost: { funding: 50, materials: 5 },
    upkeepCost: { funding: 8, politicalWill: 2 },
    fieldOutput: { physics: 2, mathematics: 2, computing: 2, socialScience: 3 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
  }],
  ['engineeringWorks', {
    id: 'engineeringWorks',
    name: 'Engineering Works',
    description: 'Heavy manufacturing; generates Engineering and Materials.',
    era: 'earth',
    allowedTileTypes: ['industrial', 'urban'],
    buildCost: { funding: 20, materials: 30 },
    upkeepCost: { funding: 3 },
    fieldOutput: { engineering: 4 },
    resourceOutput: { materials: 4 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
  }],
  ['deepSpaceArray', {
    id: 'deepSpaceArray',
    name: 'Deep Space Array',
    description: 'Dedicated signal decoding infrastructure. Accelerates decode progress each turn.',
    era: 'earth',
    allowedTileTypes: ['highland', 'arid', 'coastal'],
    buildCost: { funding: 60, materials: 40 },
    upkeepCost: { funding: 8 },
    fieldOutput: { physics: 5, computing: 3 },
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
  }],
]);

export const STUB_BLOC_DEFS: Map<string, BlocDef> = new Map([
  ['northAmerica', {
    id: 'northAmerica',
    name: 'North American Alliance',
    willProfile: 'democratic',
    victoryBias: 'economicHegemony',
    startingResources: { funding: 80, materials: 60, politicalWill: 70 },
    startingFields: { engineering: 20, computing: 15 },
    victoryCostModifiers: {},
    specificEventTags: ['trade', 'technology'],
    willCeiling: 90,
    willCollapsThreshold: 0,
  }],
  ['eastAsia', {
    id: 'eastAsia',
    name: 'East Asian Consortium',
    willProfile: 'authoritarian',
    victoryBias: 'terraforming',
    startingResources: { funding: 70, materials: 80, politicalWill: 50 },
    startingFields: { engineering: 25, mathematics: 10 },
    victoryCostModifiers: {},
    specificEventTags: ['industrial', 'expansion'],
    willCeiling: 75,
    willCollapsThreshold: 15,
  }],
  ['southAmerica', {
    id: 'southAmerica',
    name: 'South American Union',
    willProfile: 'democratic',
    victoryBias: 'ecologicalRestoration',
    startingResources: { funding: 50, materials: 55, politicalWill: 65 },
    startingFields: { biochemistry: 15, socialScience: 10 },
    victoryCostModifiers: {},
    specificEventTags: ['environment', 'diplomatic'],
    willCeiling: 85,
    willCollapsThreshold: 0,
  }],
  ['africaCoalition', {
    id: 'africaCoalition',
    name: 'African Coalition',
    willProfile: 'democratic',
    victoryBias: 'wormhole',
    startingResources: { funding: 45, materials: 65, politicalWill: 60 },
    startingFields: { socialScience: 12, biochemistry: 8 },
    victoryCostModifiers: {},
    specificEventTags: ['diplomatic', 'environment'],
    willCeiling: 80,
    willCollapsThreshold: 0,
  }],
]);

// ---------------------------------------------------------------------------
// Map tile generation (deterministic, position-based)
// ---------------------------------------------------------------------------

const TILE_TYPES: TileType[] = ['urban', 'industrial', 'coastal', 'highland', 'forested', 'arid', 'agricultural'];
const EDGE_TYPES: TileType[] = ['coastal', 'coastal', 'forested', 'arid', 'highland', 'forested', 'coastal'];

function tileTypeForCoord(q: number, r: number): TileType {
  if (q === 0 && r === 0) return 'urban';
  const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  // Simple integer hash of (q, r) — no RNG needed, fully deterministic
  const h = ((q * 374761393 + r * 1073741827) ^ ((q * r) * 31337)) >>> 0;
  if (dist >= 3) return EDGE_TYPES[h % EDGE_TYPES.length];
  return TILE_TYPES[h % TILE_TYPES.length];
}

export function generateEarthTiles(radius = 3): MapTile[] {
  const tiles: MapTile[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      tiles.push({
        coord: { q, r },
        type: tileTypeForCoord(q, r),
        destroyedStatus: null,
        productivity: 1.0,
        facilityId: null,
      });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Space / Belt node generation (deterministic, fixed topology)
// ---------------------------------------------------------------------------

export function generateSpaceNodes(): SpaceNode[] {
  return [
    { id: 'leo',          type: 'lowEarthOrbit', label: 'LEO',           launchCost: 10, facilityId: null },
    { id: 'l1',           type: 'lagrangePoint', label: 'L1',            launchCost: 20, facilityId: null },
    { id: 'l2',           type: 'lagrangePoint', label: 'L2',            launchCost: 20, facilityId: null },
    { id: 'lunarOrbit',   type: 'lunarOrbit',    label: 'Lunar Orbit',   launchCost: 30, facilityId: null },
    { id: 'lunarSurface', type: 'lunarSurface',  label: 'Lunar Surface', launchCost: 45, facilityId: null },
  ];
}

export function generateBeltNodes(): BeltNode[] {
  return [
    { id: 'ceres',      type: 'asteroid',     label: 'Ceres',      prospected: true,  materialYield: 12,   facilityId: null },
    { id: 'vesta',      type: 'asteroid',     label: 'Vesta',      prospected: false, materialYield: null, facilityId: null },
    { id: 'psyche',     type: 'asteroid',     label: 'Psyche',     prospected: false, materialYield: null, facilityId: null },
    { id: 'europa',     type: 'jovianMoon',   label: 'Europa',     prospected: false, materialYield: null, facilityId: null },
    { id: 'ganymede',   type: 'jovianMoon',   label: 'Ganymede',   prospected: false, materialYield: null, facilityId: null },
    { id: 'trojans',    type: 'transitPoint', label: 'Trojans',    prospected: false, materialYield: null, facilityId: null },
    { id: 'heliopause', type: 'heliopause',   label: 'Heliopause', prospected: false, materialYield: null, facilityId: null },
  ];
}

export function generateBeltEdges(): BeltEdge[] {
  return [
    { id: 'e-ceres-vesta',        fromNodeId: 'ceres',    toNodeId: 'vesta',      active: false, establishCost: 15 },
    { id: 'e-ceres-psyche',       fromNodeId: 'ceres',    toNodeId: 'psyche',     active: false, establishCost: 15 },
    { id: 'e-ceres-ganymede',     fromNodeId: 'ceres',    toNodeId: 'ganymede',   active: false, establishCost: 25 },
    { id: 'e-vesta-europa',       fromNodeId: 'vesta',    toNodeId: 'europa',     active: false, establishCost: 20 },
    { id: 'e-psyche-trojans',     fromNodeId: 'psyche',   toNodeId: 'trojans',    active: false, establishCost: 20 },
    { id: 'e-psyche-heliopause',  fromNodeId: 'psyche',   toNodeId: 'heliopause', active: false, establishCost: 35 },
    { id: 'e-ganymede-heliopause',fromNodeId: 'ganymede', toNodeId: 'heliopause', active: false, establishCost: 30 },
  ];
}

// ---------------------------------------------------------------------------
// Stub board member definitions (replaced by src/data/ in the content pass)
// ---------------------------------------------------------------------------

export const STUB_BOARD_DEFS: Map<string, BoardMemberDef> = new Map([
  ['drRamirez', {
    id: 'drRamirez',
    name: 'Dr. Elena Ramirez',
    role: 'chiefScientist' as BoardRole,
    buffs: [{ description: '+20% Physics output per turn', fieldMultipliers: { physics: 1.2 } }],
    debuffs: [],
    isAI: false,
  }],
  ['ingMarkov', {
    id: 'ingMarkov',
    name: 'Ing. Pavel Markov',
    role: 'directorOfEngineering' as BoardRole,
    buffs: [
      { description: '+15% Materials income from facilities', resourceMultipliers: { materials: 1.15 } },
      { description: 'Auto-counters industrial accident events', autoCountersEventTag: 'industrial' },
    ],
    debuffs: [{ description: '-10% Funding income (bureaucratic friction)', resourceMultipliers: { funding: 0.9 } }],
    isAI: false,
  }],
  ['chairOsei', {
    id: 'chairOsei',
    name: 'Chair Abena Osei',
    role: 'politicalLiaison' as BoardRole,
    buffs: [
      { description: '+10% Political Will income', resourceMultipliers: { politicalWill: 1.1 } },
      { description: 'Auto-counters diplomatic interference', autoCountersEventTag: 'interference' },
    ],
    debuffs: [],
    isAI: false,
  }],
  ['drKowalski', {
    id: 'drKowalski',
    name: 'Dr. Tomasz Kowalski',
    role: 'headOfFinance' as BoardRole,
    buffs: [{ description: '+25% Funding income from facilities', resourceMultipliers: { funding: 1.25 } }],
    debuffs: [{ description: '-5% Materials income (cost controls)', resourceMultipliers: { materials: 0.95 } }],
    isAI: false,
  }],
  ['dirBristow', {
    id: 'dirBristow',
    name: 'Director J. Bristow',
    role: 'securityDirector' as BoardRole,
    buffs: [
      { description: 'Auto-counters security threat events', autoCountersEventTag: 'security' },
      { description: '+10% Computing field output', fieldMultipliers: { computing: 1.1 } },
    ],
    debuffs: [],
    isAI: false,
  }],
  ['drOkonkwo', {
    id: 'drOkonkwo',
    name: 'Dr. Chidi Okonkwo',
    role: 'signalAnalyst' as BoardRole,
    buffs: [
      { description: '+20% Mathematics output per turn', fieldMultipliers: { mathematics: 1.2 } },
      { description: '+15% Physics output per turn', fieldMultipliers: { physics: 1.15 } },
    ],
    debuffs: [],
    isAI: false,
  }],
  ['mgChen', {
    id: 'mgChen',
    name: 'Manager Liwei Chen',
    role: 'directorOfOperations' as BoardRole,
    buffs: [{ description: '+10% all facility resource output', resourceMultipliers: { funding: 1.1, materials: 1.1 } }],
    debuffs: [],
    isAI: false,
  }],
]);

// ---------------------------------------------------------------------------
// Demo initial state
// ---------------------------------------------------------------------------

function createDemoState(): GameState {
  const base = createGameState({
    seed: 'signal-demo',
    playerBlocDefId: 'eu',
    pushFactor: 'climateChange',
    startYear: 2025,
    willProfile: 'democratic',
    startingWill: 62,
    startingResources: { funding: 85, materials: 40, politicalWill: 55 },
    startingFields: { physics: 42, mathematics: 18, engineering: 65, computing: 38 } as Partial<FieldPoints>,
  });

  const earthTiles = generateEarthTiles(3);
  const blocs = initialiseBlocStates([...STUB_BLOC_DEFS.values()]);

  return {
    ...base,
    turn: 3,
    year: 2028,
    phase: 'action',
    climatePressure: 12,
    earthWelfareScore: 78,
    player: {
      ...base.player,
      cards: [
        { id: 'lobbying-1',             defId: 'lobbying',             zone: 'hand',  bankedSinceTurn: null },
        { id: 'emergencyProcurement-1', defId: 'emergencyProcurement', zone: 'hand',  bankedSinceTurn: null },
        { id: 'publicAppeal-1',         defId: 'publicAppeal',         zone: 'hand',  bankedSinceTurn: null },
        { id: 'academicConference-1',   defId: 'academicConference',   zone: 'bank',  bankedSinceTurn: 2 },
        { id: 'coalitionBuilding-1',    defId: 'coalitionBuilding',    zone: 'deck',  bankedSinceTurn: null },
        { id: 'lobbying-2',             defId: 'lobbying',             zone: 'deck',  bankedSinceTurn: null },
      ],
      newsFeed: [
        { id: 'news-1', turn: 1, text: 'Initial funding secured. Operations proceed as planned.' },
        { id: 'news-2', turn: 2, text: 'Something new is stirring in the research community.' },
        { id: 'news-3', turn: 3, text: 'Research into advanced engineering is showing concrete results.' },
      ],
      activeEventRestrictions: [
        { actionId: 'build', expiresAfterTurn: 3 },
      ],
      board: {
        chiefScientist: {
          id: 'drRamirez-t1', defId: 'drRamirez', role: 'chiefScientist' as BoardRole,
          age: 48, joinedTurn: 1, leftTurn: null, leftReason: null,
        },
        politicalLiaison: {
          id: 'chairOsei-t1', defId: 'chairOsei', role: 'politicalLiaison' as BoardRole,
          age: 55, joinedTurn: 1, leftTurn: null, leftReason: null,
        },
      },
    },
    blocs,
    map: {
      ...base.map,
      earthTiles,
      spaceNodes: generateSpaceNodes(),
      beltNodes:  generateBeltNodes(),
      beltEdges:  generateBeltEdges(),
    },
    activeEvents: [
      { id: 'fundingCrisis-t1',      defId: 'fundingCrisis',      arrivedTurn: 1, countdownRemaining: 2, resolved: false, resolvedWith: null },
      { id: 'diplomaticOverture-t3', defId: 'diplomaticOverture', arrivedTurn: 3, countdownRemaining: 1, resolved: false, resolvedWith: null },
    ],
  };
}

// ---------------------------------------------------------------------------
// Reactive game store (Svelte 5 runes — module-level $state)
// ---------------------------------------------------------------------------

let _state = $state<GameState>(createDemoState());

/** UI-only: which hex coord key is currently selected for facility placement. */
let _selectedCoordKey    = $state<string | null>(null);
let _selectedSpaceNodeId = $state<string | null>(null);
let _selectedBeltNodeId  = $state<string | null>(null);

export const gameStore = {
  get state(): GameState { return _state; },

  /** The coord key of the currently selected tile (UI state, not game state). */
  get selectedCoordKey():    string | null { return _selectedCoordKey; },
  get selectedSpaceNodeId(): string | null { return _selectedSpaceNodeId; },
  get selectedBeltNodeId():  string | null { return _selectedBeltNodeId; },

  selectTile(key: string | null): void { _selectedCoordKey = key; },
  selectSpaceNode(id: string | null): void { _selectedSpaceNodeId = id; },
  selectBeltNode(id: string | null): void { _selectedBeltNodeId = id; },

  /** Dev helper: advance era without going through the full landmark project system. */
  devAdvanceEra(): void {
    const ERA_SEQUENCE: Era[] = ['earth', 'nearSpace', 'deepSpace'];
    const idx = ERA_SEQUENCE.indexOf(_state.era);
    if (idx < ERA_SEQUENCE.length - 1) {
      _state = { ..._state, era: ERA_SEQUENCE[idx + 1] };
    }
  },

  buildFacility(coordKey: string, defId: string): void {
    const def = STUB_FACILITY_DEFS.get(defId);
    if (!def) return;

    const facilityId = `${defId}-${coordKey}-t${_state.turn}`;
    const newFacility: FacilityInstance = {
      id: facilityId,
      defId,
      locationKey: coordKey,
      condition: 1.0,
      builtTurn: _state.turn,
    };

    _state = {
      ..._state,
      player: {
        ..._state.player,
        resources: {
          funding:       Math.max(0, _state.player.resources.funding       - (def.buildCost.funding       ?? 0)),
          materials:     Math.max(0, _state.player.resources.materials     - (def.buildCost.materials     ?? 0)),
          politicalWill: Math.max(0, _state.player.resources.politicalWill - (def.buildCost.politicalWill ?? 0)),
        },
        facilities: [..._state.player.facilities, newFacility],
      },
      map: {
        ..._state.map,
        earthTiles: _state.map.earthTiles.map(t =>
          `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, facilityId } : t,
        ),
      },
    };
    _selectedCoordKey = null;
  },

  mitigateEvent(eventId: string): void {
    const event = _state.activeEvents.find(e => e.id === eventId);
    if (!event) return;
    const def = STUB_EVENT_DEFS.get(event.defId);
    const cost = def?.mitigationCost ?? {};
    _state = {
      ..._state,
      player: {
        ..._state.player,
        resources: {
          funding:       Math.max(0, _state.player.resources.funding       - (cost.funding       ?? 0)),
          materials:     Math.max(0, _state.player.resources.materials     - (cost.materials     ?? 0)),
          politicalWill: Math.max(0, _state.player.resources.politicalWill - (cost.politicalWill ?? 0)),
        },
      },
      activeEvents: _state.activeEvents.map(e =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'mitigation' as const } : e,
      ),
    };
  },

  acceptEvent(eventId: string): void {
    const event = _state.activeEvents.find(e => e.id === eventId);
    if (!event) return;
    const def = STUB_EVENT_DEFS.get(event.defId);
    const gain = def?.positiveEffect?.resources ?? {};
    _state = {
      ..._state,
      player: {
        ..._state.player,
        resources: {
          funding:       Math.max(0, _state.player.resources.funding       + (gain.funding       ?? 0)),
          materials:     Math.max(0, _state.player.resources.materials     + (gain.materials     ?? 0)),
          politicalWill: Math.max(0, _state.player.resources.politicalWill + (gain.politicalWill ?? 0)),
        },
      },
      activeEvents: _state.activeEvents.map(e =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'accepted' as const } : e,
      ),
    };
  },

  declineEvent(eventId: string): void {
    _state = {
      ..._state,
      activeEvents: _state.activeEvents.map(e =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'expired' as const } : e,
      ),
    };
  },

  playCard(cardId: string): void {
    const card = _state.player.cards.find(c => c.id === cardId);
    if (!card || card.zone !== 'hand') return;
    const def = STUB_CARD_DEFS.get(card.defId);
    if (!def) return;

    let resources = { ..._state.player.resources };
    if (def.effect.resources) {
      const r = def.effect.resources;
      resources = {
        funding:       Math.max(0, resources.funding       + (r.funding       ?? 0)),
        materials:     Math.max(0, resources.materials     + (r.materials     ?? 0)),
        politicalWill: Math.max(0, resources.politicalWill + (r.politicalWill ?? 0)),
      };
    }
    let fields = { ..._state.player.fields };
    if (def.effect.fields) {
      const f = def.effect.fields;
      for (const k of Object.keys(f) as (keyof FieldPoints)[]) {
        fields[k] = Math.max(0, (fields[k] ?? 0) + (f[k] ?? 0));
      }
    }
    _state = {
      ..._state,
      player: {
        ..._state.player,
        resources,
        fields,
        cards: _state.player.cards.map(c =>
          c.id === cardId ? { ...c, zone: 'discard' as const } : c,
        ),
      },
    };
  },

  bankCard(cardId: string): void {
    const bankedCount = _state.player.cards.filter(c => c.zone === 'bank').length;
    if (bankedCount >= 2) return;
    _state = {
      ..._state,
      player: {
        ..._state.player,
        cards: _state.player.cards.map(c =>
          c.id === cardId && c.zone === 'hand'
            ? { ...c, zone: 'bank' as const, bankedSinceTurn: _state.turn }
            : c,
        ),
      },
    };
  },

  unbankCard(cardId: string): void {
    _state = {
      ..._state,
      player: {
        ..._state.player,
        cards: _state.player.cards.map(c =>
          c.id === cardId && c.zone === 'bank'
            ? { ...c, zone: 'discard' as const, bankedSinceTurn: null }
            : c,
        ),
      },
    };
  },

  /**
   * Advance the game phase.
   *  action → bank  (instant, no engine calls)
   *  bank   → event → draw → action  (full World Phase + automated phases)
   */
  advancePhase(): void {
    if (_state.phase === 'action') {
      _state = { ..._state, phase: 'bank' };
      return;
    }
    if (_state.phase === 'bank') {
      // Each turn gets its own deterministic RNG slice derived from seed + turn number.
      const rng = createRng(`${_state.seed}-t${_state.turn}`);
      let next = endBankPhase(_state);
      next = executeWorldPhase(next, STUB_FACILITY_DEFS, new Map(), STUB_BLOC_DEFS, STUB_BOARD_DEFS);
      next = executeEventPhase(
        next,
        STUB_EVENT_DEFS,
        [...STUB_EVENT_DEFS.values()],
        rng,
      );
      next = executeDrawPhase(next, rng);
      _state = next;
    }
  },

  /** Recruit a board member. Deducts the recruit cost and adds the member to their role slot. */
  recruitMember(defId: string, startAge: number): void {
    const def = STUB_BOARD_DEFS.get(defId);
    if (!def) return;
    if (!isBoardSlotVacant(_state.player.board, def.role)) return;

    const RECRUIT_COST = { funding: 15, materials: 0, politicalWill: 10 };
    if (_state.player.resources.funding < RECRUIT_COST.funding) return;
    if (_state.player.resources.politicalWill < RECRUIT_COST.politicalWill) return;

    const newBoard = recruitBoardMember(_state.player.board, def, startAge, _state.turn);
    _state = {
      ..._state,
      player: {
        ..._state.player,
        resources: {
          ..._state.player.resources,
          funding:       _state.player.resources.funding       - RECRUIT_COST.funding,
          politicalWill: _state.player.resources.politicalWill - RECRUIT_COST.politicalWill,
        },
        board: newBoard,
        newsFeed: [
          ..._state.player.newsFeed,
          { id: `recruit-${defId}-t${_state.turn}`, turn: _state.turn, text: `${def.name} has joined the board as ${def.role}.` },
        ],
      },
    };
  },

  /** Remove a board member (resign or dismiss). */
  dismissMember(role: BoardRole): void {
    const newBoard = removeBoardMember(_state.player.board, role, 'resigned', _state.turn);
    _state = {
      ..._state,
      player: { ..._state.player, board: newBoard },
    };
  },

  /**
   * Generate wormhole response options for the signal climax.
   * Returns the options (caller should display them); does not mutate state.
   */
  getWormholeOptions(): SignalResponseOption[] {
    const rng = createRng(`${_state.seed}-wormhole`);
    return generateWormholeOptions(_state.signal, rng);
  },

  /** Commit the player's chosen wormhole response. */
  commitWormholeResponse(optionId: string, options: SignalResponseOption[]): void {
    const newSignal = commitSignalResponse(_state.signal, optionId, options);
    const text = newSignal.wormholeActivated
      ? 'The resonance pathway is open. The wormhole is activated.'
      : 'The response was incorrect. The signal locks closed. The opportunity is lost.';
    _state = {
      ..._state,
      signal: newSignal,
      player: {
        ..._state.player,
        newsFeed: [..._state.player.newsFeed, { id: `wormhole-t${_state.turn}`, turn: _state.turn, text }],
      },
    };
  },
};
