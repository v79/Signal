import { describe, it, expect } from 'vitest';
import {
  coordKey,
  computeAdjacencyEffects,
  computeFacilityOutput,
  tickMineDepletion,
  MINE_DEPLETION_RATE,
  isUniqueAlreadyBuilt,
} from './facilities';
import type { FacilityDef, FacilityInstance, MapTile } from './types';
import { ZERO_FIELDS, ZERO_RESOURCES } from './state';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const universityDef: FacilityDef = {
  id: 'university',
  name: 'University Campus',
  description: '',
  era: 'earth',
  allowedTileTypes: ['urban'],
  buildCost: { funding: 50 },
  upkeepCost: { funding: 5 },
  buildTime: 2,
  deleteTime: 1,
  canDelete: true,
  fieldOutput: { mathematics: 10, physics: 5 },
  resourceOutput: {},
  adjacencyBonuses: [{ neighborDefId: 'researchLab', fieldBonus: { physics: 3, mathematics: 3 } }],
  adjacencyPenalties: [],
  depletes: false,
  requiredTechId: null,
};

const researchLabDef: FacilityDef = {
  id: 'researchLab',
  name: 'Research Laboratory',
  description: '',
  era: 'earth',
  allowedTileTypes: ['urban', 'industrial'],
  buildCost: { funding: 40 },
  upkeepCost: { funding: 4 },
  buildTime: 2,
  deleteTime: 1,
  canDelete: true,
  fieldOutput: { physics: 8, computing: 5 },
  resourceOutput: {},
  adjacencyBonuses: [{ neighborDefId: 'university', fieldBonus: { physics: 3, mathematics: 3 } }],
  adjacencyPenalties: [],
  depletes: false,
  requiredTechId: null,
};

const militaryDef: FacilityDef = {
  id: 'militaryInstallation',
  name: 'Military Installation',
  description: '',
  era: 'earth',
  allowedTileTypes: ['urban', 'highland'],
  buildCost: { funding: 60 },
  upkeepCost: { funding: 8 },
  buildTime: 1,
  deleteTime: 1,
  canDelete: true,
  fieldOutput: { engineering: 5 },
  resourceOutput: {},
  adjacencyBonuses: [],
  adjacencyPenalties: [
    { neighborDefId: 'university', fieldPenalty: { mathematics: 2, physics: 2 } },
  ],
  depletes: false,
  requiredTechId: null,
};

const mineDef: FacilityDef = {
  id: 'mine',
  name: 'Mine',
  description: '',
  era: 'earth',
  allowedTileTypes: ['highland', 'arid'],
  buildCost: { funding: 30 },
  upkeepCost: { funding: 2 },
  buildTime: 1,
  deleteTime: 1,
  canDelete: true,
  fieldOutput: {},
  resourceOutput: { materials: 20 },
  adjacencyBonuses: [],
  adjacencyPenalties: [],
  depletes: true,
  requiredTechId: null,
};

const defs = new Map([
  ['university', universityDef],
  ['researchLab', researchLabDef],
  ['militaryInstallation', militaryDef],
  ['mine', mineDef],
]);

function makeFacility(id: string, defId: string, locationKey: string): FacilityInstance {
  return { id, defId, locationKey, condition: 1, builtTurn: 1 };
}

function makeTile(q: number, r: number, facilityId: string | null = null): MapTile {
  return {
    coord: { q, r },
    type: 'urban',
    destroyedStatus: null,
    productivity: 1,
    mineDepletion: 1,
    facilitySlots: facilityId ? [facilityId, null, null] : [null, null, null],
    pendingActionId: null,
  };
}

// ---------------------------------------------------------------------------
// coordKey
// ---------------------------------------------------------------------------

describe('coordKey', () => {
  it('formats axial coordinates as "q,r"', () => {
    expect(coordKey({ q: 2, r: -3 })).toBe('2,-3');
    expect(coordKey({ q: 0, r: 0 })).toBe('0,0');
  });
});

// ---------------------------------------------------------------------------
// computeAdjacencyEffects
// ---------------------------------------------------------------------------

describe('computeAdjacencyEffects', () => {
  it('returns no effects when there are no facilities', () => {
    const effects = computeAdjacencyEffects([], defs, []);
    expect(effects).toHaveLength(0);
  });

  it('returns an effect with zero bonuses for an isolated facility', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile = makeTile(0, 0, 'u1');
    const effects = computeAdjacencyEffects([facility], defs, [tile]);

    expect(effects).toHaveLength(1);
    expect(effects[0].fieldBonus).toEqual(ZERO_FIELDS);
    expect(effects[0].resourceBonus).toEqual(ZERO_RESOURCES);
  });

  it('applies bonus when University is adjacent to Research Lab', () => {
    // University at (0,0), Research Lab at (1,0) — hex neighbours
    const uFacility = makeFacility('u1', 'university', '0,0');
    const rFacility = makeFacility('r1', 'researchLab', '1,0');
    const tiles = [makeTile(0, 0, 'u1'), makeTile(1, 0, 'r1')];

    const effects = computeAdjacencyEffects([uFacility, rFacility], defs, tiles);

    const uEffect = effects.find((e) => e.facilityInstanceId === 'u1')!;
    const rEffect = effects.find((e) => e.facilityInstanceId === 'r1')!;

    // University gets bonus from Research Lab neighbour
    expect(uEffect.fieldBonus.physics).toBe(3);
    expect(uEffect.fieldBonus.mathematics).toBe(3);

    // Research Lab gets bonus from University neighbour
    expect(rEffect.fieldBonus.physics).toBe(3);
    expect(rEffect.fieldBonus.mathematics).toBe(3);
  });

  it('does not apply bonus when facilities are not adjacent', () => {
    // University at (0,0), Research Lab at (5,5) — not neighbours
    const uFacility = makeFacility('u1', 'university', '0,0');
    const rFacility = makeFacility('r1', 'researchLab', '5,5');
    const tiles = [makeTile(0, 0, 'u1'), makeTile(5, 5, 'r1')];

    const effects = computeAdjacencyEffects([uFacility, rFacility], defs, tiles);

    const uEffect = effects.find((e) => e.facilityInstanceId === 'u1')!;
    expect(uEffect.fieldBonus.physics).toBe(0);
    expect(uEffect.fieldBonus.mathematics).toBe(0);
  });

  it('applies adjacency penalty when Military is adjacent to University', () => {
    const mFacility = makeFacility('m1', 'militaryInstallation', '0,0');
    const uFacility = makeFacility('u1', 'university', '1,0');
    const tiles = [makeTile(0, 0, 'm1'), makeTile(1, 0, 'u1')];

    const effects = computeAdjacencyEffects([mFacility, uFacility], defs, tiles);

    const mEffect = effects.find((e) => e.facilityInstanceId === 'm1')!;
    expect(mEffect.fieldBonus.mathematics).toBe(-2);
    expect(mEffect.fieldBonus.physics).toBe(-2);
  });

  it('skips destroyed tiles', () => {
    const uFacility = makeFacility('u1', 'university', '0,0');
    const rFacility = makeFacility('r1', 'researchLab', '1,0');
    const tiles: MapTile[] = [
      makeTile(0, 0, 'u1'),
      { ...makeTile(1, 0, 'r1'), destroyedStatus: 'flooded' },
    ];

    const effects = computeAdjacencyEffects([uFacility, rFacility], defs, tiles);

    // Flooded tile is excluded from adjacency — University gets no bonus
    const uEffect = effects.find((e) => e.facilityInstanceId === 'u1');
    expect(uEffect?.fieldBonus.physics ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeFacilityOutput
// ---------------------------------------------------------------------------

describe('computeFacilityOutput', () => {
  it('returns zero output with no facilities', () => {
    const { totalFields, totalResources } = computeFacilityOutput([], defs, [], []);
    expect(totalFields).toEqual(ZERO_FIELDS);
    expect(totalResources).toEqual(ZERO_RESOURCES);
  });

  it('returns correct base output for a single facility', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile = makeTile(0, 0, 'u1');
    const adjacency = computeAdjacencyEffects([facility], defs, [tile]);

    const { totalFields, totalResources } = computeFacilityOutput([facility], defs, adjacency, [
      tile,
    ]);

    expect(totalFields.mathematics).toBe(10);
    expect(totalFields.physics).toBe(5);
    // Upkeep of 5 Funding subtracted from resources
    expect(totalResources.funding).toBe(-5);
  });

  it('scales output by tile productivity', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile: MapTile = { ...makeTile(0, 0, 'u1'), productivity: 0.5 };
    const adjacency = computeAdjacencyEffects([facility], defs, [tile]);

    const { totalFields } = computeFacilityOutput([facility], defs, adjacency, [tile]);

    expect(totalFields.mathematics).toBe(5); // 10 * 0.5
    expect(totalFields.physics).toBe(2.5); // 5 * 0.5
  });

  it('scales output by facility condition', () => {
    const facility: FacilityInstance = { ...makeFacility('m1', 'mine', '0,0'), condition: 0.5 };
    const tile: MapTile = { ...makeTile(0, 0, 'm1'), type: 'highland' };
    const adjacency = computeAdjacencyEffects([facility], defs, [tile]);

    const { totalResources } = computeFacilityOutput([facility], defs, adjacency, [tile]);

    // 20 materials * 0.5 condition = 10 (upkeep is 2 Funding, not Materials)
    expect(totalResources.materials).toBe(10);
    expect(totalResources.funding).toBe(-2);
  });

  it('includes adjacency bonuses in output', () => {
    const uFacility = makeFacility('u1', 'university', '0,0');
    const rFacility = makeFacility('r1', 'researchLab', '1,0');
    const tiles = [makeTile(0, 0, 'u1'), makeTile(1, 0, 'r1')];
    const adjacency = computeAdjacencyEffects([uFacility, rFacility], defs, tiles);

    const { totalFields } = computeFacilityOutput([uFacility, rFacility], defs, adjacency, tiles);

    // University: 5 physics base + 3 adjacency bonus
    // Research Lab: 8 physics base + 3 adjacency bonus
    expect(totalFields.physics).toBe(5 + 3 + 8 + 3);
    // Mathematics: 10 base + 3 adjacency (university) + 0 base + 3 adjacency (lab)
    expect(totalFields.mathematics).toBe(10 + 3 + 3);
  });
});

// ---------------------------------------------------------------------------
// tickMineDepletion
// ---------------------------------------------------------------------------

describe('tickMineDepletion', () => {
  it('does not deplete non-depleting facilities', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile = makeTile(0, 0);
    const { facilities } = tickMineDepletion([facility], defs, [tile]);
    expect(facilities[0].condition).toBe(1);
  });

  it('depletes mine condition by MINE_DEPLETION_RATE per turn', () => {
    const facility = makeFacility('m1', 'mine', '0,0');
    const tile = makeTile(0, 0);
    const { facilities } = tickMineDepletion([facility], defs, [tile]);
    expect(facilities[0].condition).toBeCloseTo(1 - MINE_DEPLETION_RATE);
  });

  it('depletes tile mineDepletion in sync with facility condition', () => {
    const facility = makeFacility('m1', 'mine', '0,0');
    const tile = makeTile(0, 0);
    const { tiles } = tickMineDepletion([facility], defs, [tile]);
    expect(tiles[0].mineDepletion).toBeCloseTo(1 - MINE_DEPLETION_RATE);
  });

  it('clamps mine condition at 0', () => {
    const facility: FacilityInstance = { ...makeFacility('m1', 'mine', '0,0'), condition: 0.005 };
    const tile = makeTile(0, 0);
    const { facilities } = tickMineDepletion([facility], defs, [tile]);
    expect(facilities[0].condition).toBe(0);
  });

  it('does not mutate the input array', () => {
    const facility = makeFacility('m1', 'mine', '0,0');
    const tile = makeTile(0, 0);
    const original = [facility];
    tickMineDepletion(original, defs, [tile]);
    expect(original[0].condition).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isUniqueAlreadyBuilt
// ---------------------------------------------------------------------------

describe('isUniqueAlreadyBuilt', () => {
  it('returns false when no facilities exist', () => {
    expect(isUniqueAlreadyBuilt([], [], 'deepSpaceArray')).toBe(false);
  });

  it('returns true when a facility instance with the def ID exists', () => {
    const facility = makeFacility('dsa-1', 'deepSpaceArray', '0,0');
    expect(isUniqueAlreadyBuilt([facility], [], 'deepSpaceArray')).toBe(true);
  });

  it('returns false for a different def ID', () => {
    const facility = makeFacility('dsa-1', 'deepSpaceArray', '0,0');
    expect(isUniqueAlreadyBuilt([facility], [], 'university')).toBe(false);
  });

  it('returns true when the facility is in the construction queue', () => {
    const action: import('./types').OngoingAction = {
      id: 'a1',
      type: 'construct',
      facilityDefId: 'deepSpaceArray',
      coordKey: '1,0',
      turnsRemaining: 2,
      totalTurns: 3,
      slotIndex: 0,
    };
    expect(isUniqueAlreadyBuilt([], [action], 'deepSpaceArray')).toBe(true);
  });

  it('ignores demolish actions in the queue', () => {
    const action: import('./types').OngoingAction = {
      id: 'a1',
      type: 'demolish',
      facilityDefId: 'deepSpaceArray',
      coordKey: '1,0',
      turnsRemaining: 1,
      totalTurns: 1,
      slotIndex: 0,
    };
    expect(isUniqueAlreadyBuilt([], [action], 'deepSpaceArray')).toBe(false);
  });
});
