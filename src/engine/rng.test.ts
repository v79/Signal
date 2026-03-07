import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('produces deterministic output from the same seed', () => {
    const rng1 = createRng('test-seed');
    const rng2 = createRng('test-seed');
    const results1 = Array.from({ length: 20 }, () => rng1.next());
    const results2 = Array.from({ length: 20 }, () => rng2.next());
    expect(results1).toEqual(results2);
  });

  it('produces different output from different seeds', () => {
    const rng1 = createRng('seed-alpha');
    const rng2 = createRng('seed-beta');
    const results1 = Array.from({ length: 20 }, () => rng1.next());
    const results2 = Array.from({ length: 20 }, () => rng2.next());
    expect(results1).not.toEqual(results2);
  });

  it('next() always returns values in [0, 1)', () => {
    const rng = createRng('bounds-test');
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt() returns values in [min, max] inclusive', () => {
    const rng = createRng('int-test');
    const min = 3;
    const max = 7;
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(min, max);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    // Every value in the range should appear with enough iterations
    for (let v = min; v <= max; v++) {
      expect(seen.has(v)).toBe(true);
    }
  });

  it('nextFloat() returns values in [min, max)', () => {
    const rng = createRng('float-test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat(2.5, 5.5);
      expect(v).toBeGreaterThanOrEqual(2.5);
      expect(v).toBeLessThan(5.5);
    }
  });

  it('pick() always returns an element from the array', () => {
    const rng = createRng('pick-test');
    const arr = ['physics', 'mathematics', 'engineering', 'biochemistry', 'computing', 'socialScience'] as const;
    for (let i = 0; i < 200; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('shuffle() preserves all elements', () => {
    const rng = createRng('shuffle-elements');
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle([...original]);
    expect(shuffled.sort((a, b) => a - b)).toEqual(original);
  });

  it('shuffle() is deterministic for the same seed', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80];
    const rng1 = createRng('shuffle-det');
    const rng2 = createRng('shuffle-det');
    expect(rng1.shuffle([...arr])).toEqual(rng2.shuffle([...arr]));
  });

  it('shuffle() is not a no-op (actually reorders)', () => {
    const rng = createRng('shuffle-reorder');
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle([...original]);
    // With 10 elements the chance of identity permutation is 1/10! ≈ 0
    expect(shuffled).not.toEqual(original);
  });

  it('sequential calls advance state (not repeating)', () => {
    const rng = createRng('sequential');
    const values = Array.from({ length: 10 }, () => rng.next());
    const unique = new Set(values);
    expect(unique.size).toBe(10);
  });
});
