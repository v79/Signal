import { describe, it, expect } from 'vitest';
import {
  tickWill,
  computeBankDecay,
  applyFieldDeltas,
  applyResourceDeltas,
  DEFAULT_WILL_CONFIG,
} from './resources';
import type { CardInstance, FieldPoints, Resources } from './types';
import { ZERO_FIELDS, ZERO_RESOURCES } from './state';

// ---------------------------------------------------------------------------
// tickWill
// ---------------------------------------------------------------------------

describe('tickWill', () => {
  const democratic = DEFAULT_WILL_CONFIG.democratic;
  const authoritarian = DEFAULT_WILL_CONFIG.authoritarian;

  it('moves democratic Will up toward equilibrium when below it', () => {
    const result = tickWill(40, democratic);
    expect(result).toBeGreaterThan(40);
  });

  it('moves democratic Will down toward equilibrium when above it', () => {
    const result = tickWill(80, democratic);
    expect(result).toBeLessThan(80);
  });

  it('clamps democratic Will at the ceiling', () => {
    const result = tickWill(democratic.willCeiling, democratic);
    expect(result).toBeLessThanOrEqual(democratic.willCeiling);
  });

  it('clamps Will at 0 (never goes negative)', () => {
    const result = tickWill(0, democratic);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('authoritarian Will drifts more slowly than democratic', () => {
    const startWill = 30; // below equilibrium for both
    const democraticDrift = tickWill(startWill, democratic) - startWill;
    const authoritarianDrift = tickWill(startWill, authoritarian) - startWill;
    expect(democraticDrift).toBeGreaterThan(authoritarianDrift);
  });

  it('authoritarian Will ceiling is lower than democratic ceiling', () => {
    expect(authoritarian.willCeiling).toBeLessThan(democratic.willCeiling);
  });

  it('authoritarian Will does not exceed its ceiling', () => {
    const result = tickWill(authoritarian.willCeiling + 10, authoritarian);
    expect(result).toBeLessThanOrEqual(authoritarian.willCeiling);
  });
});

// ---------------------------------------------------------------------------
// computeBankDecay
// ---------------------------------------------------------------------------

describe('computeBankDecay', () => {
  function makeCard(id: string, zone: CardInstance['zone']): CardInstance {
    return { id, defId: 'anyCard', zone, bankedSinceTurn: zone === 'bank' ? 1 : null };
  }

  it('returns 0 with no cards in bank', () => {
    const cards = [makeCard('c1', 'hand'), makeCard('c2', 'deck')];
    expect(computeBankDecay(cards)).toBe(0);
  });

  it('returns 1 Funding per banked card', () => {
    const cards = [makeCard('c1', 'bank'), makeCard('c2', 'bank'), makeCard('c3', 'hand')];
    expect(computeBankDecay(cards)).toBe(2);
  });

  it('returns 0 with an empty card list', () => {
    expect(computeBankDecay([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyFieldDeltas
// ---------------------------------------------------------------------------

describe('applyFieldDeltas', () => {
  it('adds deltas to current fields', () => {
    const current: FieldPoints = { ...ZERO_FIELDS, physics: 20, mathematics: 10 };
    const delta: FieldPoints = { ...ZERO_FIELDS, physics: 5, computing: 3 };
    const result = applyFieldDeltas(current, delta);

    expect(result.physics).toBe(25);
    expect(result.mathematics).toBe(10);
    expect(result.computing).toBe(3);
  });

  it('clamps fields at 0 (cannot go negative)', () => {
    const current: FieldPoints = { ...ZERO_FIELDS, physics: 2 };
    const delta: FieldPoints = { ...ZERO_FIELDS, physics: -10 };
    const result = applyFieldDeltas(current, delta);

    expect(result.physics).toBe(0);
  });

  it('does not mutate the input', () => {
    const current: FieldPoints = { ...ZERO_FIELDS, physics: 10 };
    const delta: FieldPoints = { ...ZERO_FIELDS, physics: 5 };
    applyFieldDeltas(current, delta);
    expect(current.physics).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// applyResourceDeltas
// ---------------------------------------------------------------------------

describe('applyResourceDeltas', () => {
  const base: Resources = { funding: 100, materials: 50, politicalWill: 0 };

  it('adds facility output to current resources', () => {
    const facilityDelta: Resources = { funding: 20, materials: 10, politicalWill: 0 };
    const result = applyResourceDeltas(base, facilityDelta, 0, ZERO_RESOURCES);

    expect(result.funding).toBe(120);
    expect(result.materials).toBe(60);
  });

  it('subtracts bank decay from Funding', () => {
    const result = applyResourceDeltas(base, ZERO_RESOURCES, 3, ZERO_RESOURCES);
    expect(result.funding).toBe(97);
  });

  it('subtracts project upkeep from all resources', () => {
    const upkeep: Resources = { funding: 10, materials: 5, politicalWill: 0 };
    const result = applyResourceDeltas(base, ZERO_RESOURCES, 0, upkeep);

    expect(result.funding).toBe(90);
    expect(result.materials).toBe(45);
  });

  it('allows funding to go negative (deficit spending)', () => {
    const small: Resources = { funding: 1, materials: 1, politicalWill: 0 };
    const largeDecay = 100;
    const result = applyResourceDeltas(small, ZERO_RESOURCES, largeDecay, ZERO_RESOURCES);

    expect(result.funding).toBe(1 - 100); // -99: deficit allowed
    expect(result.materials).toBe(1); // unaffected by funding decay
  });

  it('clamps materials at 0 (cannot go negative)', () => {
    const small: Resources = { funding: 100, materials: 5, politicalWill: 0 };
    const upkeep: Resources = { funding: 0, materials: 50, politicalWill: 0 };
    const result = applyResourceDeltas(small, ZERO_RESOURCES, 0, upkeep);

    expect(result.materials).toBe(0);
  });

  it('combines all effects correctly', () => {
    const current: Resources = { funding: 100, materials: 40, politicalWill: 0 };
    const facilityDelta: Resources = { funding: 30, materials: 20, politicalWill: 5 };
    const upkeep: Resources = { funding: 10, materials: 5, politicalWill: 0 };
    const bankDecay = 2;

    const result = applyResourceDeltas(current, facilityDelta, bankDecay, upkeep);

    expect(result.funding).toBe(100 + 30 - 10 - 2); // 118
    expect(result.materials).toBe(40 + 20 - 5); // 55
    expect(result.politicalWill).toBe(5); // 0 + 5
  });
});
