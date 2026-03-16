import { describe, it, expect } from 'vitest';
import { canInitiateProject, getAvailableProjects, initiateProject, tickActiveProjects } from './projects';
import type { GameState, ProjectDef, FacilityInstance, MapTile } from './types';
import { createGameState } from './state';

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

/** A minimal project def with no prerequisites. */
const DEF_SIMPLE: ProjectDef = {
  id: 'testProject',
  name: 'Test Project',
  description: 'A simple test project.',
  type: 'scientific',
  era: 'earth',
  cost: { funding: 20, materials: 10 },
  upkeepCost: { funding: 2 },
  baseDuration: 2,
  reward: { signalProgress: 10, resources: { funding: 15 } },
  landmarkGate: null,
  prerequisites: {},
};

/** A project gated behind a tech. */
const DEF_TECH_GATED: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'techGatedProject',
  prerequisites: { requiredTechs: ['orbitalMechanics'] },
};

/** A project gated behind a facility. */
const DEF_FACILITY_GATED: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'facilityGatedProject',
  prerequisites: { requiredFacilityDefs: ['spaceLaunchCentre'] },
};

/** A project gated behind the nearSpace era. */
const DEF_ERA_GATED: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'eraGatedProject',
  prerequisites: { era: 'nearSpace' },
};

/** A project with a multi-turn duration and upkeep. */
const DEF_LONG: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'longProject',
  baseDuration: 3,
  upkeepCost: { funding: 5 },
  reward: { signalProgress: 20, resources: { funding: 30 } },
  prerequisites: {},
};

const ALL_DEFS: Map<string, ProjectDef> = new Map([
  [DEF_SIMPLE.id, DEF_SIMPLE],
  [DEF_TECH_GATED.id, DEF_TECH_GATED],
  [DEF_FACILITY_GATED.id, DEF_FACILITY_GATED],
  [DEF_ERA_GATED.id, DEF_ERA_GATED],
]);

// ---------------------------------------------------------------------------
// Helper: add a discovered tech to state
// ---------------------------------------------------------------------------

function withDiscoveredTech(state: GameState, techId: string): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      techs: [
        ...state.player.techs,
        { defId: techId, stage: 'discovered', recipe: null, fieldProgress: {}, unlockedByBreakthrough: false, discoveredTurn: 1 },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: add a built facility to state
// ---------------------------------------------------------------------------

function withFacility(state: GameState, defId: string): GameState {
  const instance: FacilityInstance = {
    id: `${defId}-test`,
    defId,
    locationKey: '0,0',
    condition: 1.0,
    builtTurn: 1,
  };
  // Also add a tile at 0,0 with no pendingActionId
  const tile: MapTile = {
    coord: { q: 0, r: 0 },
    type: 'urban',
    destroyedStatus: null,
    productivity: 1.0,
    mineDepletion: 1.0,
    facilitySlots: [instance.id, null, null],
    pendingActionId: null,
  };
  return {
    ...state,
    player: { ...state.player, facilities: [...state.player.facilities, instance] },
    map: { ...state.map, earthTiles: [...state.map.earthTiles, tile] },
  };
}

// ---------------------------------------------------------------------------
// canInitiateProject
// ---------------------------------------------------------------------------

describe('canInitiateProject', () => {
  it('returns true when all prerequisites are met and player can afford it', () => {
    expect(canInitiateProject(makeState(), DEF_SIMPLE)).toBe(true);
  });

  it('returns false when player cannot afford the funding cost', () => {
    const state = makeState();
    const poor = { ...state, player: { ...state.player, resources: { ...state.player.resources, funding: 5 } } };
    expect(canInitiateProject(poor, DEF_SIMPLE)).toBe(false);
  });

  it('returns false when player cannot afford the materials cost', () => {
    const state = makeState();
    const poor = { ...state, player: { ...state.player, resources: { ...state.player.resources, materials: 5 } } };
    expect(canInitiateProject(poor, DEF_SIMPLE)).toBe(false);
  });

  it('returns false when required tech is not discovered', () => {
    expect(canInitiateProject(makeState(), DEF_TECH_GATED)).toBe(false);
  });

  it('returns true when required tech is discovered', () => {
    const state = withDiscoveredTech(makeState(), 'orbitalMechanics');
    expect(canInitiateProject(state, DEF_TECH_GATED)).toBe(true);
  });

  it('returns false when required facility is not built', () => {
    expect(canInitiateProject(makeState(), DEF_FACILITY_GATED)).toBe(false);
  });

  it('returns true when required facility is built and not pending demolition', () => {
    const state = withFacility(makeState(), 'spaceLaunchCentre');
    expect(canInitiateProject(state, DEF_FACILITY_GATED)).toBe(true);
  });

  it('returns false when era prerequisite is not met', () => {
    expect(canInitiateProject(makeState(), DEF_ERA_GATED)).toBe(false);
  });

  it('returns true when era prerequisite is met', () => {
    const state = { ...makeState(), era: 'nearSpace' as const };
    expect(canInitiateProject(state, DEF_ERA_GATED)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableProjects
// ---------------------------------------------------------------------------

describe('getAvailableProjects', () => {
  it('returns only projects that meet all prerequisites', () => {
    const available = getAvailableProjects(makeState(), ALL_DEFS);
    expect(available.map((d) => d.id)).toContain(DEF_SIMPLE.id);
    expect(available.map((d) => d.id)).not.toContain(DEF_TECH_GATED.id);
    expect(available.map((d) => d.id)).not.toContain(DEF_ERA_GATED.id);
  });

  it('excludes projects already active', () => {
    const state = makeState();
    const active = { ...state, player: { ...state.player, activeProjects: [{ id: 'testProject-t1', defId: DEF_SIMPLE.id, startTurn: 1, turnsElapsed: 0, effectiveDuration: 2 }] } };
    const available = getAvailableProjects(active, ALL_DEFS);
    expect(available.map((d) => d.id)).not.toContain(DEF_SIMPLE.id);
  });

  it('excludes completed projects', () => {
    const state = makeState();
    const done = { ...state, player: { ...state.player, completedProjectIds: [DEF_SIMPLE.id] } };
    const available = getAvailableProjects(done, ALL_DEFS);
    expect(available.map((d) => d.id)).not.toContain(DEF_SIMPLE.id);
  });
});

// ---------------------------------------------------------------------------
// initiateProject
// ---------------------------------------------------------------------------

describe('initiateProject', () => {
  it('deducts the upfront cost from resources', () => {
    const state = makeState();
    const next = initiateProject(state, DEF_SIMPLE);
    expect(next.player.resources.funding).toBe(100 - 20);
    expect(next.player.resources.materials).toBe(80 - 10);
  });

  it('adds a ProjectInstance to activeProjects', () => {
    const next = initiateProject(makeState(), DEF_SIMPLE);
    expect(next.player.activeProjects).toHaveLength(1);
    expect(next.player.activeProjects[0].defId).toBe(DEF_SIMPLE.id);
    expect(next.player.activeProjects[0].turnsElapsed).toBe(0);
    expect(next.player.activeProjects[0].effectiveDuration).toBe(DEF_SIMPLE.baseDuration);
  });

  it('adds a news item', () => {
    const state = makeState();
    const next = initiateProject(state, DEF_SIMPLE);
    const added = next.player.newsFeed.slice(state.player.newsFeed.length);
    expect(added).toHaveLength(1);
    expect(added[0].text).toContain(DEF_SIMPLE.name);
  });
});

// ---------------------------------------------------------------------------
// tickActiveProjects
// ---------------------------------------------------------------------------

describe('tickActiveProjects', () => {
  it('increments turnsElapsed for in-progress projects', () => {
    const state = initiateProject(makeState(), DEF_SIMPLE);
    const { state: next } = tickActiveProjects(state, new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]), 2);
    expect(next.player.activeProjects[0].turnsElapsed).toBe(1);
  });

  it('completes a project when turnsElapsed reaches effectiveDuration', () => {
    let state = initiateProject(makeState(), DEF_SIMPLE);
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    // Advance to completion (baseDuration = 2)
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2, completedDefIds } = tickActiveProjects(after1, defs, 3);
    expect(completedDefIds).toContain(DEF_SIMPLE.id);
    expect(after2.player.activeProjects).toHaveLength(0);
    expect(after2.player.completedProjectIds).toContain(DEF_SIMPLE.id);
  });

  it('applies resource reward on completion', () => {
    let state = initiateProject(makeState(), DEF_SIMPLE);
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    const fundingAfterInitiate = state.player.resources.funding;
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2 } = tickActiveProjects(after1, defs, 3);
    // Should have received +15F on completion, minus 2 turns of upkeep (2F/turn)
    expect(after2.player.resources.funding).toBe(fundingAfterInitiate - 2 - 2 + 15);
  });

  it('applies signal progress reward on completion', () => {
    let state = initiateProject(makeState(), DEF_SIMPLE);
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2 } = tickActiveProjects(after1, defs, 3);
    expect(after2.signal.decodeProgress).toBe(10);
  });

  it('deducts upkeep each turn while project is active', () => {
    const state = initiateProject(makeState(), DEF_SIMPLE);
    const fundingAfterInitiate = state.player.resources.funding;
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    // One tick — upkeep 2F deducted, not yet complete
    expect(after1.player.resources.funding).toBe(fundingAfterInitiate - 2);
  });

  it('adds a completion news item', () => {
    let state = initiateProject(makeState(), DEF_SIMPLE);
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const newsFeedBefore = after1.player.newsFeed.length;
    const { state: after2 } = tickActiveProjects(after1, defs, 3);
    const added = after2.player.newsFeed.slice(newsFeedBefore);
    expect(added.some((n) => n.text.includes(DEF_SIMPLE.name))).toBe(true);
    expect(added[0].category).toBe('discovery');
  });

  it('handles unknown project defs gracefully (keeps project in active list)', () => {
    const state = initiateProject(makeState(), DEF_SIMPLE);
    // Pass an empty defs map — the project should remain in place
    const { state: next } = tickActiveProjects(state, new Map(), 2);
    expect(next.player.activeProjects).toHaveLength(1);
  });
});
