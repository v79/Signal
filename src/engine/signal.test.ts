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
} from './signal';
import { createRng } from './rng';
import type { SignalState, FieldPoints, FacilityInstance, FacilityDef, SignalResponseOption } from './types';

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
  physics: 0, mathematics: 0, engineering: 0,
  biochemistry: 0, computing: 0, socialScience: 0,
};

const HIGH_FIELDS: FieldPoints = {
  physics: 100, mathematics: 100, engineering: 0,
  biochemistry: 0, computing: 0, socialScience: 0,
};

const ARRAY_DEF: FacilityDef = {
  id: 'deepSpaceArray',
  name: 'Deep Space Array',
  description: 'Signal decoding infrastructure.',
  era: 'earth',
  allowedTileTypes: [],
  buildCost: {},
  upkeepCost: {},
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
    id: `dsa-${i}`, defId: 'deepSpaceArray',
    locationKey: `0,${i}`, condition: 1, builtTurn: 1,
  }));
}

// ---------------------------------------------------------------------------
// computeSignalProgressDelta
// ---------------------------------------------------------------------------

describe('computeSignalProgressDelta', () => {
  it('returns base progress with no fields or arrays', () => {
    expect(computeSignalProgressDelta(ZERO_FIELDS, [], new Map())).toBeCloseTo(0.25);
  });

  it('adds field contribution: (physics + mathematics) / 50', () => {
    const delta = computeSignalProgressDelta(HIGH_FIELDS, [], new Map());
    // 0.25 + (100 + 100) / 50 = 0.25 + 4 = 4.25
    expect(delta).toBeCloseTo(4.25);
  });

  it('adds ARRAY_BONUS (3) per Deep Space Array', () => {
    const delta = computeSignalProgressDelta(ZERO_FIELDS, makeArray(2), DEFS);
    // 0.25 + 0 + 2 * 3 = 6.25
    expect(delta).toBeCloseTo(6.25);
  });

  it('ignores non-array facilities', () => {
    const other: FacilityInstance[] = [{ id: 'r1', defId: 'researchLab', locationKey: '0,0', condition: 1, builtTurn: 1 }];
    const delta = computeSignalProgressDelta(ZERO_FIELDS, other, DEFS);
    expect(delta).toBeCloseTo(0.25);
  });

  it('combines fields and arrays', () => {
    const delta = computeSignalProgressDelta(HIGH_FIELDS, makeArray(1), DEFS);
    // 0.25 + 4 + 3 = 7.25
    expect(delta).toBeCloseTo(7.25);
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
    const next = tickSignalProgress(BASE_SIGNAL, ZERO_FIELDS, [], new Map());
    expect(next.decodeProgress).toBeCloseTo(0.25);
  });

  it('upgrades eraStrength when crossing threshold', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 29 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, [], new Map());
    // 29 + 4.25 > 30 → structured
    expect(next.eraStrength).toBe('structured');
  });

  it('caps at 100', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 99.9 };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(5), DEFS);
    expect(next.decodeProgress).toBe(100);
  });

  it('is a no-op when responseCommitted', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 50, responseCommitted: true };
    const next = tickSignalProgress(signal, HIGH_FIELDS, makeArray(3), DEFS);
    expect(next.decodeProgress).toBe(50);
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
      expect(opts.filter(o => o.correct)).toHaveLength(1);
    }
  });

  it('correct option gets high hint when progress >= 90', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 95 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find(o => o.correct)!;
    expect(correct.confidenceHint).toBe('high');
  });

  it('correct option gets medium hint when progress 70–89', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 75 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find(o => o.correct)!;
    expect(correct.confidenceHint).toBe('medium');
  });

  it('correct option gets low hint when progress < 70', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 50 };
    const opts = generateWormholeOptions(signal, createRng('test'));
    const correct = opts.find(o => o.correct)!;
    expect(correct.confidenceHint).toBe('low');
  });

  it('produces deterministic results for the same seed', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
    const a = generateWormholeOptions(signal, createRng('same-seed'));
    const b = generateWormholeOptions(signal, createRng('same-seed'));
    expect(a.map(o => o.correct)).toEqual(b.map(o => o.correct));
  });

  it('correct option position varies by seed', () => {
    const signal: SignalState = { ...BASE_SIGNAL, decodeProgress: 80 };
    const positions = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const opts = generateWormholeOptions(signal, createRng(`seed-${i}`));
      positions.add(opts.findIndex(o => o.correct));
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
