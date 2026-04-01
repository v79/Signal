import { describe, it, expect } from 'vitest';
import { recomputeLaunchCapacity } from './state';
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
  it('returns 0 with no facilities or techs', () => {
    const result = recomputeLaunchCapacity([], [], new Map(), new Map());
    expect(result).toBe(0);
  });

  it('returns 3 per spaceLaunchCentre facility', () => {
    const facilities = [makeFacility('spaceLaunchCentre', '0,0')];
    const result = recomputeLaunchCapacity(facilities, [], new Map(), new Map());
    expect(result).toBe(3);
  });

  it('stacks multiple spaceLaunchCentres', () => {
    const facilities = [
      makeFacility('spaceLaunchCentre', '0,0'),
      makeFacility('spaceLaunchCentre', '1,0'),
    ];
    const result = recomputeLaunchCapacity(facilities, [], new Map(), new Map());
    expect(result).toBe(6);
  });

  it('adds +2 for reusableLaunchSystems tech', () => {
    const techs = [makeTech('reusableLaunchSystems')];
    const result = recomputeLaunchCapacity([], techs, new Map(), new Map());
    expect(result).toBe(2);
  });

  it('adds +1 for nuclearThermalPropulsion tech', () => {
    const techs = [makeTech('nuclearThermalPropulsion')];
    const result = recomputeLaunchCapacity([], techs, new Map(), new Map());
    expect(result).toBe(1);
  });

  it('adds +3 for cislunarTransportNetwork tech', () => {
    const techs = [makeTech('cislunarTransportNetwork')];
    const result = recomputeLaunchCapacity([], techs, new Map(), new Map());
    expect(result).toBe(3);
  });

  it('ignores non-discovered techs', () => {
    const techs = [
      makeTech('reusableLaunchSystems', 'progress'),
      makeTech('cislunarTransportNetwork', 'rumour'),
    ];
    const result = recomputeLaunchCapacity([], techs, new Map(), new Map());
    expect(result).toBe(0);
  });

  it('stacks facility and tech bonuses', () => {
    const facilities = [makeFacility('spaceLaunchCentre', '0,0')];
    const techs = [
      makeTech('reusableLaunchSystems'),
      makeTech('cislunarTransportNetwork'),
    ];
    // 3 + 2 + 3 = 8
    const result = recomputeLaunchCapacity(facilities, techs, new Map(), new Map());
    expect(result).toBe(8);
  });

  it('does not count non-spaceLaunchCentre facilities', () => {
    const facilities = [makeFacility('orbitalModule', 'leo')];
    const result = recomputeLaunchCapacity(facilities, [], new Map(), new Map());
    expect(result).toBe(0);
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
