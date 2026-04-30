import { describe, it, expect } from 'vitest';
import { createGameState, deserialiseGameState, serialiseGameState } from './state';
import { executeWorldPhase } from './turn';
import type {
  BoardMemberDef,
  BoardSlots,
  FacilityDef,
  GameState,
  ProjectDef,
  ProjectInstance,
} from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  seed: 'test',
  playerBlocDefId: 'northAmericanAlliance',
  pushFactor: 'climateChange' as const,
  startYear: 1970,
  willProfile: 'democratic' as const,
  startingWill: 50,
  startingResources: { funding: 100, materials: 80, politicalWill: 50 },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createGameState(BASE_CONFIG), ...overrides };
}

function withCompletingProject(state: GameState, project: ProjectInstance): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      activeProjects: [...state.player.activeProjects, project],
    },
  };
}

const ERA2_PROJECT: ProjectDef = {
  id: 'eraTwoLandmark',
  name: 'Era 2 Landmark',
  description: 'Opens nearSpace era.',
  type: 'landmark',
  era: 'earth',
  cost: { funding: 10, materials: 10 },
  upkeepCost: {},
  baseDuration: 1,
  oneOffReward: {},
  landmarkGate: 'opensEra2',
  prerequisites: {},
};

const ERA3_PROJECT: ProjectDef = {
  ...ERA2_PROJECT,
  id: 'eraThreeLandmark',
  name: 'Era 3 Landmark',
  description: 'Opens deepSpace era.',
  landmarkGate: 'opensEra3',
};

const ORBITAL_STAGE1: ProjectDef = {
  ...ERA2_PROJECT,
  id: 'orbitalStation_stage1',
  name: 'Orbital Station — Stage 1',
  landmarkGate: null,
};

const PLAIN_PROJECT: ProjectDef = {
  ...ERA2_PROJECT,
  id: 'plainProject',
  name: 'Plain Project',
  landmarkGate: null,
};

const FAC_DEFS = new Map<string, FacilityDef>();

const RAMIREZ_DEF: BoardMemberDef = {
  id: 'drRamirez',
  name: 'Dr. Elena Ramirez',
  role: 'chiefScientist',
  startAge: 50,
  buffs: [],
  debuffs: [],
  isAI: false,
  recruitCost: { funding: 0, politicalWill: 0 },
};

const BOARD_DEFS = new Map<string, BoardMemberDef>([['drRamirez', RAMIREZ_DEF]]);

function withRetiringChiefScientist(state: GameState): GameState {
  // Age 69: tickBoardAges will increment to 70 and mark retired.
  const board: BoardSlots = {
    chiefScientist: {
      id: 'ramirez-1',
      defId: 'drRamirez',
      role: 'chiefScientist',
      age: 69,
      joinedTurn: 1,
      leftTurn: null,
      leftReason: null,
    },
  };
  return { ...state, player: { ...state.player, board } };
}

// ---------------------------------------------------------------------------
// createGameState defaults
// ---------------------------------------------------------------------------

describe('tab-seen — defaults', () => {
  it('createGameState seeds tabSeen as an empty map (all tabs implicitly seen)', () => {
    const state = createGameState(BASE_CONFIG);
    expect(state.tabSeen).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// deserialiseGameState migration
// ---------------------------------------------------------------------------

describe('tab-seen — save migration', () => {
  it('defaults to {} when tabSeen is missing on an old save', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.tabSeen;
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.tabSeen).toEqual({});
  });

  it('forward-migrates legacy nearSpaceTabSeen / asteroidTabSeen booleans', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.tabSeen;
    parsed.nearSpaceTabSeen = false;
    parsed.asteroidTabSeen = true; // already seen — should not appear in map
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.tabSeen).toEqual({ space: false });
  });
});

// ---------------------------------------------------------------------------
// Era-transition flips
// ---------------------------------------------------------------------------

describe('tab-seen — era transitions', () => {
  it('sets tabSeen.space=false when an opensEra2 project completes', () => {
    const baseTurn = 1;
    const state = withCompletingProject(makeState({ turn: baseTurn }), {
      id: 'pi-era2',
      defId: ERA2_PROJECT.id,
      startTurn: baseTurn,
      turnsElapsed: 0,
      effectiveDuration: 1,
    });
    const next = executeWorldPhase(
      state,
      FAC_DEFS,
      undefined,
      undefined,
      undefined,
      new Map([[ERA2_PROJECT.id, ERA2_PROJECT]]),
    );
    expect(next.era).toBe('nearSpace');
    expect(next.tabSeen.space).toBe(false);
    expect(next.tabSeen.belt).toBeUndefined();
  });

  it('sets tabSeen.belt=false when an opensEra3 project completes', () => {
    const baseTurn = 1;
    const state = withCompletingProject(
      makeState({ turn: baseTurn, era: 'nearSpace' }),
      {
        id: 'pi-era3',
        defId: ERA3_PROJECT.id,
        startTurn: baseTurn,
        turnsElapsed: 0,
        effectiveDuration: 1,
      },
    );
    const next = executeWorldPhase(
      state,
      FAC_DEFS,
      undefined,
      undefined,
      undefined,
      new Map([[ERA3_PROJECT.id, ERA3_PROJECT]]),
    );
    expect(next.era).toBe('deepSpace');
    expect(next.tabSeen.belt).toBe(false);
  });

  it('sets tabSeen.space=false when orbitalStation_stage1 completes (no era change)', () => {
    const baseTurn = 1;
    const state = withCompletingProject(makeState({ turn: baseTurn }), {
      id: 'pi-os1',
      defId: ORBITAL_STAGE1.id,
      startTurn: baseTurn,
      turnsElapsed: 0,
      effectiveDuration: 1,
    });
    const next = executeWorldPhase(
      state,
      FAC_DEFS,
      undefined,
      undefined,
      undefined,
      new Map([[ORBITAL_STAGE1.id, ORBITAL_STAGE1]]),
    );
    expect(next.era).toBe('earth');
    expect(next.tabSeen.space).toBe(false);
  });

  it('does not touch tabSeen on routine world phases', () => {
    const state = makeState({ tabSeen: { space: true, belt: true, board: true } });
    const next = executeWorldPhase(state, FAC_DEFS);
    expect(next.tabSeen).toEqual({ space: true, belt: true, board: true });
  });
});

// ---------------------------------------------------------------------------
// Projects tab dot
// ---------------------------------------------------------------------------

describe('tab-seen — projects tab', () => {
  it('sets tabSeen.projects=false when any project completes', () => {
    const baseTurn = 1;
    const state = withCompletingProject(makeState({ turn: baseTurn }), {
      id: 'pi-plain',
      defId: PLAIN_PROJECT.id,
      startTurn: baseTurn,
      turnsElapsed: 0,
      effectiveDuration: 1,
    });
    const next = executeWorldPhase(
      state,
      FAC_DEFS,
      undefined,
      undefined,
      undefined,
      new Map([[PLAIN_PROJECT.id, PLAIN_PROJECT]]),
    );
    expect(next.player.completedProjectIds).toHaveProperty(PLAIN_PROJECT.id);
    expect(next.tabSeen.projects).toBe(false);
  });

  it('leaves tabSeen.projects untouched when no project completes', () => {
    const state = makeState({ tabSeen: { projects: true } });
    const next = executeWorldPhase(state, FAC_DEFS);
    expect(next.tabSeen.projects).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Board tab dot
// ---------------------------------------------------------------------------

describe('tab-seen — board tab', () => {
  it('sets tabSeen.board=false when a new committee notification is added (retirement)', () => {
    const state = withRetiringChiefScientist(makeState());
    const next = executeWorldPhase(
      state,
      FAC_DEFS,
      undefined,
      undefined,
      BOARD_DEFS,
    );
    // The retirement should have produced a notification …
    expect(next.committeeNotifications.length).toBeGreaterThan(state.committeeNotifications.length);
    // … and flipped the board dot on.
    expect(next.tabSeen.board).toBe(false);
  });

  it('leaves tabSeen.board untouched when no new notifications are added', () => {
    const state = makeState({ tabSeen: { board: true } });
    const next = executeWorldPhase(state, FAC_DEFS, undefined, undefined, BOARD_DEFS);
    expect(next.tabSeen.board).toBe(true);
  });
});
