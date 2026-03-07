import type {
  GameState,
  FacilityInstance,
  BlocState,
  MapTile,
  TileType,
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
import { goto } from '$app/navigation';
import {
  endBankPhase,
  executeWorldPhase,
  executeEventPhase,
  executeDrawPhase,
} from '../../engine/turn';
import { recruitBoardMember, removeBoardMember, isBoardSlotVacant } from '../../engine/board';
import { generateWormholeOptions, commitSignalResponse } from '../../engine/signal';
import type { SignalResponseOption } from '../../engine/types';
import { autoSave, autoLoad, clearSave, exportSave, importSave } from '../../engine/save';
import { CARD_DEFS } from '../../data/cards';
import { EVENT_DEFS } from '../../data/events';
import { FACILITY_DEFS } from '../../data/facilities';
import { BLOC_DEFS } from '../../data/blocs';
import { BOARD_DEFS } from '../../data/board';
import { STANDING_ACTIONS } from '../../data/standingActions';

// ---------------------------------------------------------------------------
// Re-export data for components that import from this store
// ---------------------------------------------------------------------------

export { CARD_DEFS as CARD_DEFS } from '../../data/cards';
export { EVENT_DEFS as EVENT_DEFS } from '../../data/events';
export { STANDING_ACTIONS as STUB_STANDING_ACTIONS } from '../../data/standingActions';
export { BOARD_DEFS as BOARD_DEFS } from '../../data/board';

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
  const blocs = initialiseBlocStates([...BLOC_DEFS.values()]);

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

const _savedState = autoLoad();
let _state = $state<GameState>(_savedState ?? createDemoState());

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
    const def = FACILITY_DEFS.get(defId);
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
    const def = EVENT_DEFS.get(event.defId);
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
    const def = EVENT_DEFS.get(event.defId);
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
    const def = CARD_DEFS.get(card.defId);
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
   *
   * If the World Phase triggers a victory or loss, navigation to /summary
   * happens automatically after state is updated.
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
      next = executeWorldPhase(next, FACILITY_DEFS, new Map(), BLOC_DEFS, BOARD_DEFS);
      // If the game ended, skip the remaining automated phases and navigate.
      if (next.outcome) {
        _state = next;
        goto('/summary');
        return;
      }
      next = executeEventPhase(
        next,
        EVENT_DEFS,
        [...EVENT_DEFS.values()],
        rng,
      );
      next = executeDrawPhase(next, rng);
      _state = next;
      // Auto-save after each completed World Phase.
      autoSave(_state);
    }
  },

  /** Reset the game to a fresh demo state. */
  resetGame(): void {
    clearSave();
    _state = createDemoState();
    _selectedCoordKey    = null;
    _selectedSpaceNodeId = null;
    _selectedBeltNodeId  = null;
  },

  /** Download the current game state as a JSON file. */
  exportSave(): void {
    exportSave(_state);
  },

  /** Load a game state from a user-supplied JSON file. */
  async importSaveFile(file: File): Promise<void> {
    const loaded = await importSave(file);
    _state = loaded;
    _selectedCoordKey    = null;
    _selectedSpaceNodeId = null;
    _selectedBeltNodeId  = null;
  },

  /** Recruit a board member. Deducts the recruit cost and adds the member to their role slot. */
  recruitMember(defId: string, startAge: number): void {
    const def = BOARD_DEFS.get(defId);
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
