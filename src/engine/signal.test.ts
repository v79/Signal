import { describe, it, expect } from 'vitest';
import {
  computeSignalProgressDelta,
  computeEraStrength,
  tickSignalProgress,
  isSignalClimax,
  generateWormholeOptions,
  commitSignalResponse,
  didCrossStrengthThreshold,
  signalProgressNewsText,
  computeSignalCap,
  isSignalPaused,
  SIGNAL_CAPS,
} from './signal';
import { applyEventEffect } from './events';
import { tickActiveProjects } from './projects';
import { createGameState, ZERO_FIELDS as ZERO_FIELDS_STATE, ZERO_RESOURCES } from './state';
import { createRng } from './rng';
import type {
  SignalState,
  FieldPoints,
  FacilityInstance,
  FacilityDef,
  SignalResponseOption,
  PlayerState,
  GameState,
  ProjectDef,
} from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_SIGNAL: SignalState = {
  decodeProgress: 0,
  eraStrength: 'faint',
  responseCommitted: false,
  responseCorrect: null,
  wormholeActivated: false,
};

const ZERO_FIELDS: FieldPoints = {
  physics: 0,
  mathematics: 0,
  engineering: 0,
  biochemistry: 0,
  computing: 0,
  socialScience: 0,
};

const HIGH_FIELDS: FieldPoints = {
  physics: 100,
  mathematics: 100,
  engineering: 0,
  biochemistry: 0,
  computing: 0,
  socialScience: 0,
};

const ARRAY_DEF: FacilityDef = {
  id: 'deepSpaceArray',
  name: 'Deep Space Array',
  description: 'Signal decoding infrastructure.',
  era: 'earth',
  allowedTileTypes: [],
  buildCost: {},
  upkeepCost: {},
  buildTime: 3,
  deleteTime: 2,
  canDelete: true,
  fieldOutput: { physics: 5, computing: 3 },
  resourceOutput: {},
  adjacencyBonuses: [],
  adjacencyPenalties: [],
  depletes: false,
  requiredTechId: null,
};

const DEFS: Map<string, FacilityDef> = new Map([['deepSpaceArray', ARRAY_DEF]]);

function makeArray(n = 1): FacilityInstance[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `dsa-${i}`,
    defId: 'deepSpaceArray',
    locationKey: `0,${i}`,
    condition: 1,
    builtTurn: 1,
  }));
}

// ---------------------------------------------------------------------------
// computeSignalProgressDelta
// ---------------------------------------------------------------------------

describe('computeSignalProgressDelta', () => {
  it('returns base progress with no fields or arrays', () => {
    expect(computeSignalProgressDelta(ZERO_FIELDS, [], new Map())).toBeCloseTo(0.05);
  });

  it('adds field contribution: (physics + mathematics) / 50', () => {
    const delta = computeSignalProgressDelta(HIGH_FIELDS, [], new Map());
    // 0.05 + (100 + 100) / 50 = 0.05 + 4 = 4.05
    expect(delta).toBeCloseTo(4.05);
  });

  it('adds ARRAY_BONUS (3) per Deep Space Array', () => {
    const delta = computeSignalProgressDelta(ZERO_FIELDS, makeArray(2), DEFS);
    // 0.05 + 0 + 2 * 3 = 6.05
    expect(delta).toBeCloseTo(6.05);
  });

  it('ignores non-array facilities', () => {
    const other: FacilityInstance[] = [
      { id: 'r1', defId: 'researchLab', locationKey: '0,0', condition: 1, builtTurn: 1 },
    ];
    const delta = computeSignalProgressDelta(ZERO_FIELDS, other, DEFS);
    expect(delta).toBeCloseTo(0.05);
  });

  it('combines fields and arrays', () => {
    const delta = computeSignalProgressDelta(HIGH_FIELDS, makeArray(1), DEFS);
    // 0.05 + 4 + 3 = 7.05
    expect(delta).toBeCloseTo(7.05);
  });
});

// ---------------------------------------------------------------------------
// computeEraStrength
// ---------------------------------------------------------------------------

describe('computeEraStrength', () => {
  it('returns faint below 30', () => {
    expect(computeEraStrength(0)).toBe('faint');
    expect(computeEraStrength(29)).toBe('faint');
  });

  it('returns structured at 30', () => {
    expect(computeEraStrength(30)).toBe('structured');
    expect(computeEraStrength(69)).toBe('structured');
  });

  it('returns urgent at 70', () => {
    expect(computeEraStrength(70)).toBe('urgent');
    expect(computeEraStrength(100)).toBe('urgent');
  });
});

// ---------------------------------------------------------------------------
// tickSignalProgress
// ---------------------------------------------------------------------------

describe('tickSignalProgress', () => {
  it('advances progress', () => {
    const next = tickSignalProgress(BASE_SIGNAL, ZERO_FIELDS, [], new Map(), 'earth', 100);
    expect(next.decodeProgress).toBeCloseTo(0.05);
  });

  it('upgrades eraStrength when crossing threshold', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 29 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, [], new Map(), 'earth', 100);
    // 29 + 4.25 > 30 → structured
    expect(next.eraStrength).toBe('structured');
  });

  it('caps at 100 when cap is 100', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 99.9 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(5), DEFS, 'earth', 100);
    expect(next.decodeProgress).toBe(100);
  });

  it('is a no-op when responseCommitted', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 50, responseCommitted: true };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(3), DEFS, 'earth', 100);
    expect(next.decodeProgress).toBe(50);
  });

  it('caps at 33 when cap is 33 and fields are high', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 32 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(3), DEFS, 'earth', 33);
    expect(next.decodeProgress).toBe(33);
  });

  it('does not advance past cap even when already near ceiling', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 33 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(3), DEFS, 'earth', 33);
    expect(next.decodeProgress).toBe(33);
  });

  it('is a no-op when paused in nearSpace with no relay facility', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 20 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, [], new Map(), 'nearSpace', 100);
    expect(next.decodeProgress).toBe(20);
  });

  it('advances normally in nearSpace when relay facility is present', () => {
    const relayDef: FacilityDef = {
      id: 'signalRelayStation',
      name: 'Signal Relay Station',
      description: '',
      era: 'nearSpace',
      allowedTileTypes: [],
      buildCost: {},
      upkeepCost: {},
      buildTime: 1,
      deleteTime: 1,
      canDelete: true,
      fieldOutput: { physics: 2, mathematics: 2 },
      resourceOutput: {},
      adjacencyBonuses: [],
      adjacencyPenalties: [],
      depletes: false,
      requiredTechId: null,
    };
    const relayInstance: FacilityInstance = {
      id: 'relay-1',
      defId: 'signalRelayStation',
      locationKey: 'space-0',
      condition: 1,
      builtTurn: 1,
    };
    const defs = new Map([['signalRelayStation', relayDef]]);
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 20 };
    const next = tickSignalProgress(signal, ZERO_FIELDS, [relayInstance], defs, 'nearSpace', 100);
    expect(next.decodeProgress).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// computeSignalCap
// ---------------------------------------------------------------------------

describe('computeSignalCap', () => {
  it('returns 33 when neither gate tech is discovered', () => {
    expect(computeSignalCap(new Set())).toBe(33);
  });

  it('returns 66 when only era1Gate is discovered', () => {
    expect(computeSignalCap(new Set([SIGNAL_CAPS.era1Gate]))).toBe(66);
  });

  it('returns 100 when both gates are discovered', () => {
    expect(computeSignalCap(new Set([SIGNAL_CAPS.era1Gate, SIGNAL_CAPS.era2Gate]))).toBe(100);
  });

  it('returns 33 when only era2Gate is discovered (era1 still required first)', () => {
    expect(computeSignalCap(new Set([SIGNAL_CAPS.era2Gate]))).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// isSignalPaused
// ---------------------------------------------------------------------------

describe('isSignalPaused', () => {
  const relayDef: FacilityDef = {
    id: 'signalRelayStation',
    name: 'Signal Relay Station',
    description: '',
    era: 'nearSpace',
    allowedTileTypes: [],
    buildCost: {},
    upkeepCost: {},
    buildTime: 1,
    deleteTime: 1,
    canDelete: true,
    fieldOutput: {},
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
  };
  const relayInstance: FacilityInstance = {
    id: 'relay-1',
    defId: 'signalRelayStation',
    locationKey: 'space-0',
    condition: 1,
    builtTurn: 1,
  };
  const relayDefs = new Map([['signalRelayStation', relayDef]]);

  it('returns false in earth era regardless of facilities', () => {
    expect(isSignalPaused('earth', [], new Map())).toBe(false);
    expect(isSignalPaused('earth', [relayInstance], relayDefs)).toBe(false);
  });

  it('returns true in nearSpace with no relay facility', () => {
    expect(isSignalPaused('nearSpace', [], new Map())).toBe(true);
  });

  it('returns false in nearSpace when relay facility is present', () => {
    expect(isSignalPaused('nearSpace', [relayInstance], relayDefs)).toBe(false);
  });

  it('returns true in deepSpace with no relay facility', () => {
    expect(isSignalPaused('deepSpace', [], new Map())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSignalClimax
// ---------------------------------------------------------------------------

describe('isSignalClimax', () => {
  it('false when progress < 100', () => {
    expect(isSignalClimax({ ...BASE_SIGNAL, decodeProgress: 99 })).toBe(false);
  });

  it('true when progress >= 100 and not committed', () => {
    expect(isSignalClimax({ ...BASE_SIGNAL, decodeProgress: 100 })).toBe(true);
  });

  it('false when already committed', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 100, responseCommitted: true };
    expect(isSignalClimax(signal)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateWormholeOptions
// ---------------------------------------------------------------------------

describe('generateWormholeOptions', () => {
  it('generates 2 options when progress < 70', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 60 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    expect(opts).toHaveLength(2);
  });

  it('generates 3 options when progress >= 70', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 70 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    expect(opts).toHaveLength(3);
  });

  it('always has exactly one correct option', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
    for (const seed of ['a', 'b', 'c', 'signal-demo', 'xyz']) {
      const opts = generateWormholeOptions(signal, createRng(seed));
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('correct option gets high hint when progress >= 90', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 95 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find((o) => o.correct)!;
    expect(correct.confidenceHint).toBe('high');
  });

  it('correct option gets medium hint when progress 70–89', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 75 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find((o) => o.correct)!;
    expect(correct.confidenceHint).toBe('medium');
  });

  it('correct option gets low hint when progress < 70', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 50 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find((o) => o.correct)!;
    expect(correct.confidenceHint).toBe('low');
  });

  it('produces deterministic results for the same seed', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
    const a = generateWormholeOptions(signal, createRng('same-seed'));
    const b = generateWormholeOptions(signal, createRng('same-seed'));
    expect(a.map((o) => o.correct)).toEqual(b.map((o) => o.correct));
  });

  it('correct option position varies by seed', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
    const positions = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const opts = generateWormholeOptions(signal, createRng(`seed-${i}`));
      positions.add(opts.findIndex((o) => o.correct));
    }
    // Should see at least 2 different positions across 20 seeds
    expect(positions.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// commitSignalResponse
// ---------------------------------------------------------------------------

describe('commitSignalResponse', () => {
  it('marks committed and correct when right option chosen', () => {
    const opts: SignalResponseOption[] = [
      { id: 'opt-0', label: 'A', confidenceHint: null, correct: false },
      { id: 'opt-1', label: 'B', confidenceHint: 'high', correct: true },
    ];
    const next = commitSignalResponse(BASE_SIGNAL, 'opt-1', opts);
    expect(next.responseCommitted).toBe(true);
    expect(next.responseCorrect).toBe(true);
    expect(next.wormholeActivated).toBe(true);
  });

  it('marks committed but not wormhole when wrong option chosen', () => {
    const opts: SignalResponseOption[] = [
      { id: 'opt-0', label: 'A', confidenceHint: null, correct: false },
      { id: 'opt-1', label: 'B', confidenceHint: 'high', correct: true },
    ];
    const next = commitSignalResponse(BASE_SIGNAL, 'opt-0', opts);
    expect(next.responseCommitted).toBe(true);
    expect(next.responseCorrect).toBe(false);
    expect(next.wormholeActivated).toBe(false);
  });

  it('is a no-op for unknown option id', () => {
    const opts: SignalResponseOption[] = [
      { id: 'opt-0', label: 'A', confidenceHint: null, correct: true },
    ];
    const next = commitSignalResponse(BASE_SIGNAL, 'nonexistent', opts);
    expect(next).toBe(BASE_SIGNAL);
  });
});

// ---------------------------------------------------------------------------
// didCrossStrengthThreshold
// ---------------------------------------------------------------------------

describe('didCrossStrengthThreshold', () => {
  it('detects faint → structured crossing', () => {
    expect(didCrossStrengthThreshold(29, 30)).toBe(true);
    expect(didCrossStrengthThreshold(29, 35)).toBe(true);
  });

  it('detects structured → urgent crossing', () => {
    expect(didCrossStrengthThreshold(69, 70)).toBe(true);
  });

  it('false when no threshold crossed', () => {
    expect(didCrossStrengthThreshold(10, 20)).toBe(false);
    expect(didCrossStrengthThreshold(30, 50)).toBe(false);
    expect(didCrossStrengthThreshold(70, 90)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signalProgressNewsText
// ---------------------------------------------------------------------------

describe('signalProgressNewsText', () => {
  it('returns appropriate text at each tier', () => {
    expect(signalProgressNewsText(10, 3)).toContain('Anomalous');
    expect(signalProgressNewsText(50, 10)).toContain('non-random');
    expect(signalProgressNewsText(80, 20)).toContain('urgent');
    expect(signalProgressNewsText(95, 30)).toContain('response window');
  });
});

// ---------------------------------------------------------------------------
// Signal cap enforcement at the two threshold points (33% and 66%)
//
// Two tech-gated thresholds block decode progress until the gate techs are
// discovered:
//   - 33% cap until `signalPatternAnalysis` is discovered
//   - 66% cap until `interstellarSignalDecryption` is discovered
//
// These tests verify that no source of progress (passive ticking from fields
// + Deep Space Arrays, event signal effects, project one-off rewards) can
// drive `decodeProgress` past the active cap.
// ---------------------------------------------------------------------------

describe('signal cap blocks progress at threshold points', () => {
  // Maximal inputs: any combination here produces a per-tick delta in the
  // hundreds, so if the cap weren't enforced these would blow past it on
  // the first tick.
  const HUGE_FIELDS: FieldPoints = {
    physics: 1000,
    mathematics: 1000,
    engineering: 0,
    biochemistry: 0,
    computing: 0,
    socialScience: 0,
  };
  const MANY_ARRAYS = (() => makeArray(50))();

  // -------------------------------------------------------------------------
  // Direct passive tick — caps must hold even with maximal inputs
  // -------------------------------------------------------------------------

  describe('tickSignalProgress passive accumulation', () => {
    it('caps progress at 33 (era1 gate undiscovered) when starting below cap', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 0 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 33);
      expect(next.decodeProgress).toBe(33);
    });

    it('caps progress at 66 (era2 gate undiscovered) when starting below cap', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 0 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 66);
      expect(next.decodeProgress).toBe(66);
    });

    it('does not advance once at 33 cap, even with maximal inputs', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 33 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 33);
      expect(next.decodeProgress).toBe(33);
    });

    it('does not advance once at 66 cap, even with maximal inputs', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 66 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 66);
      expect(next.decodeProgress).toBe(66);
    });

    it('stays at 33 cap across many ticks with maximal inputs', () => {
      let signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 33 };
      for (let i = 0; i < 100; i++) {
        signal = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 33);
      }
      expect(signal.decodeProgress).toBe(33);
    });

    it('stays at 66 cap across many ticks with maximal inputs', () => {
      let signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 66 };
      for (let i = 0; i < 100; i++) {
        signal = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 66);
      }
      expect(signal.decodeProgress).toBe(66);
    });

    it('cap derived from computeSignalCap(no gates) feeds directly into tick clamp', () => {
      const cap = computeSignalCap(new Set());
      expect(cap).toBe(33);
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 32 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', cap);
      expect(next.decodeProgress).toBe(33);
    });

    it('cap derived from computeSignalCap(era1Gate only) feeds directly into tick clamp', () => {
      const cap = computeSignalCap(new Set([SIGNAL_CAPS.era1Gate]));
      expect(cap).toBe(66);
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 65 };
      const next = tickSignalProgress(signal, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', cap);
      expect(next.decodeProgress).toBe(66);
    });
  });

  // -------------------------------------------------------------------------
  // Re-clamp invariant — if some other path (event effect, project reward)
  // pushed the signal above the cap, the next passive tick must bring it
  // back down. This is what the World Phase orchestrator relies on.
  // -------------------------------------------------------------------------

  describe('re-clamp after over-cap input', () => {
    it('re-clamps to 33 when entering tick already over cap', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
      const next = tickSignalProgress(signal, ZERO_FIELDS, [], new Map(), 'earth', 33);
      expect(next.decodeProgress).toBe(33);
    });

    it('re-clamps to 66 when entering tick already over cap', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 95 };
      const next = tickSignalProgress(signal, ZERO_FIELDS, [], new Map(), 'earth', 66);
      expect(next.decodeProgress).toBe(66);
    });
  });

  // -------------------------------------------------------------------------
  // Event signal effects must not persist above the cap.
  // applyEventEffect itself only clamps to [0, 100] (it intentionally bypasses
  // the era cap so an event can cause a temporary surge), but the next signal
  // tick is required to bring decodeProgress back to the cap.
  // -------------------------------------------------------------------------

  describe('positive event signalProgress cannot push past cap once tick runs', () => {
    const eventPlayer: PlayerState = {
      blocDefId: 'eu',
      resources: { funding: 100, materials: 50, politicalWill: 60 },
      fields: { ...ZERO_FIELDS_STATE },
      will: 60,
      willProfile: 'democratic',
      facilities: [],
      completedProjectIds: {},
      projectHostFacilityIds: {},
      activeProjects: [],
      techs: [],
      cards: [],
      board: {},
      newsFeed: [],
      constructionQueue: [],
    };

    it('event +50 signal at cap=33: tick re-clamps to 33', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 30 };
      const result = applyEventEffect(
        { signalProgress: 50 },
        eventPlayer,
        [],
        1,
        createRng('cap-evt-33'),
        new Map(),
        signal,
      );
      // Sanity: applyEventEffect alone bypasses the cap (clamps to [0, 100] only).
      expect(result.signal!.decodeProgress).toBe(80);

      // The next passive tick at cap=33 brings the signal back to the cap.
      const after = tickSignalProgress(result.signal!, ZERO_FIELDS, [], new Map(), 'earth', 33);
      expect(after.decodeProgress).toBe(33);
    });

    it('event +50 signal at cap=66: tick re-clamps to 66', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 60 };
      const result = applyEventEffect(
        { signalProgress: 50 },
        eventPlayer,
        [],
        1,
        createRng('cap-evt-66'),
        new Map(),
        signal,
      );
      expect(result.signal!.decodeProgress).toBe(100);

      const after = tickSignalProgress(result.signal!, ZERO_FIELDS, [], new Map(), 'earth', 66);
      expect(after.decodeProgress).toBe(66);
    });

    it('an event already at cap with positive signalProgress: tick still caps', () => {
      const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 33 };
      const result = applyEventEffect(
        { signalProgress: 25 },
        eventPlayer,
        [],
        1,
        createRng('cap-evt-at-cap'),
        new Map(),
        signal,
      );
      expect(result.signal!.decodeProgress).toBe(58);

      const after = tickSignalProgress(result.signal!, HUGE_FIELDS, MANY_ARRAYS, DEFS, 'earth', 33);
      expect(after.decodeProgress).toBe(33);
    });
  });

  // -------------------------------------------------------------------------
  // Project one-off signalProgress rewards must not persist above the cap.
  // tickActiveProjects clamps the reward to [0, 100]; the cap is enforced by
  // the World Phase via tickSignalProgress on the next signal tick.
  // -------------------------------------------------------------------------

  describe('project one-off signalProgress reward cannot push past cap once tick runs', () => {
    /** Build a state with an active project that completes in one tick. */
    function makeStateWithActiveProject(
      def: ProjectDef,
      initialDecode: number,
    ): { state: GameState; defs: Map<string, ProjectDef> } {
      const state = createGameState({
        seed: 'cap-test',
        playerBlocDefId: 'northAmericanAlliance',
        pushFactor: 'climateChange',
        startYear: 1970,
        willProfile: 'democratic',
        startingWill: 50,
        startingResources: { funding: 100, materials: 80, politicalWill: 50 },
      });
      state.signal = { ...state.signal, decodeProgress: initialDecode };
      state.player = {
        ...state.player,
        activeProjects: [
          {
            id: `${def.id}-t${state.turn}`,
            defId: def.id,
            startTurn: state.turn,
            turnsElapsed: def.baseDuration - 1,
            effectiveDuration: def.baseDuration,
          },
        ],
      };
      return { state, defs: new Map([[def.id, def]]) };
    }

    const BIG_REWARD_PROJECT: ProjectDef = {
      id: 'bigSignalProject',
      name: 'Big Signal Project',
      description: 'Hands out a large one-off signal boost.',
      type: 'scientific',
      era: 'earth',
      cost: { funding: 0 },
      upkeepCost: {},
      baseDuration: 1,
      oneOffReward: { signalProgress: 60 },
      landmarkGate: null,
      prerequisites: {},
    };

    it('project +60 signal at cap=33: tick re-clamps to 33', () => {
      const { state, defs } = makeStateWithActiveProject(BIG_REWARD_PROJECT, 30);
      const { state: afterProjects } = tickActiveProjects(state, defs, state.turn + 1);
      // The project reward bypasses the cap (it just clamps to 100).
      expect(afterProjects.signal.decodeProgress).toBe(90);

      // The next passive tick at cap=33 brings the signal back to the cap.
      const after = tickSignalProgress(
        afterProjects.signal,
        ZERO_FIELDS,
        [],
        new Map(),
        'earth',
        33,
      );
      expect(after.decodeProgress).toBe(33);
    });

    it('project +60 signal at cap=66: tick re-clamps to 66', () => {
      const { state, defs } = makeStateWithActiveProject(BIG_REWARD_PROJECT, 60);
      const { state: afterProjects } = tickActiveProjects(state, defs, state.turn + 1);
      expect(afterProjects.signal.decodeProgress).toBe(100);

      const after = tickSignalProgress(
        afterProjects.signal,
        ZERO_FIELDS,
        [],
        new Map(),
        'earth',
        66,
      );
      expect(after.decodeProgress).toBe(66);
    });

    it('project completing while signal is at cap: tick still holds at cap', () => {
      const { state, defs } = makeStateWithActiveProject(BIG_REWARD_PROJECT, 33);
      const { state: afterProjects } = tickActiveProjects(state, defs, state.turn + 1);
      expect(afterProjects.signal.decodeProgress).toBe(93);

      const after = tickSignalProgress(
        afterProjects.signal,
        HUGE_FIELDS,
        MANY_ARRAYS,
        DEFS,
        'earth',
        33,
      );
      expect(after.decodeProgress).toBe(33);
    });
  });

  // -------------------------------------------------------------------------
  // Suppress unused-warnings for ZERO_RESOURCES (kept for parity with
  // other engine tests that import it from state.ts).
  // -------------------------------------------------------------------------
  it('ZERO_RESOURCES is importable (smoke check)', () => {
    expect(ZERO_RESOURCES.funding).toBe(0);
  });
});
