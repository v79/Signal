import { describe, it, expect } from 'vitest';
import {
  checkWormholeVictory,
  checkEcologicalRestorationVictory,
  checkEconomicHegemonyVictory,
  checkTerraformingVictory,
  checkClimateCollapseLoss,
  checkSignalMisinterpretationLoss,
  checkPoliticalCollapseLoss,
  checkResourceExhaustionLoss,
  computeMoralOutcome,
  tickEarthWelfare,
  checkVictoryConditions,
} from './victory';
import type { GameState } from './types';
import { createGameState } from './state';

// ---------------------------------------------------------------------------
// Minimal GameState fixture
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createGameState({
    seed: 'test',
    playerBlocDefId: 'eu',
    pushFactor: 'climateChange',
    startYear: 2025,
    willProfile: 'democratic',
    startingWill: 60,
    startingResources: { funding: 100, materials: 100, politicalWill: 50 },
  });
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Wormhole Victory
// ---------------------------------------------------------------------------

describe('checkWormholeVictory', () => {
  it('false when wormhole not activated', () => {
    expect(checkWormholeVictory(makeState())).toBe(false);
  });

  it('true when wormhole activated', () => {
    const s = makeState({ signal: { ...makeState().signal, wormholeActivated: true } });
    expect(checkWormholeVictory(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ecological Restoration Victory
// ---------------------------------------------------------------------------

describe('checkEcologicalRestorationVictory', () => {
  it('false below welfare threshold', () => {
    const s = makeState({ earthWelfareScore: 87, climatePressure: 20 });
    expect(checkEcologicalRestorationVictory(s)).toBe(false);
  });

  it('false above climate threshold', () => {
    const s = makeState({ earthWelfareScore: 90, climatePressure: 26 });
    expect(checkEcologicalRestorationVictory(s)).toBe(false);
  });

  it('true at exact thresholds', () => {
    const s = makeState({ earthWelfareScore: 88, climatePressure: 25 });
    expect(checkEcologicalRestorationVictory(s)).toBe(true);
  });

  it('true above thresholds', () => {
    const s = makeState({ earthWelfareScore: 95, climatePressure: 10 });
    expect(checkEcologicalRestorationVictory(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Economic Hegemony Victory
// ---------------------------------------------------------------------------

describe('checkEconomicHegemonyVictory', () => {
  it('false when short on funding', () => {
    const s = makeState();
    s.player.resources.funding = 499;
    s.player.resources.materials = 300;
    expect(checkEconomicHegemonyVictory(s)).toBe(false);
  });

  it('false when short on materials', () => {
    const s = makeState();
    s.player.resources.funding = 500;
    s.player.resources.materials = 299;
    expect(checkEconomicHegemonyVictory(s)).toBe(false);
  });

  it('true at exact thresholds', () => {
    const s = makeState();
    s.player.resources.funding = 500;
    s.player.resources.materials = 300;
    expect(checkEconomicHegemonyVictory(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Terraforming Victory
// ---------------------------------------------------------------------------

describe('checkTerraformingVictory', () => {
  it('false when era is earth', () => {
    const s = makeState({ era: 'earth' });
    expect(checkTerraformingVictory(s)).toBe(false);
  });

  it('false when era is nearSpace but no lunar surface facility', () => {
    const s = makeState({
      era: 'nearSpace',
      map: {
        ...makeState().map,
        spaceNodes: [
          {
            id: 'lunarSurface',
            type: 'lunarSurface',
            label: 'Lunar Surface',
            launchCost: 45,
            facilityId: null,
          },
        ],
      },
    });
    expect(checkTerraformingVictory(s)).toBe(false);
  });

  it('true in nearSpace era with lunarSurface facility', () => {
    const s = makeState({
      era: 'nearSpace',
      map: {
        ...makeState().map,
        spaceNodes: [
          {
            id: 'lunarSurface',
            type: 'lunarSurface',
            label: 'Lunar Surface',
            launchCost: 45,
            facilityId: 'outpost-1',
          },
        ],
      },
    });
    expect(checkTerraformingVictory(s)).toBe(true);
  });

  it('true in deepSpace era with lunarSurface facility', () => {
    const s = makeState({
      era: 'deepSpace',
      map: {
        ...makeState().map,
        spaceNodes: [
          {
            id: 'lunarSurface',
            type: 'lunarSurface',
            label: 'Lunar Surface',
            launchCost: 45,
            facilityId: 'outpost-1',
          },
        ],
      },
    });
    expect(checkTerraformingVictory(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Climate Collapse Loss
// ---------------------------------------------------------------------------

describe('checkClimateCollapseLoss', () => {
  it('false below 100', () => {
    expect(checkClimateCollapseLoss(makeState({ climatePressure: 99 }))).toBe(false);
  });

  it('true at 100', () => {
    expect(checkClimateCollapseLoss(makeState({ climatePressure: 100 }))).toBe(true);
  });

  it('true above 100', () => {
    expect(checkClimateCollapseLoss(makeState({ climatePressure: 105 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Signal Misinterpretation Loss
// ---------------------------------------------------------------------------

describe('checkSignalMisinterpretationLoss', () => {
  it('false when no response committed', () => {
    expect(checkSignalMisinterpretationLoss(makeState())).toBe(false);
  });

  it('false when committed and correct', () => {
    const s = makeState({
      signal: { ...makeState().signal, responseCommitted: true, responseCorrect: true },
    });
    expect(checkSignalMisinterpretationLoss(s)).toBe(false);
  });

  it('true when committed and incorrect', () => {
    const s = makeState({
      signal: { ...makeState().signal, responseCommitted: true, responseCorrect: false },
    });
    expect(checkSignalMisinterpretationLoss(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Political Collapse Loss
// ---------------------------------------------------------------------------

describe('checkPoliticalCollapseLoss', () => {
  it('false when will is high', () => {
    const s = makeState();
    s.player.will = 60;
    s.player.resources.politicalWill = 50;
    expect(checkPoliticalCollapseLoss(s)).toBe(false);
  });

  it('false when will is low but political will is positive', () => {
    const s = makeState();
    s.player.will = 3;
    s.player.resources.politicalWill = 10;
    expect(checkPoliticalCollapseLoss(s)).toBe(false);
  });

  it('true when both will and political will are at/below threshold', () => {
    const s = makeState();
    s.player.will = 0;
    s.player.resources.politicalWill = 0;
    expect(checkPoliticalCollapseLoss(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resource Exhaustion Loss
// ---------------------------------------------------------------------------

describe('checkResourceExhaustionLoss', () => {
  it('false when only one resource is zero', () => {
    const s = makeState();
    s.player.resources.funding = 0;
    s.player.resources.materials = 10;
    s.player.resources.politicalWill = 5;
    expect(checkResourceExhaustionLoss(s)).toBe(false);
  });

  it('true when all resources are zero', () => {
    const s = makeState();
    s.player.resources.funding = 0;
    s.player.resources.materials = 0;
    s.player.resources.politicalWill = 0;
    expect(checkResourceExhaustionLoss(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Moral outcome
// ---------------------------------------------------------------------------

describe('computeMoralOutcome', () => {
  it('null when welfare is above threshold', () => {
    expect(computeMoralOutcome(makeState({ earthWelfareScore: 40 }))).toBeNull();
  });

  it('abandonedEarth when welfare is below threshold', () => {
    expect(computeMoralOutcome(makeState({ earthWelfareScore: 39 }))).toBe('abandonedEarth');
  });
});

// ---------------------------------------------------------------------------
// Earth welfare tick
// ---------------------------------------------------------------------------

describe('tickEarthWelfare', () => {
  it('decreases under high climate pressure with no facilities', () => {
    const s = makeState({ climatePressure: 80, earthWelfareScore: 70 });
    const next = tickEarthWelfare(s);
    expect(next).toBeLessThan(70);
  });

  it('stays high under zero climate pressure', () => {
    const s = makeState({ climatePressure: 0, earthWelfareScore: 80 });
    const next = tickEarthWelfare(s);
    expect(next).toBeGreaterThanOrEqual(80);
  });

  it('is clamped to [0, 100]', () => {
    const lo = makeState({ climatePressure: 100, earthWelfareScore: 0 });
    const hi = makeState({ climatePressure: 0, earthWelfareScore: 100 });
    expect(tickEarthWelfare(lo)).toBe(0);
    expect(tickEarthWelfare(hi)).toBe(100);
  });

  it('Earth facilities slow welfare decline', () => {
    const base = makeState({ climatePressure: 50, earthWelfareScore: 70 });
    const withFacilities = {
      ...base,
      player: {
        ...base.player,
        facilities: [
          { id: 'f1', defId: 'lab', locationKey: '0,0', condition: 1, builtTurn: 1 },
          { id: 'f2', defId: 'lab', locationKey: '1,0', condition: 1, builtTurn: 1 },
        ],
      },
      map: {
        ...base.map,
        earthTiles: [
          {
            coord: { q: 0, r: 0 },
            type: 'urban' as const,
            destroyedStatus: null,
            productivity: 1,
            mineDepletion: 1,
            facilitySlots: ['f1', null, null] as [string | null, string | null, string | null],
            pendingActionId: null,
          },
          {
            coord: { q: 1, r: 0 },
            type: 'urban' as const,
            destroyedStatus: null,
            productivity: 1,
            mineDepletion: 1,
            facilitySlots: ['f2', null, null] as [string | null, string | null, string | null],
            pendingActionId: null,
          },
        ],
      },
    };
    const withoutFacilities = { ...base };
    expect(tickEarthWelfare(withFacilities)).toBeGreaterThan(tickEarthWelfare(withoutFacilities));
  });
});

// ---------------------------------------------------------------------------
// checkVictoryConditions — priority and happy paths
// ---------------------------------------------------------------------------

describe('checkVictoryConditions', () => {
  it('returns null when no conditions triggered', () => {
    expect(checkVictoryConditions(makeState())).toBeNull();
  });

  it('detects climate collapse loss', () => {
    const result = checkVictoryConditions(makeState({ climatePressure: 100 }));
    expect(result?.type).toBe('loss');
    expect(result?.condition).toBe('climateCollapse');
  });

  it('detects wormhole victory', () => {
    const s = makeState({ signal: { ...makeState().signal, wormholeActivated: true } });
    const result = checkVictoryConditions(s);
    expect(result?.type).toBe('victory');
    expect(result?.condition).toBe('wormhole');
  });

  it('loss takes priority over simultaneous victory', () => {
    // Climate collapse + wormhole activated at same turn
    const s = makeState({
      climatePressure: 100,
      signal: { ...makeState().signal, wormholeActivated: true },
    });
    const result = checkVictoryConditions(s);
    expect(result?.type).toBe('loss');
    expect(result?.condition).toBe('climateCollapse');
  });

  it('appends abandonedEarth moral outcome to victory', () => {
    const s = makeState({
      signal: { ...makeState().signal, wormholeActivated: true },
      earthWelfareScore: 20,
    });
    const result = checkVictoryConditions(s);
    expect(result?.type).toBe('victory');
    expect(result?.moralOutcome).toBe('abandonedEarth');
  });

  it('no moral outcome on loss', () => {
    const s = makeState({ climatePressure: 100, earthWelfareScore: 10 });
    const result = checkVictoryConditions(s);
    expect(result?.type).toBe('loss');
    expect(result?.moralOutcome).toBeNull();
  });

  it('records the correct turn number', () => {
    const s = makeState({ climatePressure: 100, turn: 42 });
    expect(checkVictoryConditions(s)?.turn).toBe(42);
  });
});
