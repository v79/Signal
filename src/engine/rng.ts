import type { Seed } from './types';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
//
// All randomness in the game (tech recipe generation, climate degradation
// scheduling, bloc simulation, event selection, card draw order) must flow
// through a Rng instance created from the run seed. This ensures that any
// two games with the same seed produce identical results.
//
// IMPORTANT: PRNG calls must happen in a fixed, documented order within each
// turn phase (defined in turn.ts). Inserting or removing calls changes the
// sequence for all subsequent calls, breaking seed reproducibility.
// ---------------------------------------------------------------------------

/** Hash a string seed to a 32-bit unsigned integer (djb2 variant). */
function hashSeed(seed: Seed): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** Core mulberry32 generator. Returns floats in [0, 1). */
function mulberry32(initialSeed: number): () => number {
  let s = initialSeed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number;
  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number;
  /** Returns a random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Shuffles an array in place using Fisher-Yates and returns it. */
  shuffle<T>(arr: T[]): T[];
}

export function createRng(seed: Seed): Rng {
  const next = mulberry32(hashSeed(seed));

  return {
    next,

    nextInt(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },

    nextFloat(min, max) {
      return next() * (max - min) + min;
    },

    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },

    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
