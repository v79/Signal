import type {
  GameState,
  CardDef,
  EventDef,
  StandingActionDef,
  FacilityDef,
  FacilityInstance,
  MapTile,
  TileType,
  FieldPoints,
} from '../../engine/types';
import { createGameState } from '../../engine/state';

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
    },
    map: {
      ...base.map,
      earthTiles,
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
let _selectedCoordKey = $state<string | null>(null);

export const gameStore = {
  get state(): GameState { return _state; },

  /** The coord key of the currently selected tile (UI state, not game state). */
  get selectedCoordKey(): string | null { return _selectedCoordKey; },

  selectTile(key: string | null): void {
    _selectedCoordKey = key;
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
};
