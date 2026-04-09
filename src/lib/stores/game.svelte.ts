import type {
  GameState,
  FacilityInstance,
  MapTile,
  TileType,
  BoardRole,
  FieldPoints,
  SpaceNode,
  BeltNode,
  BeltEdge,
  PushFactor,
  OngoingAction,
  NewsItem,
  TileActionDef,
  Era,
} from '../../engine/types';
import { initialiseBlocStates } from '../../engine/blocs';
import { createGameState, recomputeLaunchCapacity } from '../../engine/state';
import { createRng } from '../../engine/rng';
import { goto } from '$app/navigation';
import {
  endActionPhase,
  executeWorldPhase,
  executeEventPhase,
  executeDrawPhase,
} from '../../engine/turn';
import {
  recruitBoardMember,
  removeBoardMember,
  isBoardSlotVacant,
  resolveCommitteeNotification,
  dismissCommitteeNotification,
} from '../../engine/board';
import { generateWormholeOptions, commitSignalResponse } from '../../engine/signal';
import type { SignalResponseOption } from '../../engine/types';
import { autoSave, autoLoad, clearSave, exportSave, importSave } from '../../engine/save';
import { dismissNarrative, enqueueNarrative } from '../../engine/narrative';
import { initialiseTechs } from '../../engine/research';
import {
  applyEventEffect,
  getEffectForResolution,
  formatEffectForNews,
} from '../../engine/events';
import { getFacilitiesOnTile, findContiguousFreeStart, canUpgradeFacility } from '../../engine/facilities';
import { canInitiateProject, initiateProject } from '../../engine/projects';
import {
  BLOC_MAPS,
  BLOC_DEFS,
  BOARD_DEFS,
  CARD_DEFS,
  EVENT_DEFS,
  FACILITY_DEFS,
  PROJECT_DEFS,
  TECH_DEFS,
  TILE_ACTION_DEFS,
  NARRATIVE_SIGNAL_STRUCTURED,
  NARRATIVE_SIGNAL_URGENT,
  NARRATIVE_ERA_NEARSPACE,
  NARRATIVE_ERA_DEEPSPACE,
} from '../../data/loader';

// ---------------------------------------------------------------------------
// Re-export data for components that import from this store
// ---------------------------------------------------------------------------

export { CARD_DEFS, EVENT_DEFS, BOARD_DEFS } from '../../data/loader';

// ---------------------------------------------------------------------------
// Map tile generation — bloc-specific layouts from blocMaps.ts
// ---------------------------------------------------------------------------

export function generateEarthTilesForBloc(blocDefId: string): MapTile[] {
  const layout = BLOC_MAPS[blocDefId];
  if (!layout) {
    // Fallback: single urban tile at origin (should not happen in practice)
    return [
      {
        coord: { q: 0, r: 0 },
        type: 'urban',
        destroyedStatus: null,
        productivity: 1.0,
        mineDepletion: 1.0,
        facilitySlots: [null, null, null] as [null, null, null],
        pendingActionId: null,
      },
    ];
  }
  return layout.map((entry) => ({
    coord: { q: entry.q, r: entry.r },
    type: entry.type,
    destroyedStatus: null,
    productivity: 1.0,
    mineDepletion: 1.0,
    facilitySlots: [null, null, null] as [null, null, null],
    pendingActionId: null,
  }));
}

// Keep the old name as an alias for backward compatibility with tests
export function generateEarthTiles(radius = 3): MapTile[] {
  // Legacy procedural generation — used only in tests that haven't been updated yet
  const TILE_TYPES: TileType[] = [
    'urban',
    'industrial',
    'coastal',
    'highland',
    'forested',
    'arid',
    'agricultural',
  ];
  const EDGE_TYPES: TileType[] = [
    'coastal',
    'coastal',
    'forested',
    'arid',
    'highland',
    'forested',
    'coastal',
  ];
  function tileTypeForCoord(q: number, r: number): TileType {
    if (q === 0 && r === 0) return 'urban';
    const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    const h = ((q * 374761393 + r * 1073741827) ^ (q * r * 31337)) >>> 0;
    if (dist >= 3) return EDGE_TYPES[h % EDGE_TYPES.length];
    return TILE_TYPES[h % TILE_TYPES.length];
  }
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
        mineDepletion: 1.0,
        facilitySlots: [null, null, null] as [null, null, null],
        pendingActionId: null,
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
    { id: 'leo', type: 'lowEarthOrbit', label: 'LEO', launchCost: 10, facilityId: null },
    { id: 'l1', type: 'lagrangePoint', label: 'L1', launchCost: 20, facilityId: null },
    { id: 'l2', type: 'lagrangePoint', label: 'L2', launchCost: 20, facilityId: null },
    {
      id: 'lunarSurface',
      type: 'lunarSurface',
      label: 'Lunar Surface',
      launchCost: 45,
      facilityId: null,
    },
  ];
}

export function generateBeltNodes(): BeltNode[] {
  return [
    {
      id: 'ceres',
      type: 'asteroid',
      label: 'Ceres',
      prospected: true,
      materialYield: 12,
      facilityId: null,
    },
    {
      id: 'vesta',
      type: 'asteroid',
      label: 'Vesta',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
    {
      id: 'psyche',
      type: 'asteroid',
      label: 'Psyche',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
    {
      id: 'europa',
      type: 'jovianMoon',
      label: 'Europa',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
    {
      id: 'ganymede',
      type: 'jovianMoon',
      label: 'Ganymede',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
    {
      id: 'trojans',
      type: 'transitPoint',
      label: 'Trojans',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
    {
      id: 'heliopause',
      type: 'heliopause',
      label: 'Heliopause',
      prospected: false,
      materialYield: null,
      facilityId: null,
    },
  ];
}

export function generateBeltEdges(): BeltEdge[] {
  return [
    {
      id: 'e-ceres-vesta',
      fromNodeId: 'ceres',
      toNodeId: 'vesta',
      active: false,
      establishCost: 15,
    },
    {
      id: 'e-ceres-psyche',
      fromNodeId: 'ceres',
      toNodeId: 'psyche',
      active: false,
      establishCost: 15,
    },
    {
      id: 'e-ceres-ganymede',
      fromNodeId: 'ceres',
      toNodeId: 'ganymede',
      active: false,
      establishCost: 25,
    },
    {
      id: 'e-vesta-europa',
      fromNodeId: 'vesta',
      toNodeId: 'europa',
      active: false,
      establishCost: 20,
    },
    {
      id: 'e-psyche-trojans',
      fromNodeId: 'psyche',
      toNodeId: 'trojans',
      active: false,
      establishCost: 20,
    },
    {
      id: 'e-psyche-heliopause',
      fromNodeId: 'psyche',
      toNodeId: 'heliopause',
      active: false,
      establishCost: 35,
    },
    {
      id: 'e-ganymede-heliopause',
      fromNodeId: 'ganymede',
      toNodeId: 'heliopause',
      active: false,
      establishCost: 30,
    },
  ];
}

// ---------------------------------------------------------------------------
// Reactive game store (Svelte 5 runes — module-level $state)
// ---------------------------------------------------------------------------

const _savedState = autoLoad();
let _state = $state<GameState | null>(_savedState ?? null);

/** Assign new game state and persist it to localStorage in one step. */
function mutateState(newState: GameState): void {
  _state = newState;
  autoSave(newState);
}

/** UI-only: which hex coord key is currently selected for facility placement. */
let _selectedCoordKey = $state<string | null>(null);
let _selectedSpaceNodeId = $state<string | null>(null);
let _selectedBeltNodeId = $state<string | null>(null);
/** UI-only: the coord key of the tile currently under the mouse cursor. */
let _hoveredTileKey = $state<string | null>(null);

function resetSelections(): void {
  _selectedCoordKey = null;
  _selectedSpaceNodeId = null;
  _selectedBeltNodeId = null;
}

function computeRemainingCapacity(state: GameState): number {
  const allocated = state.map.spaceNodes
    .filter((n) => {
      if (!n.facilityId) return false;
      if (state.launchAllocation[n.id] === false) return false;
      if (state.isruOperational && n.type === 'lunarSurface') return false;
      return true;
    })
    .reduce((sum, n) => {
      const def = FACILITY_DEFS.get(n.facilityId!);
      return sum + (def?.supplyCost ?? 0);
    }, 0);
  return state.launchCapacity - allocated;
}

export const gameStore = {
  get state(): GameState | null {
    return _state;
  },

  /** The coord key of the currently selected tile (UI state, not game state). */
  get selectedCoordKey(): string | null {
    return _selectedCoordKey;
  },
  get selectedSpaceNodeId(): string | null {
    return _selectedSpaceNodeId;
  },
  get selectedBeltNodeId(): string | null {
    return _selectedBeltNodeId;
  },
  get hoveredTileKey(): string | null {
    return _hoveredTileKey;
  },

  selectTile(key: string | null): void {
    _selectedCoordKey = key;
  },
  selectSpaceNode(id: string | null): void {
    _selectedSpaceNodeId = id;
  },
  selectBeltNode(id: string | null): void {
    _selectedBeltNodeId = id;
  },
  setHoveredTile(key: string | null): void {
    _hoveredTileKey = key;
  },

  /**
   * Initialise a fresh game run from the new-game setup screen.
   * Replaces any existing save, builds the full initial state from the chosen
   * bloc + push factor, deals the opening hand, then navigates to `/`.
   */
  startNewGame(seed: string, playerBlocDefId: string, pushFactor: PushFactor, startEra: Era = 'earth'): void {
    const bloc = BLOC_DEFS.get(playerBlocDefId);
    if (!bloc) return;

    // Dev: starting in a later era jumps the calendar forward.
    const startYear = startEra === 'earth' ? 1970 : startEra === 'nearSpace' ? 2030 : 2060;
    const startTurn = startYear - 1970 + 1;

    const base = createGameState({
      seed,
      playerBlocDefId,
      pushFactor,
      startYear,
      startTurn,
      startEra,
      willProfile: bloc.willProfile,
      startingWill: Math.round(bloc.willCeiling * 0.7),
      startingResources: { ...bloc.startingResources },
      startingFields: bloc.startingFields
        ? ({ ...bloc.startingFields } as Partial<FieldPoints>)
        : undefined,
    });

    // Seed-shuffle all candidates so each run presents them in a different order.
    // candidateForRole() picks the first unoccupied match, so the shuffle determines
    // which candidate appears after a retirement — giving run variety without
    // permanently locking anyone out.
    const poolRng = createRng(`${seed}-board-pool`);
    const availableBoardDefIds = poolRng.shuffle([...BOARD_DEFS.keys()]);

    const starterCards: GameState['player']['cards'] = [
      { id: 'lobbying-1', defId: 'lobbying', zone: 'deck', bankedSinceTurn: null },
      { id: 'lobbying-2', defId: 'lobbying', zone: 'deck', bankedSinceTurn: null },
      { id: 'publicAppeal-1', defId: 'publicAppeal', zone: 'deck', bankedSinceTurn: null },
      { id: 'emergencyProcurement-1', defId: 'emergencyProcurement', zone: 'deck', bankedSinceTurn: null },
      { id: 'coalitionBuilding-1', defId: 'coalitionBuilding', zone: 'deck', bankedSinceTurn: null },
      { id: 'emergencyAppeal-1', defId: 'emergencyAppeal', zone: 'deck', bankedSinceTurn: null },
      { id: 'emergencySourcing-1', defId: 'emergencySourcing', zone: 'deck', bankedSinceTurn: null },
      { id: 'academicConference-1', defId: 'academicConference', zone: 'deck', bankedSinceTurn: null },
      { id: 'voxPopuli-1', defId: 'voxPopuli', zone: 'deck', bankedSinceTurn: null },
      { id: 'jungleExpedition-1', defId: 'jungleExpedition', zone: 'deck', bankedSinceTurn: null },
      { id: 'peerReview-1', defId: 'peerReview', zone: 'deck', bankedSinceTurn: null },
      { id: 'industrialContracts-1', defId: 'industrialContracts', zone: 'deck', bankedSinceTurn: null },
      { id: 'backChannelNegotiation-1', defId: 'backChannelNegotiation', zone: 'deck', bankedSinceTurn: null },
      { id: 'contingencyRouting-1', defId: 'contingencyRouting', zone: 'deck', bankedSinceTurn: null },
      { id: 'executiveOverride-1', defId: 'executiveOverride', zone: 'deck', bankedSinceTurn: null },
    ];

    // Tech recipes are generated with a dedicated RNG slice so they are
    // independent of the draw-phase RNG. Order in canonical PRNG sequence:
    //   1. createRng(`${seed}-techs`)  → tech recipe generation (game start only)
    //   2. createRng(`${seed}-t1`)     → opening draw phase
    const techRng = createRng(`${seed}-techs`);
    // Dev: if starting in a later era, pre-discover all techs from prior eras.
    const preDiscoverEra = startEra !== 'earth' ? 'earth' : undefined;
    const techs = initialiseTechs([...TECH_DEFS.values()], techRng, preDiscoverEra);

    // Narrative news items seeded at game start:
    //   Turn 1 (1970): programme initiated.
    //   Turn 2 (1971): the Signal is first detected — classified.
    const openingNews: GameState['player']['newsFeed'] = [
      {
        id: 'signal-origin-0',
        turn: 1,
        text: '1970 — Programme initiated. Our remit: achieve strategic parity in space operations and pursue the source of the anomalous transmission.',
      },
      {
        id: 'signal-origin-1',
        turn: 2,
        text: '1971 — CLASSIFIED. Radio telescope array has recorded a structured 21 cm transmission of apparent non-terrestrial origin. Source: beyond the heliopause. Repetition interval: 73.6 hours. Assessment: not natural. Distribution: programme directors only.',
      },
    ];

    // Generate Earth tiles from bloc-specific layout, then place HQ at (0,0).
    const earthTiles = generateEarthTilesForBloc(playerBlocDefId);
    const hqFacilityId = 'hq-0,0';
    const hqFacility: FacilityInstance = {
      id: hqFacilityId,
      defId: 'hq',
      locationKey: '0,0',
      condition: 1.0,
      builtTurn: 0,
    };
    let tilesWithHq = earthTiles.map((t) =>
      t.coord.q === 0 && t.coord.r === 0
        ? { ...t, facilitySlots: [hqFacilityId, hqFacilityId, hqFacilityId] as [string, string, string] }
        : t,
    );

    // Dev: if starting in a later era, pre-place a Space Launch Centre on a
    // suitable Earth tile so the player has launch capacity from the start.
    const initialFacilities: FacilityInstance[] = [hqFacility];
    if (startEra !== 'earth') {
      const slcDef = FACILITY_DEFS.get('spaceLaunchCentre');
      const slotCost = slcDef?.slotCost ?? 3;
      const allowedTypes = slcDef?.allowedTileTypes ?? ['arid', 'agricultural'];

      // Find first suitable tile: correct type, not HQ, has enough free slots.
      // Fall back to any non-HQ tile with slots if no typed tile found.
      const slcTile =
        tilesWithHq.find(
          (t) =>
            !(t.coord.q === 0 && t.coord.r === 0) &&
            allowedTypes.includes(t.type) &&
            findContiguousFreeStart(t.facilitySlots, slotCost) !== null,
        ) ??
        tilesWithHq.find(
          (t) =>
            !(t.coord.q === 0 && t.coord.r === 0) &&
            findContiguousFreeStart(t.facilitySlots, slotCost) !== null,
        );

      if (slcTile) {
        const startSlot = findContiguousFreeStart(slcTile.facilitySlots, slotCost)!;
        const slcId = `slc-dev-${slcTile.coord.q},${slcTile.coord.r}`;
        const newSlots = [...slcTile.facilitySlots] as typeof slcTile.facilitySlots;
        for (let i = startSlot; i < startSlot + slotCost; i++) {
          newSlots[i] = slcId;
        }
        tilesWithHq = tilesWithHq.map((t) =>
          t.coord.q === slcTile.coord.q && t.coord.r === slcTile.coord.r
            ? { ...t, facilitySlots: newSlots }
            : t,
        );
        initialFacilities.push({
          id: slcId,
          defId: 'spaceLaunchCentre',
          locationKey: `${slcTile.coord.q},${slcTile.coord.r}`,
          condition: 1.0,
          builtTurn: 0,
        });
      }
    }
    const devLaunchCapacity = recomputeLaunchCapacity(initialFacilities, techs);

    // Pre-fill Head of Finance and Director of Operations at game start.
    const financeDefId = availableBoardDefIds.find((id) => BOARD_DEFS.get(id)?.role === 'headOfFinance') ?? 'drKowalski';
    const opsDefId = availableBoardDefIds.find((id) => BOARD_DEFS.get(id)?.role === 'directorOfOperations') ?? 'mgChen';
    const financeDef = BOARD_DEFS.get(financeDefId)!;
    const opsDef = BOARD_DEFS.get(opsDefId)!;
    let starterBoard = recruitBoardMember({}, financeDef, financeDef.startAge, 1);
    starterBoard = recruitBoardMember(starterBoard, opsDef, opsDef.startAge, 1);

    let next: GameState = {
      ...base,
      availableBoardDefIds,
      boardGracePeriodEnds: 4,
      launchCapacity: devLaunchCapacity,
      player: {
        ...base.player,
        cards: starterCards,
        techs,
        newsFeed: openingNews,
        facilities: initialFacilities,
        board: starterBoard,
      },
      blocs: initialiseBlocStates([...BLOC_DEFS.values()]),
      map: {
        ...base.map,
        earthTiles: tilesWithHq,
        spaceNodes: generateSpaceNodes(),
        beltNodes: generateBeltNodes(),
        beltEdges: generateBeltEdges(),
      },
    };

    // Deal the opening hand using the seeded RNG.
    const drawRng = createRng(`${seed}-t1`);
    next = executeDrawPhase(next, drawRng);

    clearSave();
    mutateState(next);
    resetSelections();
    goto('/');
  },

  buildFacility(coordKey: string, defId: string): void {
    if (!_state) return;
    const def = FACILITY_DEFS.get(defId);
    if (!def) return;

    // HQ is placed at game start only — never buildable by the player.
    if (def.id === 'hq') return;

    // Building costs an action slot.
    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    // Cannot build on a destroyed tile.
    const tile = _state.map.earthTiles.find(
      (t) => `${t.coord.q},${t.coord.r}` === coordKey,
    );
    if (!tile || tile.destroyedStatus !== null) return;

    // Cannot build if a construction/demolition is already in progress on this tile.
    if (tile.pendingActionId != null) return;

    // Tech gate: refuse if the required technology has not been discovered.
    if (def.requiredTechId != null) {
      const techDiscovered = _state.player.techs.some(
        (t) => t.defId === def.requiredTechId && t.stage === 'discovered',
      );
      if (!techDiscovered) return;
    }

    // Duplicate check: reject if this defId is already present on the tile.
    const tileInstances = getFacilitiesOnTile(tile, _state.player.facilities);
    if (tileInstances.some((f) => f.defId === defId)) return;

    // Find first contiguous free slot start.
    const slotCost = def.slotCost ?? 1;
    const start = findContiguousFreeStart(tile.facilitySlots, slotCost);
    if (start === null) return;

    // Deduct build cost up-front regardless of whether construction is instant.
    const newResources = {
      funding: _state.player.resources.funding - (def.buildCost.funding ?? 0),
      materials: Math.max(0, _state.player.resources.materials - (def.buildCost.materials ?? 0)),
      politicalWill: Math.max(
        0,
        _state.player.resources.politicalWill - (def.buildCost.politicalWill ?? 0),
      ),
    };
    const newActionsThisTurn = (_state.actionsThisTurn ?? 0) + 1;

    if (def.buildTime === 0) {
      // Instant build
      const facilityId = `${defId}-${coordKey}-t${_state.turn}`;
      const newFacility: FacilityInstance = {
        id: facilityId,
        defId,
        locationKey: coordKey,
        condition: def.depletes ? tile.mineDepletion : 1.0,
        builtTurn: _state.turn,
      };
      const newSlots = [...tile.facilitySlots] as [string | null, string | null, string | null];
      for (let i = start; i < start + slotCost; i++) {
        newSlots[i] = facilityId;
      }
      mutateState({
        ..._state,
        actionsThisTurn: newActionsThisTurn,
        player: {
          ..._state.player,
          resources: newResources,
          facilities: [..._state.player.facilities, newFacility],
        },
        map: {
          ..._state.map,
          earthTiles: _state.map.earthTiles.map((t) =>
            `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, facilitySlots: newSlots } : t,
          ),
        },
      });
    } else {
      // Multi-turn build: enqueue action, mark tile as pending.
      const actionId = `construct-${defId}-${coordKey}-t${_state.turn}`;
      const action: OngoingAction = {
        id: actionId,
        type: 'construct',
        facilityDefId: defId,
        coordKey,
        turnsRemaining: def.buildTime,
        totalTurns: def.buildTime,
        slotIndex: start,
      };
      mutateState({
        ..._state,
        actionsThisTurn: newActionsThisTurn,
        player: {
          ..._state.player,
          resources: newResources,
          constructionQueue: [..._state.player.constructionQueue, action],
        },
        map: {
          ..._state.map,
          earthTiles: _state.map.earthTiles.map((t) =>
            `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, pendingActionId: actionId } : t,
          ),
        },
      });
    }
    _selectedCoordKey = null;
  },

  demolishFacility(coordKey: string, slotIndex: number): void {
    if (!_state) return;
    const tile = _state.map.earthTiles.find((t) => `${t.coord.q},${t.coord.r}` === coordKey);
    if (!tile) return;
    const instanceId = tile.facilitySlots[slotIndex];
    if (!instanceId) return;
    const facility = _state.player.facilities.find((f) => f.id === instanceId);
    if (!facility) return;
    const def = FACILITY_DEFS.get(facility.defId);
    if (!def?.canDelete) return;

    if (def.deleteTime === 0) {
      // Instant demolition: clear all slots containing this instance ID
      const newSlots = tile.facilitySlots.map((s) =>
        s === instanceId ? null : s,
      ) as [string | null, string | null, string | null];
      mutateState({
        ..._state,
        player: {
          ..._state.player,
          facilities: _state.player.facilities.filter((f) => f.id !== instanceId),
        },
        map: {
          ..._state.map,
          earthTiles: _state.map.earthTiles.map((t) =>
            `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, facilitySlots: newSlots } : t,
          ),
        },
      });
    } else {
      // Multi-turn demolition: enqueue, mark tile as pending.
      const actionId = `demolish-${facility.defId}-${coordKey}-t${_state.turn}`;
      const action: OngoingAction = {
        id: actionId,
        type: 'demolish',
        facilityDefId: facility.defId,
        coordKey,
        turnsRemaining: def.deleteTime,
        totalTurns: def.deleteTime,
        slotIndex,
      };
      mutateState({
        ..._state,
        player: {
          ..._state.player,
          constructionQueue: [..._state.player.constructionQueue, action],
        },
        map: {
          ..._state.map,
          earthTiles: _state.map.earthTiles.map((t) =>
            `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, pendingActionId: actionId } : t,
          ),
        },
      });
    }
    _selectedCoordKey = null;
  },

  /**
   * Enqueue a tile action (terrain modification) on the given tile.
   * Costs an action slot and deducts resources up-front.
   */
  enqueueTileAction(coordKey: string, tileActionDefId: string): void {
    if (!_state) return;
    const taDef = TILE_ACTION_DEFS.get(tileActionDefId);
    if (!taDef) return;

    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    const tile = _state.map.earthTiles.find((t) => `${t.coord.q},${t.coord.r}` === coordKey);
    if (!tile || tile.pendingActionId != null) return;

    // Tech gate
    if (taDef.requiredTechId != null) {
      const techDiscovered = _state.player.techs.some(
        (t) => t.defId === taDef.requiredTechId && t.stage === 'discovered',
      );
      if (!techDiscovered) return;
    }

    // Deduct cost up-front
    const newResources = {
      funding: _state.player.resources.funding - (taDef.buildCost.funding ?? 0),
      materials: Math.max(0, _state.player.resources.materials - (taDef.buildCost.materials ?? 0)),
      politicalWill: Math.max(0, _state.player.resources.politicalWill - (taDef.buildCost.politicalWill ?? 0)),
    };

    const actionId = `tileAction-${tileActionDefId}-${coordKey}-t${_state.turn}`;
    const action: OngoingAction = {
      id: actionId,
      type: 'tileAction',
      facilityDefId: '',
      coordKey,
      turnsRemaining: taDef.buildTime,
      totalTurns: taDef.buildTime,
      slotIndex: 0,
      tileActionDefId,
    };

    mutateState({
      ..._state,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
      player: {
        ..._state.player,
        resources: newResources,
        constructionQueue: [..._state.player.constructionQueue, action],
      },
      map: {
        ..._state.map,
        earthTiles: _state.map.earthTiles.map((t) =>
          `${t.coord.q},${t.coord.r}` === coordKey ? { ...t, pendingActionId: actionId } : t,
        ),
      },
    });
    _selectedCoordKey = null;
  },

  mitigateEvent(eventId: string): void {
    if (!_state) return;
    const event = _state.activeEvents.find((e) => e.id === eventId);
    if (!event) return;
    const def = EVENT_DEFS.get(event.defId);
    if (!def) return;

    // Deduct the mitigation cost from resources
    const cost = def.mitigationCost ?? {};

    // Afford check: materials and Will cannot go negative
    if ((cost.materials ?? 0) > 0 && _state.player.resources.materials < (cost.materials ?? 0)) return;
    if ((cost.politicalWill ?? 0) > 0 && _state.player.resources.politicalWill < (cost.politicalWill ?? 0)) return;

    let playerAfterCost = {
      ..._state.player,
      resources: {
        funding: _state.player.resources.funding - (cost.funding ?? 0),
        materials: Math.max(0, _state.player.resources.materials - (cost.materials ?? 0)),
        politicalWill: Math.max(
          0,
          _state.player.resources.politicalWill - (cost.politicalWill ?? 0),
        ),
      },
    };

    // Apply the residual (mitigated) negative effect
    const residualEffect = getEffectForResolution(def, 'mitigation');
    let updatedTiles = _state.map.earthTiles;
    if (residualEffect) {
      const eventRng = createRng(`${_state.seed}-mitigate-${eventId}-t${_state.turn}`);
      const result = applyEventEffect(residualEffect, playerAfterCost, updatedTiles, _state.turn, eventRng);
      playerAfterCost = result.player;
      updatedTiles = result.mapTiles;
    }

    // News item
    const costParts: string[] = [];
    if (cost.funding) costParts.push(`Funding -${cost.funding}`);
    if (cost.materials) costParts.push(`Materials -${cost.materials}`);
    if (cost.politicalWill) costParts.push(`Political Will -${cost.politicalWill}`);
    const residualSummary = residualEffect ? ` — residual: ${formatEffectForNews(residualEffect)}` : '';
    const newsText = `${def.name} mitigated (cost: ${costParts.join(', ')})${residualSummary}.`;

    mutateState({
      ..._state,
      map: { ..._state.map, earthTiles: updatedTiles },
      player: {
        ...playerAfterCost,
        newsFeed: [
          ..._state.player.newsFeed,
          { id: `event-mitigated-${eventId}-t${_state.turn}`, turn: _state.turn, text: newsText, category: 'event-neutral' as const },
        ],
      },
      activeEvents: _state.activeEvents.map((e) =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'mitigation' as const } : e,
      ),
    });
  },

  acceptEvent(eventId: string): void {
    if (!_state) return;
    const event = _state.activeEvents.find((e) => e.id === eventId);
    if (!event) return;
    const def = EVENT_DEFS.get(event.defId);
    if (!def) return;

    const effect = getEffectForResolution(def, 'accepted');
    let updatedPlayer = _state.player;
    let updatedTiles = _state.map.earthTiles;
    if (effect) {
      const eventRng = createRng(`${_state.seed}-accept-${eventId}-t${_state.turn}`);
      const result = applyEventEffect(effect, updatedPlayer, updatedTiles, _state.turn, eventRng);
      updatedPlayer = result.player;
      updatedTiles = result.mapTiles;
    }

    const isBoardProposal = def.id === 'boardProposalOrbitalStation';
    const isMoonColonyProposal = def.id === 'boardProposalMoonColony';
    const newsText = isBoardProposal
      ? 'The Corporation has officially initiated the Permanent Orbital Station programme.'
      : isMoonColonyProposal
        ? 'The Corporation has committed to establishing a permanent Moon Colony.'
        : `${def.name} accepted — ${effect ? formatEffectForNews(effect) : 'no effect'}.`;

    mutateState({
      ..._state,
      map: { ..._state.map, earthTiles: updatedTiles },
      orbitalStationAuthorised: isBoardProposal ? true : _state.orbitalStationAuthorised,
      orbitalStationDeferResurfaceTurn: isBoardProposal ? null : _state.orbitalStationDeferResurfaceTurn,
      moonColonyAuthorised: isMoonColonyProposal ? true : _state.moonColonyAuthorised,
      moonColonyDeferResurfaceTurn: isMoonColonyProposal ? null : _state.moonColonyDeferResurfaceTurn,
      player: {
        ...updatedPlayer,
        newsFeed: [
          ..._state.player.newsFeed,
          {
            id: `event-accepted-${eventId}-t${_state.turn}`,
            turn: _state.turn,
            text: newsText,
            category: 'event-gain' as const,
          },
        ],
      },
      activeEvents: _state.activeEvents.map((e) =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'accepted' as const } : e,
      ),
    });
  },

  /** Defer a board proposal event — dismisses it and re-surfaces after 3 turns. */
  deferBoardProposal(eventId: string): void {
    if (!_state) return;
    const event = _state.activeEvents.find((e) => e.id === eventId);
    if (!event) return;
    const def = EVENT_DEFS.get(event.defId);
    const isMoonColony = def?.id === 'boardProposalMoonColony';
    const newsText = isMoonColony
      ? 'The board proposal for the Moon Colony has been deferred. The matter will return to the agenda.'
      : 'The board proposal for the Orbital Station has been deferred. The matter will return to the agenda.';
    mutateState({
      ..._state,
      orbitalStationDeferCount: isMoonColony ? _state.orbitalStationDeferCount : _state.orbitalStationDeferCount + 1,
      orbitalStationDeferResurfaceTurn: isMoonColony ? _state.orbitalStationDeferResurfaceTurn : _state.turn + 3,
      moonColonyDeferCount: isMoonColony ? _state.moonColonyDeferCount + 1 : _state.moonColonyDeferCount,
      moonColonyDeferResurfaceTurn: isMoonColony ? _state.turn + 3 : _state.moonColonyDeferResurfaceTurn,
      activeEvents: _state.activeEvents.map((e) =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'accepted' as const } : e,
      ),
      player: {
        ..._state.player,
        newsFeed: [
          ..._state.player.newsFeed,
          {
            id: `board-proposal-deferred-t${_state.turn}`,
            turn: _state.turn,
            text: newsText,
            category: 'board' as const,
          },
        ],
      },
    });
  },

  declineEvent(eventId: string): void {
    if (!_state) return;
    const event = _state.activeEvents.find((e) => e.id === eventId);
    if (!event) return;
    const def = EVENT_DEFS.get(event.defId);
    if (!def) return;

    // Apply the full negative effect immediately (player chose not to act)
    const effect = getEffectForResolution(def, 'expired');
    let updatedPlayer = _state.player;
    let updatedTiles = _state.map.earthTiles;
    if (effect) {
      const eventRng = createRng(`${_state.seed}-decline-${eventId}-t${_state.turn}`);
      const result = applyEventEffect(effect, updatedPlayer, updatedTiles, _state.turn, eventRng);
      updatedPlayer = result.player;
      updatedTiles = result.mapTiles;
    }

    const summary = effect ? formatEffectForNews(effect) : 'no effect';
    mutateState({
      ..._state,
      map: { ..._state.map, earthTiles: updatedTiles },
      player: {
        ...updatedPlayer,
        newsFeed: [
          ..._state.player.newsFeed,
          {
            id: `event-declined-${eventId}-t${_state.turn}`,
            turn: _state.turn,
            text: `${def.name} — consequence applied: ${summary}.`,
            category: 'event-loss' as const,
          },
        ],
      },
      activeEvents: _state.activeEvents.map((e) =>
        e.id === eventId ? { ...e, resolved: true, resolvedWith: 'expired' as const } : e,
      ),
    });
  },

  playCard(cardId: string): void {
    if (!_state) return;
    // Enforce per-turn action cap (old saves default to 3 if field missing)
    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    const card = _state.player.cards.find((c) => c.id === cardId);
    if (!card || card.zone !== 'hand') return;
    const def = CARD_DEFS.get(card.defId);
    if (!def) return;

    // Board requirement check: card needs a specific role to be filled
    if (def.requiresBoard && isBoardSlotVacant(_state.player.board, def.requiresBoard)) return;

    // Afford check: any negative resource delta must be coverable
    if (def.effect.resources) {
      const r = def.effect.resources;
      const res = _state.player.resources;
      if ((r.funding ?? 0) < 0 && res.funding < -(r.funding!)) return;
      if ((r.materials ?? 0) < 0 && res.materials < -(r.materials!)) return;
      if ((r.politicalWill ?? 0) < 0 && res.politicalWill < -(r.politicalWill!)) return;
    }

    let resources = { ..._state.player.resources };
    if (def.effect.resources) {
      const r = def.effect.resources;
      resources = {
        funding: resources.funding + (r.funding ?? 0),
        materials: Math.max(0, resources.materials + (r.materials ?? 0)),
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

    // Check if this card counters an active fullCounter or partialMitigation event
    let activeEvents = [..._state.activeEvents];
    let newsFeed = [..._state.player.newsFeed];
    if (def.counterEffect) {
      const tag = def.counterEffect.countersEventTag;
      const matchIdx = activeEvents.findIndex(
        (e) =>
          !e.resolved &&
          (EVENT_DEFS.get(e.defId)?.responseTier === 'fullCounter' ||
            EVENT_DEFS.get(e.defId)?.responseTier === 'partialMitigation') &&
          (EVENT_DEFS.get(e.defId)?.tags ?? []).includes(tag),
      );
      if (matchIdx !== -1) {
        // Deduct additional counter cost
        const addl = def.counterEffect.additionalCost;
        resources = {
          funding: resources.funding - (addl.funding ?? 0),
          materials: Math.max(0, resources.materials - (addl.materials ?? 0)),
          politicalWill: Math.max(0, resources.politicalWill - (addl.politicalWill ?? 0)),
        };
        const matched = activeEvents[matchIdx];
        const eventName = EVENT_DEFS.get(matched.defId)?.name ?? matched.defId;
        if (def.counterEffect.fullNeutralise) {
          activeEvents = activeEvents.map((e) =>
            e.id === matched.id ? { ...e, resolved: true, resolvedWith: 'counter' as const } : e,
          );
          const counterNews: NewsItem = {
            id: crypto.randomUUID(),
            turn: _state.turn,
            text: `${eventName} countered by ${def.name}.`,
            category: 'event-gain',
          };
          newsFeed = [...newsFeed, counterNews];
        } else {
          const mitigationCost = EVENT_DEFS.get(matched.defId)?.mitigationCost ?? {};
          resources = {
            funding: resources.funding - (mitigationCost.funding ?? 0),
            materials: Math.max(0, resources.materials - (mitigationCost.materials ?? 0)),
            politicalWill: Math.max(0, resources.politicalWill - (mitigationCost.politicalWill ?? 0)),
          };
          activeEvents = activeEvents.map((e) =>
            e.id === matched.id ? { ...e, resolved: true, resolvedWith: 'mitigation' as const } : e,
          );
          const costParts: string[] = [];
          if (mitigationCost.funding) costParts.push(`${mitigationCost.funding} Funding`);
          if (mitigationCost.materials) costParts.push(`${mitigationCost.materials} Materials`);
          if (mitigationCost.politicalWill) costParts.push(`${mitigationCost.politicalWill} Political Will`);
          const costStr = costParts.length > 0 ? ` (cost: ${costParts.join(', ')})` : '';
          const mitigationNews: NewsItem = {
            id: crypto.randomUUID(),
            turn: _state.turn,
            text: `${eventName} partially mitigated by ${def.name}${costStr}.`,
            category: 'event-neutral',
          };
          newsFeed = [...newsFeed, mitigationNews];
        }
      }
    }

    const bonusActionsNextTurn =
      def.effect.customEffectKey === 'extraAction'
        ? (_state.bonusActionsNextTurn ?? 0) + 1
        : (_state.bonusActionsNextTurn ?? 0);

    if (def.effect.customEffectKey === 'extraAction') {
      newsFeed = [
        ...newsFeed,
        {
          id: crypto.randomUUID(),
          turn: _state.turn,
          text: 'Executive Override authorised — one additional action available next turn.',
          category: 'event-gain' as const,
        },
      ];
    }

    mutateState({
      ..._state,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
      bonusActionsNextTurn,
      activeEvents,
      player: {
        ..._state.player,
        resources,
        fields,
        newsFeed,
        cards: _state.player.cards.map((c) =>
          c.id === cardId ? { ...c, zone: 'discard' as const } : c,
        ),
      },
    });
  },

  bankCard(cardId: string): void {
    if (!_state) return;
    const bankedCount = _state.player.cards.filter((c) => c.zone === 'bank').length;
    if (bankedCount >= 2) return;
    const turn = _state.turn;
    mutateState({
      ..._state,
      player: {
        ..._state.player,
        cards: _state.player.cards.map((c) =>
          c.id === cardId && c.zone === 'hand'
            ? { ...c, zone: 'bank' as const, bankedSinceTurn: turn }
            : c,
        ),
      },
    });
  },

  unbankCard(cardId: string): void {
    if (!_state) return;
    mutateState({
      ..._state,
      player: {
        ..._state.player,
        cards: _state.player.cards.map((c) =>
          c.id === cardId && c.zone === 'bank'
            ? { ...c, zone: 'hand' as const, bankedSinceTurn: null }
            : c,
        ),
      },
    });
  },

  /**
   * Advance the game phase.
   *  action → world → event → draw → action  (full World Phase + automated phases)
   *
   * If the World Phase triggers a victory or loss, navigation to /summary
   * happens automatically after state is updated.
   */
  advancePhase(): void {
    if (!_state) return;
    if (_state.phase === 'action') {
      // Each turn gets its own deterministic RNG slice derived from seed + turn number.
      const rng = createRng(`${_state.seed}-t${_state.turn}`);
      let next = endActionPhase(_state);

      // Snapshot pre-world-phase state for narrative comparison
      const prevTechs = _state.player.techs;
      const prevSignalProgress = _state.signal.decodeProgress;
      const prevEra = _state.era;
      const prevFacilities = _state.player.facilities;

      next = executeWorldPhase(next, FACILITY_DEFS, TECH_DEFS, BLOC_DEFS, BOARD_DEFS, PROJECT_DEFS, CARD_DEFS, TILE_ACTION_DEFS);

      // ---------------------------------------------------------------------------
      // Enqueue narratives in prescribed order:
      //   1. Tech unlock  2. Signal progress  3. Unique facility  4. Era transition
      // ---------------------------------------------------------------------------

      // 1. Tech unlock narratives
      const newlyDiscovered = next.player.techs.filter(
        (t) =>
          t.stage === 'discovered' &&
          !prevTechs.some((pt) => pt.defId === t.defId && pt.stage === 'discovered'),
      );
      for (const tech of newlyDiscovered) {
        const def = TECH_DEFS.get(tech.defId);
        if (def?.narrative) {
          const unlockItems: import('../../engine/types').NarrativeUnlockItem[] = [
            ...def.unlocksCards.map((id) => ({
              type: 'card' as const,
              name: CARD_DEFS.get(id)?.name ?? id,
            })),
            ...def.unlocksFacilities.map((id) => ({
              type: 'facility' as const,
              name: FACILITY_DEFS.get(id)?.name ?? id,
            })),
            ...def.unlocksProjects.map((id) => ({
              type: 'project' as const,
              name: PROJECT_DEFS.get(id)?.name ?? id,
            })),
          ];
          const enriched = unlockItems.length > 0
            ? { ...def.narrative, unlockItems }
            : def.narrative;
          next = enqueueNarrative(next, enriched);
        }
      }

      // 2. Signal decode stage narratives
      if (prevSignalProgress < 30 && next.signal.decodeProgress >= 30) {
        next = enqueueNarrative(next, NARRATIVE_SIGNAL_STRUCTURED);
      }
      if (prevSignalProgress < 70 && next.signal.decodeProgress >= 70) {
        next = enqueueNarrative(next, NARRATIVE_SIGNAL_URGENT);
      }

      // 3. Unique facility completion narratives (facilities added this world phase)
      const newFacilities = next.player.facilities.filter(
        (f) => !prevFacilities.some((pf) => pf.id === f.id),
      );
      for (const facility of newFacilities) {
        const def = FACILITY_DEFS.get(facility.defId);
        if (def?.unique && def.narrative) next = enqueueNarrative(next, def.narrative);
      }

      // 4. Era transition narratives
      if (prevEra !== next.era) {
        if (next.era === 'nearSpace') next = enqueueNarrative(next, NARRATIVE_ERA_NEARSPACE);
        if (next.era === 'deepSpace') next = enqueueNarrative(next, NARRATIVE_ERA_DEEPSPACE);
      }

      // If the game ended, skip the remaining automated phases and navigate.
      if (next.outcome) {
        mutateState(next);
        goto('/summary');
        return;
      }
      next = executeEventPhase(next, EVENT_DEFS, [...EVENT_DEFS.values()], BOARD_DEFS, rng);
      next = executeDrawPhase(next, rng);
      mutateState(next);
    }
  },

  /** Navigate to the new-game setup screen. */
  resetGame(): void {
    goto('/newgame');
  },

  /** Download the current game state as a JSON file. */
  exportSave(): void {
    if (!_state) return;
    exportSave(_state);
  },

  /** Load a game state from a user-supplied JSON file. */
  async importSaveFile(file: File): Promise<void> {
    const loaded = await importSave(file);
    mutateState(loaded);
    resetSelections();
  },

  /** Recruit a board member. Costs 1 action + per-character resource cost. */
  recruitMember(defId: string, startAge: number): void {
    if (!_state) return;
    const def = BOARD_DEFS.get(defId);
    if (!def) return;
    if (!isBoardSlotVacant(_state.player.board, def.role)) return;

    // Action cap check
    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    // Per-character resource cost
    const cost = def.recruitCost;
    if (_state.player.resources.funding < cost.funding) return;
    if (_state.player.resources.politicalWill < cost.politicalWill) return;

    const newBoard = recruitBoardMember(_state.player.board, def, startAge, _state.turn);
    const ROLE_LABELS: Record<BoardRole, string> = {
      chiefScientist: 'Chief Scientist',
      directorOfEngineering: 'Dir. Engineering',
      headOfFinance: 'Head of Finance',
      politicalLiaison: 'Political Liaison',
      directorOfOperations: 'Dir. Operations',
      securityDirector: 'Security Director',
      signalAnalyst: 'Signal Analyst',
      stationCommander: 'Station Commander',
      directorOfLunarOperations: 'Dir. Lunar Operations',
    };
    mutateState({
      ..._state,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
      player: {
        ..._state.player,
        resources: {
          ..._state.player.resources,
          funding: _state.player.resources.funding - cost.funding,
          politicalWill: _state.player.resources.politicalWill - cost.politicalWill,
        },
        board: newBoard,
        newsFeed: [
          ..._state.player.newsFeed,
          {
            id: `recruit-${defId}-t${_state.turn}`,
            turn: _state.turn,
            text: `${def.name} has joined the Steering Committee as ${ROLE_LABELS[def.role]}.`,
            category: 'board' as const,
          },
        ],
      },
    });
  },

  /** Remove a board member (dismissed). Costs 20 Political Will. */
  dismissMember(role: BoardRole): void {
    if (!_state) return;
    const DISMISS_COST = 20;
    if (_state.player.resources.politicalWill < DISMISS_COST) return;

    const member = _state.player.board[role];
    const displayName = member ? (BOARD_DEFS.get(member.defId)?.name ?? member.defId) : 'Unknown';

    const newBoard = removeBoardMember(_state.player.board, role, 'resigned', _state.turn);
    mutateState({
      ..._state,
      player: {
        ..._state.player,
        resources: {
          ..._state.player.resources,
          politicalWill: _state.player.resources.politicalWill - DISMISS_COST,
        },
        board: newBoard,
        newsFeed: [
          ..._state.player.newsFeed,
          {
            id: `dismiss-${role}-t${_state.turn}`,
            turn: _state.turn,
            text: `${displayName} has been dismissed from the Steering Committee.`,
            category: 'board' as const,
          },
        ],
      },
    });
  },

  /** Resolve a committee notification by selecting one of its choices. */
  resolveCommitteeNotification(id: string, choiceIndex: number): void {
    if (!_state) return;
    const result = resolveCommitteeNotification(_state.committeeNotifications ?? [], id, choiceIndex);
    let resources = { ..._state.player.resources };
    if (result.resourceDelta) {
      resources = {
        funding: resources.funding + (result.resourceDelta.funding ?? 0),
        materials: Math.max(0, resources.materials + (result.resourceDelta.materials ?? 0)),
        politicalWill: Math.max(0, resources.politicalWill + (result.resourceDelta.politicalWill ?? 0)),
      };
    }
    const newsFeed = result.newsText
      ? [
          ..._state.player.newsFeed,
          {
            id: `notification-resolved-${id}-t${_state.turn}`,
            turn: _state.turn,
            text: result.newsText,
            category: 'board' as const,
          },
        ]
      : _state.player.newsFeed;
    mutateState({
      ..._state,
      committeeNotifications: result.notifications,
      player: { ..._state.player, resources, newsFeed },
    });
  },

  /** Dismiss a committee notification without acting on it. */
  dismissCommitteeNotification(id: string): void {
    if (!_state) return;
    mutateState({
      ..._state,
      committeeNotifications: dismissCommitteeNotification(_state.committeeNotifications ?? [], id),
    });
  },

  /**
   * Initiate a Scientific Project. Costs one action slot and deducts the
   * upfront resource cost. No-ops if the project cannot be started.
   */
  initiateProject(defId: string): void {
    if (!_state) return;
    const def = PROJECT_DEFS.get(defId);
    if (!def) return;

    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    if (!canInitiateProject(_state, def)) return;

    const next = initiateProject(_state, def);
    mutateState({
      ...next,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
    });
  },

  /**
   * Generate wormhole response options for the signal climax.
   * Returns the options (caller should display them); does not mutate state.
   */
  getWormholeOptions(): SignalResponseOption[] {
    if (!_state) return [];
    const rng = createRng(`${_state.seed}-wormhole`);
    return generateWormholeOptions(_state.signal, rng);
  },

  /** Dismiss the current narrative modal and advance the queue. */
  dismissNarrativeModal(): void {
    if (!_state) return;
    mutateState(dismissNarrative(_state));
  },

  /** Commit the player's chosen wormhole response. */
  commitWormholeResponse(optionId: string, options: SignalResponseOption[]): void {
    if (!_state) return;
    const newSignal = commitSignalResponse(_state.signal, optionId, options);
    const text = newSignal.wormholeActivated
      ? 'The resonance pathway is open. The wormhole is activated.'
      : 'The response was incorrect. The signal locks closed. The opportunity is lost.';
    mutateState({
      ..._state,
      signal: newSignal,
      player: {
        ..._state.player,
        newsFeed: [
          ..._state.player.newsFeed,
          { id: `wormhole-t${_state.turn}`, turn: _state.turn, text },
        ],
      },
    });
  },

  /**
   * Toggle supply allocation for a space facility node.
   * Toggling ON is blocked when remaining capacity < the facility's supplyCost.
   */
  toggleSpaceFacilitySupply(nodeId: string): void {
    if (!_state) return;
    const node = _state.map.spaceNodes.find((n) => n.id === nodeId);
    if (!node || !node.facilityId) return;
    const def = FACILITY_DEFS.get(node.facilityId);
    if (!def || !def.supplyCost) return;

    const currentlyOn = _state.launchAllocation[nodeId] !== false;
    if (currentlyOn) {
      // Turn off: always allowed
      mutateState({
        ..._state,
        launchAllocation: { ..._state.launchAllocation, [nodeId]: false },
      });
    } else {
      // The node is currently OFF, so it's already excluded from the allocated
      // total — check if remaining capacity covers adding it back
      if (computeRemainingCapacity(_state) < def.supplyCost) return;
      mutateState({
        ..._state,
        launchAllocation: { ..._state.launchAllocation, [nodeId]: true },
      });
    }
  },

  /**
   * Upgrade the space facility on the given node to its next tier.
   * Costs the next tier's buildCost and queues construction.
   * The existing facility remains active during construction.
   */
  upgradeFacility(nodeId: string): void {
    if (!_state) return;
    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    const nextDef = canUpgradeFacility(
      nodeId,
      _state.map.spaceNodes,
      _state.player.facilities,
      FACILITY_DEFS,
      _state.player.techs,
    );
    if (!nextDef) return;

    // Afford check
    const cost = nextDef.buildCost;
    if ((cost.funding ?? 0) > _state.player.resources.funding) return;
    if ((cost.materials ?? 0) > _state.player.resources.materials) return;

    // Deduct cost
    const newResources = {
      funding: _state.player.resources.funding - (cost.funding ?? 0),
      materials: Math.max(0, _state.player.resources.materials - (cost.materials ?? 0)),
      politicalWill: _state.player.resources.politicalWill - (cost.politicalWill ?? 0),
    };

    // Queue space upgrade action
    const actionId = `upgrade-${nextDef.id}-${nodeId}-t${_state.turn}`;
    const action: OngoingAction = {
      id: actionId,
      type: 'construct',
      facilityDefId: nextDef.id,
      coordKey: '',
      turnsRemaining: nextDef.buildTime,
      totalTurns: nextDef.buildTime,
      slotIndex: 0,
      spaceNodeId: nodeId,
    };

    mutateState({
      ..._state,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
      player: {
        ..._state.player,
        resources: newResources,
        constructionQueue: [..._state.player.constructionQueue, action],
      },
    });
  },

  /**
   * Build the first facility on an empty space node.
   * Validates: node exists and is vacant, no construction in progress, tech unlocked,
   * resources sufficient, supply cost fits within remaining launch capacity, action cap not exceeded.
   */
  buildSpaceFacility(nodeId: string, defId: string): void {
    if (!_state) return;
    const def = FACILITY_DEFS.get(defId);
    if (!def) return;

    const cap = (_state.maxActionsPerTurn ?? 3) + (_state.bonusActionsThisTurn ?? 0);
    if ((_state.actionsThisTurn ?? 0) >= cap) return;

    const node = _state.map.spaceNodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Node must be vacant
    if (node.facilityId !== null) return;

    // No construction already queued for this node
    if (_state.player.constructionQueue.some((a) => a.spaceNodeId === nodeId)) return;

    // Tech gate
    if (def.requiredTechId != null) {
      const discovered = _state.player.techs.some(
        (t) => t.defId === def.requiredTechId && t.stage === 'discovered',
      );
      if (!discovered) return;
    }

    // Affordability
    const cost = def.buildCost;
    if ((cost.funding ?? 0) > _state.player.resources.funding) return;
    if ((cost.materials ?? 0) > _state.player.resources.materials) return;
    if ((cost.politicalWill ?? 0) > _state.player.resources.politicalWill) return;

    const newResources = {
      funding: _state.player.resources.funding - (cost.funding ?? 0),
      materials: Math.max(0, _state.player.resources.materials - (cost.materials ?? 0)),
      politicalWill: Math.max(0, _state.player.resources.politicalWill - (cost.politicalWill ?? 0)),
    };

    const actionId = `space-build-${defId}-${nodeId}-t${_state.turn}`;
    const action: OngoingAction = {
      id: actionId,
      type: 'construct',
      facilityDefId: defId,
      coordKey: '',
      turnsRemaining: def.buildTime,
      totalTurns: def.buildTime,
      slotIndex: 0,
      spaceNodeId: nodeId,
    };

    const newsItem: import('../../engine/types').NewsItem = {
      id: `space-build-news-${nodeId}-${_state.turn}`,
      turn: _state.turn,
      text: `Construction begun: ${def.name} at ${node.label}.`,
    };

    mutateState({
      ..._state,
      actionsThisTurn: (_state.actionsThisTurn ?? 0) + 1,
      player: {
        ..._state.player,
        resources: newResources,
        constructionQueue: [..._state.player.constructionQueue, action],
        newsFeed: [..._state.player.newsFeed, newsItem],
      },
    });
  },

  /** Derived: remaining launch capacity after current allocation. */
  get remainingLaunchCapacity(): number {
    if (!_state) return 0;
    return computeRemainingCapacity(_state);
  },
};
