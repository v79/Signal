import { describe, it, expect } from 'vitest';
import {
  canInitiateProject,
  canPlaceProducedFacility,
  deferPendingPlacement,
  getAvailableProjects,
  hasAnyEligibleTile,
  initiateProject,
  placePendingFacility,
  tickActiveProjects,
} from './projects';
import type { FacilityDef, GameState, ProjectDef, FacilityInstance, MapTile } from './types';
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
  oneOffReward: { signalProgress: 10, resources: { funding: 15 } },
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

/** A project gated behind a required completed project. */
const DEF_PROJECT_GATED: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'projectGatedProject',
  prerequisites: { requiredProjects: ['testProject'] },
};

/** A project with a multi-turn duration and upkeep. */
const DEF_LONG: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'longProject',
  upkeepCost: { funding: 5 },
  baseDuration: 3,
  oneOffReward: { signalProgress: 20, resources: { funding: 30 } },
  prerequisites: {},
};

const ALL_DEFS: Map<string, ProjectDef> = new Map([
  [DEF_SIMPLE.id, DEF_SIMPLE],
  [DEF_TECH_GATED.id, DEF_TECH_GATED],
  [DEF_FACILITY_GATED.id, DEF_FACILITY_GATED],
  [DEF_ERA_GATED.id, DEF_ERA_GATED],
  [DEF_PROJECT_GATED.id, DEF_PROJECT_GATED],
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

  it('returns false when required project is not completed', () => {
    expect(canInitiateProject(makeState(), DEF_PROJECT_GATED)).toBe(false);
  });

  it('returns true when required project is completed', () => {
    const state = { ...makeState(), player: { ...makeState().player, completedProjectIds: { testProject: 1 } } };
    expect(canInitiateProject(state, DEF_PROJECT_GATED)).toBe(true);
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
    expect(available.map((d) => d.id)).not.toContain(DEF_PROJECT_GATED.id);
  });

  it('excludes projects already active', () => {
    const state = makeState();
    const active = { ...state, player: { ...state.player, activeProjects: [{ id: 'testProject-t1', defId: DEF_SIMPLE.id, startTurn: 1, turnsElapsed: 0, effectiveDuration: 2 }] } };
    const available = getAvailableProjects(active, ALL_DEFS);
    expect(available.map((d) => d.id)).not.toContain(DEF_SIMPLE.id);
  });

  it('excludes completed projects', () => {
    const state = makeState();
    const done = { ...state, player: { ...state.player, completedProjectIds: { [DEF_SIMPLE.id]: 1 } } };
    const available = getAvailableProjects(done, ALL_DEFS);
    expect(available.map((d) => d.id)).not.toContain(DEF_SIMPLE.id);
  });

  it('unlocks a project-gated project once its prerequisite is completed', () => {
    const state = { ...makeState(), player: { ...makeState().player, completedProjectIds: { testProject: 1 } } };
    const available = getAvailableProjects(state, ALL_DEFS);
    expect(available.map((d) => d.id)).toContain(DEF_PROJECT_GATED.id);
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
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2, completedDefIds } = tickActiveProjects(after1, defs, 3);
    expect(completedDefIds).toContain(DEF_SIMPLE.id);
    expect(after2.player.activeProjects).toHaveLength(0);
    expect(after2.player.completedProjectIds).toHaveProperty(DEF_SIMPLE.id);
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
    const { state: next } = tickActiveProjects(state, new Map(), 2);
    expect(next.player.activeProjects).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Pending facility placements (manualTile flow)
// ---------------------------------------------------------------------------

const FAC_TEST: FacilityDef = {
  id: 'testFacility',
  name: 'Test Facility',
  description: 'A facility produced by a test project.',
  era: 'earth',
  allowedTileTypes: ['urban'],
  buildCost: {},
  upkeepCost: {},
  buildTime: 0,
  deleteTime: 0,
  canDelete: true,
  fieldOutput: { physics: 1 },
  resourceOutput: {},
  adjacencyBonuses: [],
  adjacencyPenalties: [],
  depletes: false,
  requiredTechId: null,
};

const DEF_PRODUCES_MANUAL: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'producesManualProject',
  producesFacility: { defId: 'testFacility', placement: 'manualTile' },
};

const DEF_PRODUCES_HOST: ProjectDef = {
  ...DEF_SIMPLE,
  id: 'producesHostProject',
  producesFacility: {
    defId: 'testFacility',
    placement: 'anchoredToHost',
    hostFacilityDefId: 'researchLab',
  },
};

const FACILITY_DEFS = new Map<string, FacilityDef>([[FAC_TEST.id, FAC_TEST]]);

function withTile(state: GameState, tile: MapTile): GameState {
  return {
    ...state,
    map: { ...state.map, earthTiles: [...state.map.earthTiles, tile] },
  };
}

function makeTile(overrides: Partial<MapTile> = {}): MapTile {
  return {
    coord: { q: 0, r: 0 },
    type: 'urban',
    destroyedStatus: null,
    productivity: 1.0,
    mineDepletion: 1.0,
    facilitySlots: [null, null, null],
    pendingActionId: null,
    ...overrides,
  };
}

describe('tickActiveProjects — manualTile placement', () => {
  it('writes a pending placement entry on completion of a manualTile producer', () => {
    let state = initiateProject(makeState(), DEF_PRODUCES_MANUAL);
    const defs = new Map([[DEF_PRODUCES_MANUAL.id, DEF_PRODUCES_MANUAL]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2, newPendingPlacements } = tickActiveProjects(after1, defs, 3);
    expect(newPendingPlacements).toHaveLength(1);
    expect(after2.pendingFacilityPlacements).toHaveLength(1);
    expect(after2.pendingFacilityPlacements[0]).toMatchObject({
      sourceId: DEF_PRODUCES_MANUAL.id,
      facilityDefId: 'testFacility',
      deferCount: 0,
    });
  });

  it('does not duplicate the pending entry across subsequent ticks', () => {
    let state = initiateProject(makeState(), DEF_PRODUCES_MANUAL);
    const defs = new Map([[DEF_PRODUCES_MANUAL.id, DEF_PRODUCES_MANUAL]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2 } = tickActiveProjects(after1, defs, 3);
    // Tick again with no active projects — pending entry should remain stable.
    const { state: after3, newPendingPlacements } = tickActiveProjects(after2, defs, 4);
    expect(newPendingPlacements).toHaveLength(0);
    expect(after3.pendingFacilityPlacements).toHaveLength(1);
  });

  it('does not write a pending entry for an anchoredToHost producer (CERN regression)', () => {
    let state = initiateProject(makeState(), DEF_PRODUCES_HOST);
    const defs = new Map([[DEF_PRODUCES_HOST.id, DEF_PRODUCES_HOST]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2, newPendingPlacements } = tickActiveProjects(after1, defs, 3);
    expect(newPendingPlacements).toHaveLength(0);
    expect(after2.pendingFacilityPlacements).toHaveLength(0);
  });

  it('does not write a pending entry for projects without producesFacility', () => {
    let state = initiateProject(makeState(), DEF_SIMPLE);
    const defs = new Map([[DEF_SIMPLE.id, DEF_SIMPLE]]);
    const { state: after1 } = tickActiveProjects(state, defs, 2);
    const { state: after2 } = tickActiveProjects(after1, defs, 3);
    expect(after2.pendingFacilityPlacements).toHaveLength(0);
  });
});

describe('canPlaceProducedFacility', () => {
  it('returns true for a matching empty tile', () => {
    expect(canPlaceProducedFacility(makeTile(), FAC_TEST, 0)).toBe(true);
  });

  it('returns false when tile type is not in allowedTileTypes', () => {
    expect(canPlaceProducedFacility(makeTile({ type: 'forested' }), FAC_TEST, 0)).toBe(false);
  });

  it('returns false when tile is destroyed', () => {
    expect(canPlaceProducedFacility(makeTile({ destroyedStatus: 'flooded' }), FAC_TEST, 0)).toBe(
      false,
    );
  });

  it('returns false when tile has a pending construction action', () => {
    expect(
      canPlaceProducedFacility(makeTile({ pendingActionId: 'queued-action' }), FAC_TEST, 0),
    ).toBe(false);
  });

  it('returns false when target slot is occupied', () => {
    const tile = makeTile({ facilitySlots: ['existing', null, null] });
    expect(canPlaceProducedFacility(tile, FAC_TEST, 0)).toBe(false);
  });

  it('respects multi-slot facilities', () => {
    const multiSlot: FacilityDef = { ...FAC_TEST, slotCost: 2 };
    expect(canPlaceProducedFacility(makeTile(), multiSlot, 0)).toBe(true);
    // Slot 2 with slotCost 2 would overflow.
    expect(canPlaceProducedFacility(makeTile(), multiSlot, 2)).toBe(false);
  });
});

describe('hasAnyEligibleTile', () => {
  it('returns true when at least one tile is eligible', () => {
    expect(hasAnyEligibleTile([makeTile()], FAC_TEST)).toBe(true);
  });

  it('returns false when no tile is eligible', () => {
    expect(hasAnyEligibleTile([makeTile({ type: 'forested' })], FAC_TEST)).toBe(false);
  });

  it('returns false on empty tile list', () => {
    expect(hasAnyEligibleTile([], FAC_TEST)).toBe(false);
  });
});

describe('placePendingFacility', () => {
  function stateWithPending(): GameState {
    const state = withTile(makeState(), makeTile());
    return {
      ...state,
      pendingFacilityPlacements: [
        { sourceId: DEF_PRODUCES_MANUAL.id, facilityDefId: FAC_TEST.id, deferCount: 0 },
      ],
    };
  }

  it('creates a FacilityInstance on the chosen tile', () => {
    const state = stateWithPending();
    const next = placePendingFacility(state, DEF_PRODUCES_MANUAL.id, '0,0', 0, FACILITY_DEFS);
    expect(next.player.facilities).toHaveLength(1);
    expect(next.player.facilities[0]).toMatchObject({
      defId: FAC_TEST.id,
      locationKey: '0,0',
      condition: 1.0,
      builtTurn: state.turn,
    });
    expect(next.map.earthTiles[0].facilitySlots[0]).toBe(next.player.facilities[0].id);
  });

  it('removes the pending entry on placement', () => {
    const state = stateWithPending();
    const next = placePendingFacility(state, DEF_PRODUCES_MANUAL.id, '0,0', 0, FACILITY_DEFS);
    expect(next.pendingFacilityPlacements).toHaveLength(0);
  });

  it('adds a placement-completed news item', () => {
    const state = stateWithPending();
    const next = placePendingFacility(state, DEF_PRODUCES_MANUAL.id, '0,0', 0, FACILITY_DEFS);
    const added = next.player.newsFeed.slice(state.player.newsFeed.length);
    expect(added).toHaveLength(1);
    expect(added[0].text).toContain(FAC_TEST.name);
  });

  it('throws when no pending entry exists for the project', () => {
    const state = withTile(makeState(), makeTile());
    expect(() =>
      placePendingFacility(state, 'unknownProject', '0,0', 0, FACILITY_DEFS),
    ).toThrow();
  });

  it('throws when the chosen tile cannot host the facility', () => {
    const state = {
      ...withTile(makeState(), makeTile({ type: 'forested' })),
      pendingFacilityPlacements: [
        { sourceId: DEF_PRODUCES_MANUAL.id, facilityDefId: FAC_TEST.id, deferCount: 0 },
      ],
    };
    expect(() =>
      placePendingFacility(state, DEF_PRODUCES_MANUAL.id, '0,0', 0, FACILITY_DEFS),
    ).toThrow();
  });

  // Multi-turn build path — facilities with buildTime > 0 must enqueue an
  // OngoingAction rather than instantly creating a FacilityInstance.
  describe('with buildTime > 0', () => {
    const FAC_MULTI: FacilityDef = { ...FAC_TEST, id: 'slowFacility', buildTime: 4 };
    const DEFS_MULTI = new Map<string, FacilityDef>([[FAC_MULTI.id, FAC_MULTI]]);
    const PROJ_MULTI = 'multiTurnProject';

    function stateWithMultiPending(): GameState {
      const state = withTile(makeState(), makeTile());
      return {
        ...state,
        pendingFacilityPlacements: [
          { sourceId: PROJ_MULTI, facilityDefId: FAC_MULTI.id, deferCount: 0 },
        ],
      };
    }

    it('does NOT create a FacilityInstance immediately', () => {
      const state = stateWithMultiPending();
      const next = placePendingFacility(state, PROJ_MULTI, '0,0', 0, DEFS_MULTI);
      expect(next.player.facilities).toHaveLength(0);
    });

    it('enqueues an OngoingAction with the def buildTime', () => {
      const state = stateWithMultiPending();
      const next = placePendingFacility(state, PROJ_MULTI, '0,0', 0, DEFS_MULTI);
      expect(next.player.constructionQueue).toHaveLength(1);
      expect(next.player.constructionQueue[0]).toMatchObject({
        type: 'construct',
        facilityDefId: FAC_MULTI.id,
        coordKey: '0,0',
        turnsRemaining: 4,
        totalTurns: 4,
        slotIndex: 0,
      });
    });

    it('marks the chosen tile pending with the action id', () => {
      const state = stateWithMultiPending();
      const next = placePendingFacility(state, PROJ_MULTI, '0,0', 0, DEFS_MULTI);
      const tile = next.map.earthTiles.find((t) => `${t.coord.q},${t.coord.r}` === '0,0');
      expect(tile?.pendingActionId).toBe(next.player.constructionQueue[0].id);
      expect(tile?.facilitySlots).toEqual([null, null, null]);
    });

    it('removes the pending entry even though build is incomplete', () => {
      const state = stateWithMultiPending();
      const next = placePendingFacility(state, PROJ_MULTI, '0,0', 0, DEFS_MULTI);
      expect(next.pendingFacilityPlacements).toHaveLength(0);
    });

    it('adds a "construction begun" news item that mentions the build time', () => {
      const state = stateWithMultiPending();
      const next = placePendingFacility(state, PROJ_MULTI, '0,0', 0, DEFS_MULTI);
      const added = next.player.newsFeed.slice(state.player.newsFeed.length);
      expect(added).toHaveLength(1);
      expect(added[0].text).toContain(FAC_MULTI.name);
      expect(added[0].text).toContain('4 turns');
    });
  });
});

describe('deferPendingPlacement', () => {
  it('increments deferCount on the matching entry', () => {
    const state: GameState = {
      ...makeState(),
      pendingFacilityPlacements: [
        { sourceId: 'a', facilityDefId: 'x', deferCount: 0 },
        { sourceId: 'b', facilityDefId: 'y', deferCount: 1 },
      ],
    };
    const next = deferPendingPlacement(state, 'a');
    expect(next.pendingFacilityPlacements[0].deferCount).toBe(1);
    expect(next.pendingFacilityPlacements[1].deferCount).toBe(1);
  });

  it('reaches the blocking threshold (>= 3) after three defers', () => {
    let state: GameState = {
      ...makeState(),
      pendingFacilityPlacements: [{ sourceId: 'a', facilityDefId: 'x', deferCount: 0 }],
    };
    state = deferPendingPlacement(state, 'a');
    state = deferPendingPlacement(state, 'a');
    state = deferPendingPlacement(state, 'a');
    expect(state.pendingFacilityPlacements[0].deferCount).toBe(3);
  });
});
