import { describe, it, expect } from 'vitest';
import {
  coordKey,
  computeAdjacencyEffects,
  computeFacilityOutput,
  computeResourceBreakdown,
  computeClimateBreakdown,
  computeHqBonus,
  getFacilitiesOnTile,
  getTileSummary,
  findContiguousFreeStart,
  tickMineDepletion,
  MINE_DEPLETION_RATE,
  isUniqueAlreadyBuilt,
  canUpgradeFacility,
  getChainRoot,
  isLunarChainTaken,
} from './facilities';
import type {
  FacilityDef,
  FacilityInstance,
  MapTile,
  SpaceNode,
  TechState,
  OngoingAction,
} from './types';
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

// ---------------------------------------------------------------------------
// getFacilitiesOnTile
// ---------------------------------------------------------------------------

describe('getFacilitiesOnTile', () => {
  it('returns empty array for an empty tile', () => {
    expect(getFacilitiesOnTile(makeTile(0, 0), [])).toEqual([]);
  });

  it('deduplicates multi-slot entries that repeat the same instance ID', () => {
    const f = makeFacility('u1', 'university', '0,0');
    const tile: MapTile = { ...makeTile(0, 0), facilitySlots: ['u1', 'u1', null] };
    const result = getFacilitiesOnTile(tile, [f]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u1');
  });

  it('skips slot IDs with no matching FacilityInstance', () => {
    const tile: MapTile = { ...makeTile(0, 0), facilitySlots: ['ghost', null, null] };
    expect(getFacilitiesOnTile(tile, [])).toEqual([]);
  });

  it('returns facilities in slot order, deduplicated', () => {
    const a = makeFacility('a', 'university', '0,0');
    const b = makeFacility('b', 'researchLab', '0,0');
    const tile: MapTile = { ...makeTile(0, 0), facilitySlots: ['a', 'b', 'a'] };
    const result = getFacilitiesOnTile(tile, [a, b]);
    expect(result.map((f) => f.id)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// findContiguousFreeStart
// ---------------------------------------------------------------------------

describe('findContiguousFreeStart', () => {
  it('returns 0 for an empty tile', () => {
    expect(findContiguousFreeStart([null, null, null], 1)).toBe(0);
    expect(findContiguousFreeStart([null, null, null], 3)).toBe(0);
  });

  it('finds the lowest contiguous run that fits slotCost', () => {
    expect(findContiguousFreeStart(['x', null, null], 2)).toBe(1);
    expect(findContiguousFreeStart([null, 'x', null], 1)).toBe(0);
    expect(findContiguousFreeStart([null, 'x', null], 2)).toBeNull();
  });

  it('returns null when no contiguous run exists', () => {
    expect(findContiguousFreeStart(['a', 'b', 'c'], 1)).toBeNull();
    expect(findContiguousFreeStart([null, 'x', null], 3)).toBeNull();
  });

  it('handles slotCost 3 only when the tile is completely empty', () => {
    expect(findContiguousFreeStart([null, null, null], 3)).toBe(0);
    expect(findContiguousFreeStart(['x', null, null], 3)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeFacilityOutput — space/supply behaviour
// ---------------------------------------------------------------------------

describe('computeFacilityOutput — space and supply', () => {
  const spaceMineDef: FacilityDef = {
    id: 'lunarMine',
    name: 'Lunar Mine',
    description: '',
    era: 'nearSpace',
    allowedTileTypes: [],
    buildCost: {},
    upkeepCost: { funding: 3 },
    buildTime: 1,
    deleteTime: 1,
    canDelete: true,
    fieldOutput: {},
    resourceOutput: { materials: 30 },
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: true,
    requiredTechId: null,
    supplyCost: 1,
  };

  const spaceDefs = new Map([...defs, ['lunarMine', spaceMineDef]]);

  const lunarNode: SpaceNode = {
    id: 'shackleton',
    type: 'lunarSurface',
    label: 'Shackleton Crater',
    launchCost: 10,
    facilityId: 'lunarMine',
  };

  it('pays upkeep but produces nothing when an unsupplied space facility is not ISRU-exempt', () => {
    const facility = makeFacility('lm1', 'lunarMine', 'shackleton');
    const { totalResources } = computeFacilityOutput(
      [facility],
      spaceDefs,
      [],
      [],
      { shackleton: false },
      [lunarNode],
      false,
    );
    expect(totalResources.materials).toBe(0);
    expect(totalResources.funding).toBe(-3); // upkeep only
  });

  it('ISRU-exempt lunar surface facilities produce even when unsupplied', () => {
    const facility = makeFacility('lm1', 'lunarMine', 'shackleton');
    const { totalResources } = computeFacilityOutput(
      [facility],
      spaceDefs,
      [],
      [],
      { shackleton: false },
      [lunarNode],
      true,
    );
    expect(totalResources.materials).toBe(30);
    expect(totalResources.funding).toBe(-3);
  });

  it('supplied space facilities produce normally', () => {
    const facility = makeFacility('lm1', 'lunarMine', 'shackleton');
    const { totalResources } = computeFacilityOutput(
      [facility],
      spaceDefs,
      [],
      [],
      { shackleton: true },
      [lunarNode],
      false,
    );
    expect(totalResources.materials).toBe(30);
    expect(totalResources.funding).toBe(-3);
  });

  it('facilities on destroyed tiles produce nothing but still pay upkeep', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile: MapTile = { ...makeTile(0, 0, 'u1'), destroyedStatus: 'flooded' };
    const adjacency = computeAdjacencyEffects([facility], defs, [tile]);
    const { totalFields, totalResources } = computeFacilityOutput(
      [facility],
      defs,
      adjacency,
      [tile],
    );
    expect(totalFields.mathematics).toBe(0);
    expect(totalResources.funding).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// computeResourceBreakdown
// ---------------------------------------------------------------------------

describe('computeResourceBreakdown', () => {
  it('returns empty lists with no facilities', () => {
    const result = computeResourceBreakdown([], defs, [], []);
    expect(result.funding).toEqual([]);
    expect(result.materials).toEqual([]);
    expect(result.politicalWill).toEqual([]);
  });

  it('groups facilities of the same type and sums their contributions', () => {
    const u1 = makeFacility('u1', 'university', '0,0');
    const u2 = makeFacility('u2', 'university', '2,2');
    const tiles = [makeTile(0, 0, 'u1'), makeTile(2, 2, 'u2')];
    const result = computeResourceBreakdown([u1, u2], defs, [], tiles);
    const funding = result.funding.find((e) => e.label === 'University Campus');
    expect(funding?.amount).toBe(-10); // two copies of upkeep 5
  });

  it('includes adjacency bonuses when present', () => {
    const mineUnderground = makeFacility('m1', 'mine', '0,0');
    const tile: MapTile = { ...makeTile(0, 0, 'm1'), type: 'highland' };
    const adj = [
      {
        facilityInstanceId: 'm1',
        fieldBonus: { ...ZERO_FIELDS },
        resourceBonus: { ...ZERO_RESOURCES, materials: 5 },
      },
    ];
    const result = computeResourceBreakdown([mineUnderground], defs, adj, [tile]);
    const materials = result.materials.find((e) => e.label === 'Mine');
    expect(materials?.amount).toBe(25); // 20 base + 5 adjacency
  });

  it('omits entries that round to zero', () => {
    // University outputs no resource income, only upkeep. Remove upkeep by giving it 0.
    const zeroDef: FacilityDef = { ...defs.get('university')!, upkeepCost: {} };
    const localDefs = new Map(defs);
    localDefs.set('university', zeroDef);
    const facility = makeFacility('u1', 'university', '0,0');
    const result = computeResourceBreakdown([facility], localDefs, [], [makeTile(0, 0, 'u1')]);
    expect(result.funding).toEqual([]);
  });

  it('sorts entries by amount descending', () => {
    const upkeepHigher: FacilityDef = { ...defs.get('university')!, upkeepCost: { funding: 10 } };
    const localDefs = new Map(defs);
    localDefs.set('university', upkeepHigher);
    const u = makeFacility('u1', 'university', '0,0');
    const m = makeFacility('mi1', 'militaryInstallation', '1,0');
    const tiles = [makeTile(0, 0, 'u1'), makeTile(1, 0, 'mi1')];
    const result = computeResourceBreakdown([u, m], localDefs, [], tiles);
    const amounts = result.funding.map((e) => e.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('includes willExtras under politicalWill when provided', () => {
    const result = computeResourceBreakdown([], defs, [], [], { bankDecay: 2, drift: -3 });
    expect(result.politicalWill).toContainEqual({ label: 'Card banking', amount: -2 });
    expect(result.politicalWill).toContainEqual({ label: 'Natural drift', amount: -3 });
  });

  it('labels positive will drift as Natural recovery', () => {
    const result = computeResourceBreakdown([], defs, [], [], { bankDecay: 0, drift: 4 });
    expect(result.politicalWill).toContainEqual({ label: 'Natural recovery', amount: 4 });
  });

  it('excludes output but includes upkeep for unsupplied space facilities', () => {
    const spaceDef: FacilityDef = {
      ...defs.get('mine')!,
      id: 'spaceMine',
      name: 'Space Mine',
      supplyCost: 1,
    };
    const spaceDefs = new Map([...defs, ['spaceMine', spaceDef]]);
    const node: SpaceNode = {
      id: 'leo',
      type: 'lowEarthOrbit',
      label: 'LEO',
      launchCost: 1,
      facilityId: 'spaceMine',
    };
    const facility = makeFacility('sm1', 'spaceMine', 'leo');
    const result = computeResourceBreakdown(
      [facility],
      spaceDefs,
      [],
      [],
      undefined,
      { leo: false },
      [node],
      false,
    );
    const materials = result.materials.find((e) => e.label === 'Space Mine');
    expect(materials).toBeUndefined(); // output suppressed
    const funding = result.funding.find((e) => e.label === 'Space Mine');
    expect(funding?.amount).toBe(-2); // upkeep still applied
  });
});

// ---------------------------------------------------------------------------
// computeClimateBreakdown
// ---------------------------------------------------------------------------

describe('computeClimateBreakdown', () => {
  const coalDef: FacilityDef = {
    ...defs.get('mine')!,
    id: 'coalPlant',
    name: 'Coal Plant',
    climateImpact: 4,
  };
  const forestDef: FacilityDef = {
    ...defs.get('mine')!,
    id: 'forest',
    name: 'Forest Reserve',
    climateImpact: -2,
  };
  const climateDefs = new Map([...defs, ['coalPlant', coalDef], ['forest', forestDef]]);

  it('returns base rate with no facilities', () => {
    const result = computeClimateBreakdown([], climateDefs, 5);
    expect(result.base).toBe(5);
    expect(result.entries).toEqual([]);
  });

  it('groups facilities by name and sums climateImpact', () => {
    const c1 = makeFacility('c1', 'coalPlant', '0,0');
    const c2 = makeFacility('c2', 'coalPlant', '1,0');
    const f = makeFacility('f1', 'forest', '2,0');
    const result = computeClimateBreakdown([c1, c2, f], climateDefs, 3);
    expect(result.entries).toContainEqual({ label: 'Coal Plant', amount: 8 });
    expect(result.entries).toContainEqual({ label: 'Forest Reserve', amount: -2 });
  });

  it('sorts polluters first, mitigators last', () => {
    const c = makeFacility('c1', 'coalPlant', '0,0');
    const f = makeFacility('f1', 'forest', '1,0');
    const result = computeClimateBreakdown([c, f], climateDefs, 0);
    expect(result.entries[0].label).toBe('Coal Plant');
    expect(result.entries[result.entries.length - 1].label).toBe('Forest Reserve');
  });

  it('skips facilities with zero or missing climateImpact', () => {
    const neutral = makeFacility('u1', 'university', '0,0');
    const result = computeClimateBreakdown([neutral], climateDefs, 1);
    expect(result.entries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeHqBonus
// ---------------------------------------------------------------------------

describe('computeHqBonus', () => {
  it('democratic profile yields funding/will + computing/socialScience', () => {
    const bonus = computeHqBonus('democratic');
    expect(bonus.resources).toEqual({ funding: 2, politicalWill: 1 });
    expect(bonus.fields.computing).toBe(1);
    expect(bonus.fields.socialScience).toBe(1);
  });

  it('authoritarian profile replaces field trickle with materials', () => {
    const bonus = computeHqBonus('authoritarian');
    expect(bonus.resources).toEqual({ funding: 2, politicalWill: 1, materials: 2 });
    expect(bonus.fields).toEqual({});
  });

  it('adds techFieldBonus on top of base fields', () => {
    const bonus = computeHqBonus('democratic', { computing: 2, physics: 3 });
    expect(bonus.fields.computing).toBe(3); // 1 base + 2 tech
    expect(bonus.fields.physics).toBe(3);
    expect(bonus.fields.socialScience).toBe(1);
  });

  it('tech field bonus applies even for authoritarian profiles', () => {
    const bonus = computeHqBonus('authoritarian', { physics: 5 });
    expect(bonus.fields.physics).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getTileSummary
// ---------------------------------------------------------------------------

describe('getTileSummary', () => {
  it('returns empty summary for an unoccupied tile', () => {
    const tile = makeTile(0, 0);
    const summary = getTileSummary(tile, [], defs, []);
    expect(summary.facilityNames).toEqual([]);
    expect(summary.fieldOutput).toEqual({});
    expect(summary.resourceOutput).toEqual({});
    expect(summary.canDelete).toBe(false);
    expect(summary.destroyedStatus).toBeNull();
  });

  it('summarises a single facility including upkeep as negative resource', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile = makeTile(0, 0, 'u1');
    const summary = getTileSummary(tile, [facility], defs, []);
    expect(summary.facilityNames).toEqual(['University Campus']);
    expect(summary.fieldOutput.mathematics).toBe(10);
    expect(summary.fieldOutput.physics).toBe(5);
    expect(summary.resourceOutput.funding).toBe(-5);
    expect(summary.canDelete).toBe(true);
  });

  it('includes adjacency effects when provided', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile = makeTile(0, 0, 'u1');
    const adj = [
      {
        facilityInstanceId: 'u1',
        fieldBonus: { ...ZERO_FIELDS, physics: 7 },
        resourceBonus: { ...ZERO_RESOURCES },
      },
    ];
    const summary = getTileSummary(tile, [facility], defs, adj);
    expect(summary.fieldOutput.physics).toBe(5 + 7);
  });

  it('propagates destroyed status and productivity', () => {
    const facility = makeFacility('u1', 'university', '0,0');
    const tile: MapTile = {
      ...makeTile(0, 0, 'u1'),
      productivity: 0.4,
      destroyedStatus: 'irradiated',
    };
    const summary = getTileSummary(tile, [facility], defs, []);
    expect(summary.productivity).toBe(0.4);
    expect(summary.destroyedStatus).toBe('irradiated');
  });
});

// ---------------------------------------------------------------------------
// tickMineDepletion — space mines
// ---------------------------------------------------------------------------

describe('tickMineDepletion — space mines', () => {
  const spaceMineDef: FacilityDef = {
    ...defs.get('mine')!,
    id: 'spaceMine',
    name: 'Asteroid Mine',
  };
  const spaceDefs = new Map([...defs, ['spaceMine', spaceMineDef]]);

  function makeNode(id: string, facilityId: string | null = null): SpaceNode {
    return {
      id,
      type: 'cislunarPoint',
      label: id,
      launchCost: 1,
      facilityId,
    };
  }

  it('depletes space mine condition by MINE_DEPLETION_RATE per turn', () => {
    const facility = makeFacility('sm1', 'spaceMine', 'nodeA');
    const node = makeNode('nodeA', 'spaceMine');
    const { facilities } = tickMineDepletion([facility], spaceDefs, [], [node]);
    expect(facilities[0].condition).toBeCloseTo(1 - MINE_DEPLETION_RATE);
  });

  it('does not deplete unsupplied space mines', () => {
    const facility = makeFacility('sm1', 'spaceMine', 'nodeA');
    const node = makeNode('nodeA', 'spaceMine');
    const { facilities } = tickMineDepletion(
      [facility],
      spaceDefs,
      [],
      [node],
      { nodeA: false },
    );
    expect(facilities[0].condition).toBe(1);
  });

  it('removes an exhausted space mine and clears the node facilityId', () => {
    const facility: FacilityInstance = {
      ...makeFacility('sm1', 'spaceMine', 'nodeA'),
      condition: 0.005,
    };
    const node = makeNode('nodeA', 'spaceMine');
    const { facilities, updatedSpaceNodes, exhaustionMessages } = tickMineDepletion(
      [facility],
      spaceDefs,
      [],
      [node],
    );
    expect(facilities).toHaveLength(0);
    expect(updatedSpaceNodes[0].facilityId).toBeNull();
    expect(exhaustionMessages).toHaveLength(1);
    expect(exhaustionMessages[0]).toContain('Asteroid Mine');
    expect(exhaustionMessages[0]).toContain('nodeA');
  });

  it('returns the original tiles array reference when no Earth mine depletes', () => {
    const facility = makeFacility('sm1', 'spaceMine', 'nodeA');
    const node = makeNode('nodeA', 'spaceMine');
    const tiles = [makeTile(0, 0)];
    const result = tickMineDepletion([facility], spaceDefs, tiles, [node]);
    expect(result.tiles).toBe(tiles);
  });

  it('returns the original spaceNodes array reference when nothing exhausts', () => {
    const facility = makeFacility('sm1', 'spaceMine', 'nodeA');
    const node = makeNode('nodeA', 'spaceMine');
    const nodes = [node];
    const result = tickMineDepletion([facility], spaceDefs, [], nodes);
    expect(result.updatedSpaceNodes).toBe(nodes);
  });
});

// ---------------------------------------------------------------------------
// getChainRoot
// ---------------------------------------------------------------------------

describe('getChainRoot', () => {
  const defA: FacilityDef = { ...defs.get('mine')!, id: 'tier1' };
  const defB: FacilityDef = { ...defs.get('mine')!, id: 'tier2', upgradesFrom: 'tier1' };
  const defC: FacilityDef = { ...defs.get('mine')!, id: 'tier3', upgradesFrom: 'tier2' };
  const chainDefs = new Map([
    ['tier1', defA],
    ['tier2', defB],
    ['tier3', defC],
  ]);

  it('returns the def ID itself when it has no parent', () => {
    expect(getChainRoot('tier1', chainDefs)).toBe('tier1');
  });

  it('walks upgradesFrom up to the root', () => {
    expect(getChainRoot('tier3', chainDefs)).toBe('tier1');
  });

  it('returns the given ID when it is unknown', () => {
    expect(getChainRoot('unknown', chainDefs)).toBe('unknown');
  });

  it('returns safely on a cyclic chain', () => {
    const cycleA: FacilityDef = { ...defs.get('mine')!, id: 'a', upgradesFrom: 'b' };
    const cycleB: FacilityDef = { ...defs.get('mine')!, id: 'b', upgradesFrom: 'a' };
    const cycleDefs = new Map([
      ['a', cycleA],
      ['b', cycleB],
    ]);
    // Does not loop forever; returns some node in the cycle.
    const root = getChainRoot('a', cycleDefs);
    expect(['a', 'b']).toContain(root);
  });
});

// ---------------------------------------------------------------------------
// canUpgradeFacility
// ---------------------------------------------------------------------------

describe('canUpgradeFacility', () => {
  const t1: FacilityDef = { ...defs.get('mine')!, id: 'moduleT1' };
  const t2: FacilityDef = {
    ...defs.get('mine')!,
    id: 'moduleT2',
    upgradesFrom: 'moduleT1',
    requiredTechId: 'advancedLife',
  };
  const upgradeDefs = new Map([
    ['moduleT1', t1],
    ['moduleT2', t2],
  ]);

  const node: SpaceNode = {
    id: 'leo',
    type: 'lowEarthOrbit',
    label: 'LEO',
    launchCost: 1,
    facilityId: 'moduleT1',
  };

  const emptyRecipe = { ...ZERO_FIELDS };
  const discovered: TechState[] = [
    {
      defId: 'advancedLife',
      stage: 'discovered',
      recipe: emptyRecipe,
      fieldProgress: emptyRecipe,
      unlockedByBreakthrough: false,
      discoveredTurn: 1,
    },
  ];
  const inProgress: TechState[] = [
    {
      defId: 'advancedLife',
      stage: 'progress',
      recipe: emptyRecipe,
      fieldProgress: emptyRecipe,
      unlockedByBreakthrough: false,
      discoveredTurn: null,
    },
  ];

  it('returns null when the node is unknown', () => {
    expect(canUpgradeFacility('missing', [], [], upgradeDefs, discovered)).toBeNull();
  });

  it('returns null when the node has no facility', () => {
    const empty: SpaceNode = { ...node, facilityId: null };
    expect(canUpgradeFacility('leo', [empty], [], upgradeDefs, discovered)).toBeNull();
  });

  it('returns null when the required tech is undiscovered', () => {
    expect(canUpgradeFacility('leo', [node], [], upgradeDefs, inProgress)).toBeNull();
  });

  it('returns the upgrade def when tech is discovered', () => {
    const next = canUpgradeFacility('leo', [node], [], upgradeDefs, discovered);
    expect(next?.id).toBe('moduleT2');
  });

  it('returns the upgrade def when it has no requiredTechId', () => {
    const freeT2: FacilityDef = { ...t2, requiredTechId: null };
    const localDefs = new Map([...upgradeDefs, ['moduleT2', freeT2]]);
    const next = canUpgradeFacility('leo', [node], [], localDefs, []);
    expect(next?.id).toBe('moduleT2');
  });
});

// ---------------------------------------------------------------------------
// isLunarChainTaken
// ---------------------------------------------------------------------------

describe('isLunarChainTaken', () => {
  const t1: FacilityDef = { ...defs.get('mine')!, id: 'lunarLaunchFacility' };
  const t2: FacilityDef = {
    ...defs.get('mine')!,
    id: 'lunarSpaceport',
    upgradesFrom: 'lunarLaunchFacility',
  };
  const otherRoot: FacilityDef = { ...defs.get('mine')!, id: 'lunarMine' };
  const lunarDefs = new Map([
    ['lunarLaunchFacility', t1],
    ['lunarSpaceport', t2],
    ['lunarMine', otherRoot],
  ]);

  function lunarNode(id: string, facilityId: string | null): SpaceNode {
    return { id, type: 'lunarSurface', label: id, launchCost: 1, facilityId };
  }

  it('returns false when no other lunar node hosts the same chain', () => {
    const nodes = [lunarNode('a', null), lunarNode('b', 'lunarMine')];
    expect(isLunarChainTaken('lunarLaunchFacility', 'a', nodes, lunarDefs)).toBe(false);
  });

  it('returns true when another lunar node holds the same chain root', () => {
    const nodes = [lunarNode('a', null), lunarNode('b', 'lunarSpaceport')];
    expect(isLunarChainTaken('lunarLaunchFacility', 'a', nodes, lunarDefs)).toBe(true);
  });

  it('ignores the excluded node itself', () => {
    const nodes = [lunarNode('a', 'lunarSpaceport')];
    expect(isLunarChainTaken('lunarLaunchFacility', 'a', nodes, lunarDefs)).toBe(false);
  });

  it('detects a queued chain on another lunar node', () => {
    const nodes = [lunarNode('a', null), lunarNode('b', null)];
    const queue: OngoingAction[] = [
      {
        id: 'q1',
        type: 'construct',
        facilityDefId: 'lunarSpaceport',
        coordKey: '',
        turnsRemaining: 1,
        totalTurns: 1,
        slotIndex: 0,
        spaceNodeId: 'b',
      },
    ];
    expect(isLunarChainTaken('lunarLaunchFacility', 'a', nodes, lunarDefs, queue)).toBe(true);
  });

  it('ignores queued actions for non-lunar nodes', () => {
    const nodes = [lunarNode('a', null), { ...lunarNode('b', null), type: 'cislunarPoint' as const }];
    const queue: OngoingAction[] = [
      {
        id: 'q1',
        type: 'construct',
        facilityDefId: 'lunarSpaceport',
        coordKey: '',
        turnsRemaining: 1,
        totalTurns: 1,
        slotIndex: 0,
        spaceNodeId: 'b',
      },
    ];
    expect(isLunarChainTaken('lunarLaunchFacility', 'a', nodes, lunarDefs, queue)).toBe(false);
  });
});
