import { describe, it, expect } from 'vitest';
import {
  getEligibleEvents,
  selectNewEvents,
  tickEventCountdowns,
  getJustExpiredEvents,
  resolveEvent,
  applyEventEffect,
  getEffectForResolution,
  formatEffectForNews,
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
  constructionQueue: [],
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
  weight: 1.0,
  responseTier: 'partialMitigation',
  negativeEffect: { resources: { funding: -30 } },
  positiveEffect: null,
  mitigationCost: { funding: 15 },
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
  weight: 1.0,
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
  weight: 1.0,
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
  weight: 1.0,
  responseTier: 'partialMitigation',
  negativeEffect: { resources: { politicalWill: -15 } },
  positiveEffect: null,
  mitigationCost: { funding: 10 },
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
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'eu', new Set(), false);
    // fundingCrisis, diplomaticOpportunity, euFragmentation — not sabotage (geopoliticalTension only)
    expect(eligible.map((e) => e.id)).toContain('fundingCrisis');
    expect(eligible.map((e) => e.id)).toContain('diplomaticOpportunity');
    expect(eligible.map((e) => e.id)).toContain('euFragmentation');
    expect(eligible.map((e) => e.id)).not.toContain('sabotage');
  });

  it('includes push-factor-specific events when push factor matches', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'geopoliticalTension', 'eu', new Set(), false);
    expect(eligible.map((e) => e.id)).toContain('sabotage');
  });

  it('excludes bloc-specific events for non-matching blocs', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'northAmerica', new Set(), false);
    expect(eligible.map((e) => e.id)).not.toContain('euFragmentation');
  });

  it('excludes already-active events', () => {
    const active = new Set(['fundingCrisis']);
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'eu', active, false);
    expect(eligible.map((e) => e.id)).not.toContain('fundingCrisis');
  });

  it('excludes events not valid for the current era', () => {
    // sabotage is earth-only; test in nearSpace
    const eligible = getEligibleEvents(pool, 'nearSpace', 'geopoliticalTension', 'eu', new Set(), false);
    expect(eligible.map((e) => e.id)).not.toContain('sabotage');
    expect(eligible.map((e) => e.id)).toContain('diplomaticOpportunity'); // era: earth + nearSpace
  });

  it('excludes all crisis-tagged events when hasCrisisActive is true', () => {
    // fundingCrisis and sabotage both have crisis tag; diplomaticOpportunity and euFragmentation do not
    const eligible = getEligibleEvents(pool, 'earth', 'geopoliticalTension', 'eu', new Set(), true);
    expect(eligible.map((e) => e.id)).not.toContain('fundingCrisis');
    expect(eligible.map((e) => e.id)).not.toContain('sabotage');
    expect(eligible.map((e) => e.id)).toContain('diplomaticOpportunity');
    expect(eligible.map((e) => e.id)).toContain('euFragmentation');
  });

  it('allows crisis events when hasCrisisActive is false', () => {
    const eligible = getEligibleEvents(pool, 'earth', 'climateChange', 'eu', new Set(), false);
    expect(eligible.map((e) => e.id)).toContain('fundingCrisis');
  });
});

// ---------------------------------------------------------------------------
// selectNewEvents
// ---------------------------------------------------------------------------

describe('selectNewEvents', () => {
  it('returns deterministic results for the same seed', () => {
    const r1 = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ev1'), 5);
    const r2 = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng('ev1'), 5);
    expect(r1.map((e) => e.defId)).toEqual(r2.map((e) => e.defId));
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
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('limits to at most 1 event during the early-game protection window (turns 1–8)', () => {
    for (let turn = 1; turn <= 8; turn++) {
      const events = selectNewEvents(pool, 'earth', 'climateChange', 'eu', [], createRng(`early-${turn}`), turn);
      expect(events.length).toBeLessThanOrEqual(1);
    }
  });

  it('allows up to MAX_NEW_EVENTS_PER_TURN after the protection window (turn 9+)', () => {
    // Run many seeds and verify at least one produces 2 events after turn 8.
    let sawTwo = false;
    for (let i = 0; i < 200; i++) {
      const events = selectNewEvents(pool, 'earth', 'geopoliticalTension', 'eu', [], createRng(`late-${i}`), 9);
      if (events.length === 2) { sawTwo = true; break; }
    }
    expect(sawTwo).toBe(true);
  });

  it('never selects a second crisis event when one is already active', () => {
    // fundingCrisis is active and has 'crisis' tag — no other crisis should be added.
    const activeCrisis: EventInstance[] = [{
      id: 'fundingCrisis-t1',
      defId: 'fundingCrisis',
      arrivedTurn: 1,
      countdownRemaining: 2,
      resolved: false,
      resolvedWith: null,
    }];
    for (let i = 0; i < 200; i++) {
      const events = selectNewEvents(
        pool, 'earth', 'geopoliticalTension', 'eu', activeCrisis, createRng(`crisis-cap-${i}`), 9,
      );
      for (const e of events) {
        const def = pool.find((d) => d.id === e.defId);
        expect(def?.tags).not.toContain('crisis');
      }
    }
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
    const expired = {
      ...makeEventInstance('fundingCrisis', 1, 0),
      resolved: true,
      resolvedWith: 'expired' as const,
    };
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
    const events = [makeEventInstance('fundingCrisis', 1, 2), makeEventInstance('sabotage', 1, 2)];
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

  it('returns null for mitigation (mitigationCost is the only penalty)', () => {
    const effect = getEffectForResolution(fundingCrisisDef, 'mitigation');
    expect(effect).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyEventEffect
// ---------------------------------------------------------------------------

describe('applyEventEffect', () => {
  const rng = createRng('test');

  it('applies resource delta to player', () => {
    const effect = { resources: { funding: -20, materials: 10 } };
    const { player } = applyEventEffect(effect, basePlayer, [], 5, rng);
    expect(player.resources.funding).toBe(80);
    expect(player.resources.materials).toBe(60);
  });

  it('allows funding to go negative; clamps materials at 0', () => {
    const { player: p1 } = applyEventEffect({ resources: { funding: -999 } }, basePlayer, [], 5, rng);
    expect(p1.resources.funding).toBe(basePlayer.resources.funding - 999);
    const { player: p2 } = applyEventEffect({ resources: { materials: -999 } }, basePlayer, [], 5, rng);
    expect(p2.resources.materials).toBe(0);
  });

  it('applies field delta to player', () => {
    const effect = { fields: { physics: 10 } };
    const { player } = applyEventEffect(effect, basePlayer, [], 5, rng);
    expect(player.fields.physics).toBe(10);
  });

  it('handles effects with no resource or field changes', () => {
    const effect = {};
    const { player } = applyEventEffect(effect, basePlayer, [], 5, rng);
    expect(player.resources).toEqual(basePlayer.resources);
  });

  it('destroyTile: marks the specific tile as destroyed and returns updated tiles', () => {
    const tiles = [
      { coord: { q: 1, r: 0 }, type: 'coastal' as const, destroyedStatus: null, productivity: 1, facilityId: null, pendingActionId: null },
      { coord: { q: 0, r: 0 }, type: 'urban' as const, destroyedStatus: null, productivity: 1, facilityId: null, pendingActionId: null },
    ];
    const { mapTiles } = applyEventEffect({ destroyTile: { coordKey: '1,0', status: 'flooded' } }, basePlayer, tiles, 1, rng);
    expect(mapTiles.find(t => t.coord.q === 1 && t.coord.r === 0)?.destroyedStatus).toBe('flooded');
    expect(mapTiles.find(t => t.coord.q === 0 && t.coord.r === 0)?.destroyedStatus).toBeNull();
  });

  it('tileTypeTarget: destroys a random tile of the given type', () => {
    const tiles = [
      { coord: { q: 0, r: 0 }, type: 'urban' as const, destroyedStatus: null, productivity: 1, facilityId: null, pendingActionId: null },
      { coord: { q: 1, r: 0 }, type: 'coastal' as const, destroyedStatus: null, productivity: 1, facilityId: null, pendingActionId: null },
      { coord: { q: 2, r: 0 }, type: 'coastal' as const, destroyedStatus: null, productivity: 1, facilityId: null, pendingActionId: null },
    ];
    const { mapTiles } = applyEventEffect(
      { tileTypeTarget: 'coastal', destroyTileStatus: 'flooded' },
      basePlayer, tiles, 1, createRng('seed-a'),
    );
    const destroyed = mapTiles.filter(t => t.destroyedStatus === 'flooded');
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0].type).toBe('coastal');
    expect(mapTiles.find(t => t.type === 'urban')?.destroyedStatus).toBeNull();
  });

  it('tileTypeTarget: removes the facility on the destroyed tile', () => {
    const facilityId = 'fac-1';
    const tiles = [
      { coord: { q: 0, r: 0 }, type: 'coastal' as const, destroyedStatus: null, productivity: 1, facilityId, pendingActionId: null },
    ];
    const playerWithFacility: PlayerState = {
      ...basePlayer,
      facilities: [{ id: facilityId, defId: 'offshoreWindFarm', locationKey: '0,0', condition: 1, builtTurn: 1 }],
    };
    const { player, mapTiles } = applyEventEffect(
      { tileTypeTarget: 'coastal', destroyTileStatus: 'flooded' },
      playerWithFacility, tiles, 1, createRng('seed-b'),
    );
    expect(mapTiles[0].destroyedStatus).toBe('flooded');
    expect(mapTiles[0].facilityId).toBeNull();
    expect(player.facilities).toHaveLength(0);
  });

  it('tileTypeTarget: never destroys the HQ tile', () => {
    const facilityId = 'hq-inst';
    const tiles = [
      { coord: { q: 0, r: 0 }, type: 'urban' as const, destroyedStatus: null, productivity: 1, facilityId, pendingActionId: null },
    ];
    const playerWithHq: PlayerState = {
      ...basePlayer,
      facilities: [{ id: facilityId, defId: 'hq', locationKey: '0,0', condition: 1, builtTurn: 1 }],
    };
    const { mapTiles } = applyEventEffect(
      { tileTypeTarget: 'urban', destroyTileStatus: 'flooded' },
      playerWithHq, tiles, 1, createRng('seed-c'),
    );
    // Only candidate was the HQ tile — should not be destroyed
    expect(mapTiles[0].destroyedStatus).toBeNull();
  });

  it('tileTypeTarget: skips already-destroyed tiles', () => {
    const tiles = [
      { coord: { q: 0, r: 0 }, type: 'coastal' as const, destroyedStatus: 'flooded' as const, productivity: 1, facilityId: null, pendingActionId: null },
    ];
    const { mapTiles } = applyEventEffect(
      { tileTypeTarget: 'coastal', destroyTileStatus: 'flooded' },
      basePlayer, tiles, 1, rng,
    );
    expect(mapTiles[0].destroyedStatus).toBe('flooded'); // unchanged, was already destroyed
  });
});

// ---------------------------------------------------------------------------
// formatEffectForNews
// ---------------------------------------------------------------------------

describe('formatEffectForNews', () => {
  it('formats negative resource changes', () => {
    const text = formatEffectForNews({ resources: { materials: -35 } });
    expect(text).toBe('Materials -35');
  });

  it('formats positive resource changes', () => {
    const text = formatEffectForNews({ resources: { materials: 25 } });
    expect(text).toBe('Materials +25');
  });

  it('formats multiple resources', () => {
    const text = formatEffectForNews({ resources: { funding: -10, politicalWill: -25 } });
    expect(text).toBe('Funding -10, Political Will -25');
  });

  it('returns no immediate effect for empty effect', () => {
    expect(formatEffectForNews({})).toBe('no immediate effect');
    expect(formatEffectForNews({ resources: {} })).toBe('no immediate effect');
  });

  it('omits zero-value entries', () => {
    const text = formatEffectForNews({ resources: { funding: 0, materials: -20 } });
    expect(text).toBe('Materials -20');
  });
});

// ---------------------------------------------------------------------------
// Weighted event selection
// ---------------------------------------------------------------------------

/** Build a minimal EventDef for weight tests. */
function makeWeightedDef(id: string, weight: number): EventDef {
  return {
    id,
    name: id,
    description: '',
    flavourText: '',
    tags: [],
    eras: ['earth'],
    pushFactors: null,
    blocIds: null,
    countdownTurns: 2,
    weight,
    responseTier: 'noCounter',
    negativeEffect: {},
    positiveEffect: null,
  };
}

describe('weighted event selection', () => {
  it('higher-weight events are selected proportionally more often', () => {
    const heavy = makeWeightedDef('heavy', 3.0);
    const light = makeWeightedDef('light', 1.0);
    const weightedPool = [heavy, light];

    // Collect defIds from runs where exactly one event was selected (count=1).
    // This isolates the weighted pick from count=2 runs where both are always selected.
    const singlePickCounts: Record<string, number> = { heavy: 0, light: 0 };

    for (let i = 0; i < 500; i++) {
      const results = selectNewEvents(
        weightedPool,
        'earth',
        'climateChange',
        'eu',
        [],
        createRng(`weight-stat-${i}`),
        10,
      );
      if (results.length === 1) {
        singlePickCounts[results[0].defId] = (singlePickCounts[results[0].defId] ?? 0) + 1;
      }
    }

    // heavy (weight 3) should be selected at least twice as often as light (weight 1)
    // Expected ratio ~3:1; allow generous margin for variance.
    expect(singlePickCounts.heavy).toBeGreaterThan(singlePickCounts.light * 1.5);
  });

  it('zero-weight events are never selected', () => {
    const zero = makeWeightedDef('zero', 0);
    const normal = makeWeightedDef('normal', 1.0);
    const weightedPool = [zero, normal];

    let zeroCount = 0;
    let normalCount = 0;

    for (let i = 0; i < 300; i++) {
      const results = selectNewEvents(
        weightedPool,
        'earth',
        'climateChange',
        'eu',
        [],
        createRng(`weight-zero-${i}`),
        10,
      );
      for (const e of results) {
        if (e.defId === 'zero') zeroCount++;
        if (e.defId === 'normal') normalCount++;
      }
    }

    expect(zeroCount).toBe(0);
    expect(normalCount).toBeGreaterThan(0);
  });

  it('equal-weight events are selected at comparable rates', () => {
    const a = makeWeightedDef('eventA', 1.0);
    const b = makeWeightedDef('eventB', 1.0);
    const weightedPool = [a, b];

    const singlePickCounts: Record<string, number> = { eventA: 0, eventB: 0 };

    for (let i = 0; i < 600; i++) {
      const results = selectNewEvents(
        weightedPool,
        'earth',
        'climateChange',
        'eu',
        [],
        createRng(`weight-equal-${i}`),
        10,
      );
      if (results.length === 1) {
        singlePickCounts[results[0].defId] = (singlePickCounts[results[0].defId] ?? 0) + 1;
      }
    }

    const total = singlePickCounts.eventA + singlePickCounts.eventB;
    if (total > 0) {
      // Neither event should dominate — each should land within 30–70% of single picks.
      const ratioA = singlePickCounts.eventA / total;
      expect(ratioA).toBeGreaterThan(0.3);
      expect(ratioA).toBeLessThan(0.7);
    }
  });

  it('weights do not bypass eligibility filters', () => {
    // High-weight event gated to geopoliticalTension push factor.
    const gated = { ...makeWeightedDef('gated', 99.0), pushFactors: ['geopoliticalTension'] as const };
    const open = makeWeightedDef('open', 1.0);
    const weightedPool = [gated, open];

    for (let i = 0; i < 100; i++) {
      const results = selectNewEvents(
        weightedPool,
        'earth',
        'climateChange', // does not match gated event's pushFactor
        'eu',
        [],
        createRng(`weight-filter-${i}`),
        10,
      );
      for (const e of results) {
        expect(e.defId).not.toBe('gated');
      }
    }
  });
});
