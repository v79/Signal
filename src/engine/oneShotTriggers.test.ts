import { describe, it, expect } from 'vitest';
import {
  collectFacilityFirstBuildEvents,
  collectTechTriggeredEvents,
} from './turn';
import { createGameState, deserialiseGameState, serialiseGameState } from './state';
import type { FacilityDef, TechDef } from './types';

const BASE_CONFIG = {
  seed: 'test',
  playerBlocDefId: 'northAmericanAlliance',
  pushFactor: 'climateChange' as const,
  startYear: 1970,
  willProfile: 'democratic' as const,
  startingWill: 50,
  startingResources: { funding: 100, materials: 80, politicalWill: 50 },
};

// ---------------------------------------------------------------------------
// collectTechTriggeredEvents
// ---------------------------------------------------------------------------

describe('collectTechTriggeredEvents', () => {
  const TECH_WITH_TRIGGER: TechDef = {
    id: 'orbitalMechanics',
    name: 'Orbital Mechanics',
    rumourText: '',
    baseRecipe: {},
    recipeVariance: 0,
    requiresSimultaneous: false,
    unlocksCards: [],
    unlocksProjects: [],
    unlocksFacilities: [],
    signalDerived: false,
    tier: 2,
    requiredTechIds: [],
    triggersEventOnDiscovery: 'spaceLaunchCentreProposal',
  };
  const TECH_WITHOUT_TRIGGER: TechDef = {
    ...TECH_WITH_TRIGGER,
    id: 'plainTech',
    triggersEventOnDiscovery: undefined,
  };
  const techDefs = new Map<string, TechDef>([
    [TECH_WITH_TRIGGER.id, TECH_WITH_TRIGGER],
    [TECH_WITHOUT_TRIGGER.id, TECH_WITHOUT_TRIGGER],
  ]);

  it('queues an event when a tech with triggersEventOnDiscovery is just discovered', () => {
    const result = collectTechTriggeredEvents(['orbitalMechanics'], techDefs, [], 5);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].defId).toBe('spaceLaunchCentreProposal');
    expect(result.events[0].arrivedTurn).toBe(5);
    expect(result.firedIds).toEqual(['spaceLaunchCentreProposal']);
  });

  it('does not queue when the event id is already in firedOneShotEventIds', () => {
    const result = collectTechTriggeredEvents(
      ['orbitalMechanics'],
      techDefs,
      ['spaceLaunchCentreProposal'],
      5,
    );
    expect(result.events).toHaveLength(0);
    expect(result.firedIds).toEqual([]);
  });

  it('skips techs with no triggersEventOnDiscovery', () => {
    const result = collectTechTriggeredEvents(['plainTech'], techDefs, [], 5);
    expect(result.events).toHaveLength(0);
  });

  it('handles multiple discoveries in a single tick', () => {
    const techB: TechDef = { ...TECH_WITH_TRIGGER, id: 'techB', triggersEventOnDiscovery: 'eventB' };
    const defs = new Map([
      [TECH_WITH_TRIGGER.id, TECH_WITH_TRIGGER],
      [techB.id, techB],
    ]);
    const result = collectTechTriggeredEvents(['orbitalMechanics', 'techB'], defs, [], 5);
    expect(result.events.map((e) => e.defId).sort()).toEqual(
      ['eventB', 'spaceLaunchCentreProposal'].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// collectFacilityFirstBuildEvents
// ---------------------------------------------------------------------------

describe('collectFacilityFirstBuildEvents', () => {
  const FACILITY_WITH_TRIGGER: Partial<FacilityDef> & Pick<FacilityDef, 'id' | 'triggersEventOnFirstBuild'> = {
    id: 'spaceLaunchCentre',
    triggersEventOnFirstBuild: 'boardProposalOrbitalStation',
  };
  const FACILITY_WITHOUT_TRIGGER: Partial<FacilityDef> & Pick<FacilityDef, 'id'> = {
    id: 'researchLab',
  };
  const facilityDefs = new Map<string, FacilityDef>([
    [FACILITY_WITH_TRIGGER.id, FACILITY_WITH_TRIGGER as FacilityDef],
    [FACILITY_WITHOUT_TRIGGER.id, FACILITY_WITHOUT_TRIGGER as FacilityDef],
  ]);

  it('fires when a facility def appears for the first time', () => {
    const result = collectFacilityFirstBuildEvents(
      [],
      [{ defId: 'spaceLaunchCentre' }],
      facilityDefs,
      [],
      7,
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].defId).toBe('boardProposalOrbitalStation');
    expect(result.firedIds).toEqual(['boardProposalOrbitalStation']);
  });

  it('does not fire when the facility def was already present', () => {
    const result = collectFacilityFirstBuildEvents(
      [{ defId: 'spaceLaunchCentre' }],
      [{ defId: 'spaceLaunchCentre' }],
      facilityDefs,
      [],
      7,
    );
    expect(result.events).toHaveLength(0);
  });

  it('does not fire when the trigger event id is already in firedOneShotEventIds', () => {
    const result = collectFacilityFirstBuildEvents(
      [],
      [{ defId: 'spaceLaunchCentre' }],
      facilityDefs,
      ['boardProposalOrbitalStation'],
      7,
    );
    expect(result.events).toHaveLength(0);
  });

  it('skips facilities without triggersEventOnFirstBuild', () => {
    const result = collectFacilityFirstBuildEvents(
      [],
      [{ defId: 'researchLab' }],
      facilityDefs,
      [],
      7,
    );
    expect(result.events).toHaveLength(0);
  });

  it('handles multiple new facility defs in one tick without duplicates', () => {
    const factB: FacilityDef = {
      ...(FACILITY_WITH_TRIGGER as FacilityDef),
      id: 'lunarHabitat',
      triggersEventOnFirstBuild: 'boardProposalMoonColony',
    };
    const defs = new Map<string, FacilityDef>([
      [FACILITY_WITH_TRIGGER.id, FACILITY_WITH_TRIGGER as FacilityDef],
      [factB.id, factB],
    ]);
    const result = collectFacilityFirstBuildEvents(
      [],
      [
        { defId: 'spaceLaunchCentre' },
        { defId: 'spaceLaunchCentre' }, // dup of the same defId — should still fire only once
        { defId: 'lunarHabitat' },
      ],
      defs,
      [],
      7,
    );
    expect(result.events).toHaveLength(2);
    expect(result.firedIds.sort()).toEqual(
      ['boardProposalMoonColony', 'boardProposalOrbitalStation'].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// Save migration: legacy boardProposalFired / moonColonyProposalFired booleans
// ---------------------------------------------------------------------------

describe('firedOneShotEventIds — save migration', () => {
  it('initialises to [] on a fresh game', () => {
    expect(createGameState(BASE_CONFIG).firedOneShotEventIds).toEqual([]);
  });

  it('back-fills boardProposalOrbitalStation when legacy boardProposalFired was true', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.firedOneShotEventIds;
    parsed.boardProposalFired = true;
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.firedOneShotEventIds).toContain('boardProposalOrbitalStation');
  });

  it('back-fills boardProposalMoonColony when legacy moonColonyProposalFired was true', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.firedOneShotEventIds;
    parsed.moonColonyProposalFired = true;
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.firedOneShotEventIds).toContain('boardProposalMoonColony');
  });

  it('back-fills both when both legacy flags were true', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.firedOneShotEventIds;
    parsed.boardProposalFired = true;
    parsed.moonColonyProposalFired = true;
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.firedOneShotEventIds.sort()).toEqual(
      ['boardProposalMoonColony', 'boardProposalOrbitalStation'].sort(),
    );
  });

  it('leaves firedOneShotEventIds empty when no legacy flags were set', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.firedOneShotEventIds;
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.firedOneShotEventIds).toEqual([]);
  });

  it('strips the legacy boolean fields after migration so they cannot leak', () => {
    const state = createGameState(BASE_CONFIG);
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.firedOneShotEventIds;
    parsed.boardProposalFired = true;
    const restored = deserialiseGameState(JSON.stringify(parsed)) as unknown as Record<string, unknown>;
    expect('boardProposalFired' in restored).toBe(false);
    expect('moonColonyProposalFired' in restored).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Save migration: PendingFacilityPlacement.projectId → sourceId
// ---------------------------------------------------------------------------

describe('PendingFacilityPlacement.sourceId — save migration', () => {
  it('renames legacy projectId field to sourceId', () => {
    const state = createGameState(BASE_CONFIG);
    state.pendingFacilityPlacements = [];
    const json = serialiseGameState(state);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    parsed.pendingFacilityPlacements = [
      { projectId: 'someProjectId', facilityDefId: 'spaceLaunchCentre', deferCount: 0 },
    ];
    const restored = deserialiseGameState(JSON.stringify(parsed));
    expect(restored.pendingFacilityPlacements).toHaveLength(1);
    expect(restored.pendingFacilityPlacements[0].sourceId).toBe('someProjectId');
    expect(
      (restored.pendingFacilityPlacements[0] as unknown as { projectId?: string }).projectId,
    ).toBeUndefined();
  });
});
