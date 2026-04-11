import { describe, it, expect } from 'vitest';
import { recomputeLaunchCapacity, computeSpaceSupplyCostReduction } from './state';
import { canUpgradeFacility } from './facilities';
import type { FacilityInstance, TechState, FacilityDef, SpaceNode } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFacility(defId: string, locationKey = 'leo'): FacilityInstance {
  return { id: `${defId}-1`, defId, locationKey, condition: 1.0, builtTurn: 1 };
}

function makeTech(defId: string, stage: TechState['stage'] = 'discovered'): TechState {
  return {
    defId,
    stage,
    recipe: null,
    fieldProgress: {},
    unlockedByBreakthrough: false,
    discoveredTurn: null,
  };
}

function makeFacilityDef(id: string, overrides: Partial<FacilityDef> = {}): FacilityDef {
  return {
    id,
    name: id,
    description: '',
    era: 'nearSpace',
    allowedTileTypes: [],
    buildCost: { funding: 10, materials: 10, politicalWill: 0 },
    upkeepCost: {},
    resourceOutput: {},
    fieldOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    buildTime: 1,
    deleteTime: 1,
    canDelete: true,
    depletes: false,
    requiredTechId: null,
    ...overrides,
  };
}

function makeSpaceNode(id: string, facilityId: string | null = null): SpaceNode {
  return { id, label: id, type: 'lowEarthOrbit', launchCost: 1, facilityId };
}

// ---------------------------------------------------------------------------
// recomputeLaunchCapacity
// ---------------------------------------------------------------------------

describe('recomputeLaunchCapacity', () => {
  it('returns 0 with no facilities', () => {
    expect(recomputeLaunchCapacity([], [])).toBe(0);
  });

  it('returns 3 per spaceLaunchCentre facility', () => {
    const facilities = [makeFacility('spaceLaunchCentre', '0,0')];
    expect(recomputeLaunchCapacity(facilities, [])).toBe(3);
  });

  it('stacks multiple spaceLaunchCentres', () => {
    const facilities = [
      makeFacility('spaceLaunchCentre', '0,0'),
      makeFacility('spaceLaunchCentre', '1,0'),
    ];
    expect(recomputeLaunchCapacity(facilities, [])).toBe(6);
  });

  it('does not add capacity for reusableLaunchSystems tech', () => {
    const techs = [makeTech('reusableLaunchSystems')];
    expect(recomputeLaunchCapacity([], techs)).toBe(0);
  });

  it('does not add capacity for cislunarTransportNetwork tech', () => {
    const techs = [makeTech('cislunarTransportNetwork')];
    expect(recomputeLaunchCapacity([], techs)).toBe(0);
  });

  it('does not count non-spaceLaunchCentre facilities', () => {
    const facilities = [makeFacility('orbitalModule', 'leo')];
    expect(recomputeLaunchCapacity(facilities, [])).toBe(0);
  });
});

describe('computeSpaceSupplyCostReduction', () => {
  it('returns 0 with no techs', () => {
    expect(computeSpaceSupplyCostReduction([])).toBe(0);
  });

  it('returns 1 for reusableLaunchSystems discovered', () => {
    const techs = [makeTech('reusableLaunchSystems')];
    expect(computeSpaceSupplyCostReduction(techs)).toBe(1);
  });

  it('returns 1 for cislunarTransportNetwork discovered', () => {
    const techs = [makeTech('cislunarTransportNetwork')];
    expect(computeSpaceSupplyCostReduction(techs)).toBe(1);
  });

  it('returns 2 for both reducing techs discovered', () => {
    const techs = [makeTech('reusableLaunchSystems'), makeTech('cislunarTransportNetwork')];
    expect(computeSpaceSupplyCostReduction(techs)).toBe(2);
  });

  it('ignores non-discovered techs', () => {
    const techs = [
      makeTech('reusableLaunchSystems', 'progress'),
      makeTech('cislunarTransportNetwork', 'rumour'),
    ];
    expect(computeSpaceSupplyCostReduction(techs)).toBe(0);
  });

  it('returns 0 for nuclearThermalPropulsion (no longer reduces cost)', () => {
    const techs = [makeTech('nuclearThermalPropulsion')];
    expect(computeSpaceSupplyCostReduction(techs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// canUpgradeFacility
// ---------------------------------------------------------------------------

describe('canUpgradeFacility', () => {
  const moduleA = makeFacilityDef('moduleA');
  const moduleB = makeFacilityDef('moduleB', { upgradesFrom: 'moduleA' });
  const moduleBLocked = makeFacilityDef('moduleBLocked', {
    upgradesFrom: 'moduleA',
    requiredTechId: 'someTech',
  });

  const facilityDefs = new Map<string, FacilityDef>([
    ['moduleA', moduleA],
    ['moduleB', moduleB],
  ]);

  const facilityDefsWithLock = new Map<string, FacilityDef>([
    ['moduleA', moduleA],
    ['moduleBLocked', moduleBLocked],
  ]);

  it('returns null if node has no facility', () => {
    const nodes = [makeSpaceNode('leo', null)];
    const result = canUpgradeFacility('leo', nodes, [], facilityDefs, []);
    expect(result).toBeNull();
  });

  it('returns null if node does not exist', () => {
    const result = canUpgradeFacility('unknown', [], [], facilityDefs, []);
    expect(result).toBeNull();
  });

  it('returns null if no upgrade defined for current facility', () => {
    const nodes = [makeSpaceNode('leo', 'moduleB')];
    const result = canUpgradeFacility('leo', nodes, [], facilityDefs, []);
    expect(result).toBeNull();
  });

  it('returns the upgrade def when one exists', () => {
    const nodes = [makeSpaceNode('leo', 'moduleA')];
    const result = canUpgradeFacility('leo', nodes, [], facilityDefs, []);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('moduleB');
  });

  it('returns null if required tech not yet discovered', () => {
    const nodes = [makeSpaceNode('leo', 'moduleA')];
    const techs: TechState[] = [makeTech('someTech', 'progress')];
    const result = canUpgradeFacility('leo', nodes, [], facilityDefsWithLock, techs);
    expect(result).toBeNull();
  });

  it('returns upgrade def when required tech is discovered', () => {
    const nodes = [makeSpaceNode('leo', 'moduleA')];
    const techs: TechState[] = [makeTech('someTech', 'discovered')];
    const result = canUpgradeFacility('leo', nodes, [], facilityDefsWithLock, techs);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('moduleBLocked');
  });
});
