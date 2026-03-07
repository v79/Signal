import { describe, it, expect } from 'vitest';
import {
  getEligibleEvents,
  selectNewEvents,
  tickEventCountdowns,
  getJustExpiredEvents,
  resolveEvent,
  applyEventEffect,
  getEffectForResolution,
} from './events';
import { createRng } from './rng';
import type { EventDef, EventInstance, PlayerState } from './types';
import { ZERO_FIELDS, ZERO_RESOURCES } from './state';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePlayer: PlayerState = {
  blocDefId: 'eu',
  resources: { funding: 100, materials: 50, politicalWill: 60 },
  fields: { ...ZERO_FIELDS },
  will: 60,
  willProfile: 'democratic',
  facilities: [],
  completedProjectIds: [],
  activeProjects: [],
  techs: [],
  cards: [],
  board: {},
  newsFeed: [],
  activeEventRestrictions: [],
};

const fundingCrisisDef: EventDef = {
  id: 'fundingCrisis',
  name: 'Funding Crisis',
  description: 'Budget shortfall threatens operations.',
  flavourText: 'The finance committee is alarmed.',
  tags: ['crisis', 'funding'],
  eras: ['earth'],
  pushFactors: null,
  blocIds: null,
  countdownTurns: 3,
  responseTier: 'partialMitigation',
  negativeEffect: { resources: { funding: -30 } },
  positiveEffect: null,
  mitigationCost: { funding: 15 },
  mitigationFactor: 0.5,
};

const diplomaticOpportunityDef: EventDef = {
  id: 'diplomaticOpportunity',
  name: 'Materials Exchange',
  description: 'A rival bloc offers a materials deal.',
  flavourText: 'An offer has arrived.',
  tags: ['diplomatic'],
  eras: ['earth', 'nearSpace'],
  pushFactors: null,
  blocIds: null,
  countdownTurns: 2,
  responseTier: 'noCounter',
  negativeEffect: { resources: { politicalWill: -5 } },
  positiveEffect: { resources: { materials: 20 } },
};

const sabotageEventDef: EventDef = {
  id: 'sabotage',
  name: 'Sabotage Attempt',
  description: 'Industrial sabotage threatens a facility.',
  flavourText: 'Security reports an incident.',
  tags: ['crisis', 'sabotage'],
  eras: ['earth'],
  pushFactors: ['geopoliticalTension'],
  blocIds: null,
  countdownTurns: 2,
  responseTier: 'fullCounter',
  negativeEffect: { resources: { materials: -20 }, fields: { engineering: -5 } },
  positiveEffect: null,
};

const euOnlyEventDef: EventDef = {
  id: 'euFragmentation',
  name: 'Internal Fragmentation',
  description: 'EU-specific political event.',
  flavourText: 'Tensions rise within the union.',
  tags: ['political'],
  eras: ['earth'],
  pushFactors: null,
  blocIds: ['eu'],
  countdownTurns: 3,
  responseTier: 'partialMitigation',
  negativeEffect: { resources: { politicalWill: -15 } },
  positiveEffect: null,
  mitigationCost: { funding: 10 },
  mitigationFactor: 0.5,
};

const restrictionEventDef: EventDef = {
  id: 'governmentAudit',
  name: 'Government Audit',
  description: 'Build actions suspended.',
  flavourText: 'Inspectors arrive.',
  tags: ['political'],
  eras: ['earth'],
  pushFactors: null,
  blocIds: null,
  countdownTurns: 2,
  responseTier: 'noCounter',
  negativeEffect: { restrictActions: ['build'], restrictionDuration: 2 },
  positiveEffect: null,
};

const pool = [fundingCrisisDef, diplomaticOpportunityDef, sabotageEventDef, euOnlyEventDef];

function makeEventInstance(defId: string, arrivedTurn = 1, countdown = 3): EventInstance {
  return {
    id: `${defId}-t${arrivedTurn}`,
    defId,
    arrivedTurn,
    countdownRemaining: countdown,
    resolved: false,
    resolvedWith: null,
  };
}

// ---------------------------------------------------------------------------
// getEligibleEvents
// ---------------------------------------------------------------------------

describe('getEligibleEvents', () => {
  it('returns events matching era, push factor, and bloc', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'eu', new Set());
    // fundingCrisis, diplomaticOpportunity, euFragmentation — not sabotage (geopoliticalTension only)
    expect(eligible.map(e => e.id)).toContain('fundingCrisis');
    expect(eligible.map(e => e.id)).toContain('diplomaticOpportunity');
    expect(eligible.map(e => e.id)).toContain('euFragmentation');
    expect(eligible.map(e => e.id)).not.toContain('sabotage');
  });

  it('includes push-factor-specific events when push factor matches', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'geopoliticalTension', 'eu', new Set());
    expect(eligible.map(e => e.id)).toContain('sabotage');
  });

  it('excludes bloc-specific events for non-matching blocs', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'northAmerica', new Set());
    expect(eligible.map(e => e.id)).not.toContain('euFragmentation');
  });

  it('excludes already-active events', () => {
    const active = new Set(['fundingCrisis']);
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'eu', active);
    expect(eligible.map(e => e.id)).not.toContain('fundingCrisis');
  });

  it('excludes events not valid for the current era', () => {
    // sabotage is earth-only; test in nearSpace
    const eligible = getEligibleEvents(pool, 'nearSpace', 'geopoliticalTension', 'eu', new Set());
    expect(eligible.map(e => e.id)).not.toContain('sabotage');
    expect(eligible.map(e => e.id)).toContain('diplomaticOpportunity'); // era: earth + nearSpace
  });
});

// ---------------------------------------------------------------------------
// selectNewEvents
// ---------------------------------------------------------------------------

describe('selectNewEvents', () => {
  it('returns deterministic results for the same seed', () => {
    const r1 = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ev1'), 5);
    const r2 = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ev1'), 5);
    expect(r1.map(e => e.defId)).toEqual(r2.map(e => e.defId));
  });

  it('returns events with correct arrivedTurn and countdown', () => {
    const events = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ev2'), 7);
    for (const event of events) {
      expect(event.arrivedTurn).toBe(7);
      expect(event.resolved).toBe(false);
      expect(event.resolvedWith).toBeNull();
    }
  });

  it('returns empty when no eligible events exist', () => {
    const events = selectNewEvents([], 'earth', 'climateChange', 'eu', [], createRng('empty'), 1);
    expect(events).toHaveLength(0);
  });

  it('generates unique event IDs', () => {
    const events = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ids'), 3);
    const ids = events.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// tickEventCountdowns
// ---------------------------------------------------------------------------

describe('tickEventCountdowns', () => {
  it('decrements countdown for unresolved events', () => {
    const events = [makeEventInstance('fundingCrisis', 1, 3)];
    const result = tickEventCountdowns(events);
    expect(result[0].countdownRemaining).toBe(2);
    expect(result[0].resolved).toBe(false);
  });

  it('marks events as expired when countdown reaches 0', () => {
    const events = [makeEventInstance('fundingCrisis', 1, 1)];
    const result = tickEventCountdowns(events);
    expect(result[0].countdownRemaining).toBe(0);
    expect(result[0].resolved).toBe(true);
    expect(result[0].resolvedWith).toBe('expired');
  });

  it('does not change already-resolved events', () => {
    const event: EventInstance = {
      ...makeEventInstance('fundingCrisis', 1, 0),
      resolved: true,
      resolvedWith: 'counter',
    };
    const result = tickEventCountdowns([event]);
    expect(result[0].resolvedWith).toBe('counter');
  });
});

describe('getJustExpiredEvents', () => {
  it('returns events that expired this tick', () => {
    const expired = { ...makeEventInstance('fundingCrisis', 1, 0), resolved: true, resolvedWith: 'expired' as const };
    const active = makeEventInstance('sabotage', 1, 2);
    const result = getJustExpiredEvents([expired, active]);
    expect(result).toHaveLength(1);
    expect(result[0].defId).toBe('fundingCrisis');
  });
});

// ---------------------------------------------------------------------------
// resolveEvent
// ---------------------------------------------------------------------------

describe('resolveEvent', () => {
  it('marks the event as resolved with the given resolution', () => {
    const events = [makeEventInstance('fundingCrisis', 1, 2)];
    const result = resolveEvent(events, 'fundingCrisis-t1', 'counter');
    expect(result[0].resolved).toBe(true);
    expect(result[0].resolvedWith).toBe('counter');
  });

  it('does not affect other events', () => {
    const events = [
      makeEventInstance('fundingCrisis', 1, 2),
      makeEventInstance('sabotage', 1, 2),
    ];
    const result = resolveEvent(events, 'fundingCrisis-t1', 'mitigation');
    expect(result[1].resolved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEffectForResolution
// ---------------------------------------------------------------------------

describe('getEffectForResolution', () => {
  it('returns null for counter resolution (full neutralise)', () => {
    expect(getEffectForResolution(fundingCrisisDef, 'counter')).toBeNull();
  });

  it('returns positive effect for accepted resolution', () => {
    const effect = getEffectForResolution(diplomaticOpportunityDef, 'accepted');
    expect(effect?.resources?.materials).toBe(20);
  });

  it('returns full negative effect for expired resolution', () => {
    const effect = getEffectForResolution(fundingCrisisDef, 'expired');
    expect(effect?.resources?.funding).toBe(-30);
  });

  it('returns scaled negative effect for mitigation', () => {
    // fundingCrisis: -30 funding, 50% mitigation → -15
    const effect = getEffectForResolution(fundingCrisisDef, 'mitigation');
    expect(effect?.resources?.funding).toBe(-15);
  });
});

// ---------------------------------------------------------------------------
// applyEventEffect
// ---------------------------------------------------------------------------

describe('applyEventEffect', () => {
  it('applies resource delta to player', () => {
    const effect = { resources: { funding: -20, materials: 10 } };
    const { player } = applyEventEffect(effect, basePlayer, [], 5);
    expect(player.resources.funding).toBe(80);
    expect(player.resources.materials).toBe(60);
  });

  it('clamps resources at 0', () => {
    const effect = { resources: { funding: -999 } };
    const { player } = applyEventEffect(effect, basePlayer, [], 5);
    expect(player.resources.funding).toBe(0);
  });

  it('applies field delta to player', () => {
    const effect = { fields: { physics: 10 } };
    const { player } = applyEventEffect(effect, basePlayer, [], 5);
    expect(player.fields.physics).toBe(10);
  });

  it('adds standing action restrictions', () => {
    const { player } = applyEventEffect(
      { restrictActions: ['build', 'recruit'], restrictionDuration: 2 },
      basePlayer,
      [],
      5,
    );
    expect(player.activeEventRestrictions).toHaveLength(2);
    expect(player.activeEventRestrictions[0].actionId).toBe('build');
    expect(player.activeEventRestrictions[0].expiresAfterTurn).toBe(6); // turn 5 + duration 2 - 1
  });

  it('handles effects with no resource or field changes', () => {
    const effect = {};
    const { player } = applyEventEffect(effect, basePlayer, [], 5);
    expect(player.resources).toEqual(basePlayer.resources);
  });
});
