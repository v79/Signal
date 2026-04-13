import type {
  SignalState,
  SignalEraStrength,
  SignalResponseOption,
  FieldPoints,
  FacilityInstance,
  FacilityDef,
  Era,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Signal Track
//
// The signal is always ticking: it grows stronger as the player invests in
// Physics, Mathematics, and Deep Space Array facilities. Three eras of
// strength map to the three in-game eras (faint → structured → urgent).
//
// At 100% decode progress the wormhole climax triggers. The player chooses
// a response from 2–3 candidates; the correct answer is determined at
// generation time (seeded). How many options and how useful the confidence
// hints are depends on how much the player invested in signal analysis.
//
// The signal never goes backwards — decodeProgress is monotonically
// increasing and locked once responseCommitted is true.
// ---------------------------------------------------------------------------

/** Facility def IDs that qualify as earth-era signal array infrastructure. */
export const EARTH_SIGNAL_ARRAY_DEF_IDS: ReadonlySet<string> = new Set([
  'deepSpaceArray',
  'deepSpaceArrayMk2',
]);

/**
 * Facility def IDs whose presence re-enables signal ticking in nearSpace.
 * Signal ticking is paused when the player is in nearSpace (or later) and has
 * none of these facilities built.
 */
export const NEAR_SPACE_RELAY_DEF_IDS: ReadonlySet<string> = new Set([
  'signalRelayStation',
]);

/**
 * Tech IDs that gate signal decode progress caps.
 * Each gate tech, when discovered, lifts the progress ceiling to the next level.
 */
export const SIGNAL_CAPS = {
  era1Gate: 'signalPatternAnalysis',
  era2Gate: 'interstellarSignalDecryption',
} as const;

/**
 * Compute the maximum allowed decode progress given the set of discovered tech IDs.
 * - Neither gate discovered → 33%
 * - Era 1 gate only         → 66%
 * - Both gates discovered   → 100% (no cap)
 */
export function computeSignalCap(discoveredTechIds: ReadonlySet<string>): number {
  if (!discoveredTechIds.has(SIGNAL_CAPS.era1Gate)) return 33;
  if (!discoveredTechIds.has(SIGNAL_CAPS.era2Gate)) return 66;
  return 100;
}

/**
 * Returns true when signal ticking should produce zero progress this turn.
 * In nearSpace (and beyond), signal ticking is paused until the player has
 * built at least one NEAR_SPACE_RELAY_DEF_IDS facility.
 */
export function isSignalPaused(
  era: Era,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
): boolean {
  if (era === 'earth') return false;
  return !facilities.some((f) => {
    const def = facilityDefs.get(f.defId);
    return def !== undefined && NEAR_SPACE_RELAY_DEF_IDS.has(def.id);
  });
}

// ---------------------------------------------------------------------------
// Progress computation
// ---------------------------------------------------------------------------

/**
 * Per-turn contribution constants.
 *
 * fieldContribution = (physics + mathematics) / FIELD_DIVISOR
 *   → 100 pts in each field = 4 progress/turn
 *
 * Each active Deep Space Array facility adds ARRAY_BONUS progress/turn.
 * BASE_PROGRESS ensures the signal always advances, even without investment.
 */
const BASE_PROGRESS = 0.05;
const FIELD_DIVISOR = 50;
const ARRAY_BONUS = 3;

/** Thresholds (decodeProgress) at which era strength upgrades. */
const STRENGTH_THRESHOLD: Record<SignalEraStrength, number> = {
  faint: 0,
  structured: 30,
  urgent: 70,
};

/**
 * Compute the raw decode progress delta for one World Phase tick.
 * Returns a positive number (progress never decreases).
 */
export function computeSignalProgressDelta(
  fields: FieldPoints,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
): number {
  const arrayCount = facilities.filter((f) => {
    const def = facilityDefs.get(f.defId);
    return def !== undefined && EARTH_SIGNAL_ARRAY_DEF_IDS.has(def.id);
  }).length;

  const fieldContribution = (fields.physics + fields.mathematics) / FIELD_DIVISOR;
  return BASE_PROGRESS + fieldContribution + arrayCount * ARRAY_BONUS;
}

/**
 * Determine era strength from decode progress alone.
 * Era (earth/nearSpace/deepSpace) is not used directly — progress is the
 * only driver, letting fast investment unlock 'urgent' early.
 */
export function computeEraStrength(progress: number): SignalEraStrength {
  if (progress >= STRENGTH_THRESHOLD.urgent) return 'urgent';
  if (progress >= STRENGTH_THRESHOLD.structured) return 'structured';
  return 'faint';
}

/**
 * Advance signal state by one World Phase tick.
 * No-op if the player has already committed a response.
 * No-op if the signal is paused (nearSpace+ with no relay facility).
 * Progress is clamped to `cap` (derived from tech gate discoveries).
 */
export function tickSignalProgress(
  signal: SignalState,
  fields: FieldPoints,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  era: Era,
  cap: number,
): SignalState {
  if (signal.responseCommitted) return signal;
  if (isSignalPaused(era, facilities, facilityDefs)) return signal;

  const delta = computeSignalProgressDelta(fields, facilities, facilityDefs);
  const newProgress = Math.min(cap, signal.decodeProgress + delta);
  const newStrength = computeEraStrength(newProgress);

  return {
    ...signal,
    decodeProgress: newProgress,
    eraStrength: newStrength,
  };
}

// ---------------------------------------------------------------------------
// Wormhole climax
// ---------------------------------------------------------------------------

/** True when the signal has been fully decoded and awaits a player response. */
export function isSignalClimax(signal: SignalState): boolean {
  return signal.decodeProgress >= 100 && !signal.responseCommitted;
}

/**
 * Generate 2–3 wormhole response options (seeded via rng).
 *
 * Option count:  2 if progress < 70, 3 if progress >= 70
 * Confidence hint on the correct option:
 *   'high'   if progress >= 90
 *   'medium' if progress >= 70
 *   'low'    otherwise
 * Incorrect options receive 'low' or null randomly (50/50).
 *
 * Exactly one option is correct; its index is chosen with rng so the
 * position varies between seeds and reruns.
 */
export function generateWormholeOptions(signal: SignalState, rng: Rng): SignalResponseOption[] {
  const count = signal.decodeProgress >= 70 ? 3 : 2;

  const correctHint: SignalResponseOption['confidenceHint'] =
    signal.decodeProgress >= 90 ? 'high' : signal.decodeProgress >= 70 ? 'medium' : 'low';

  // Seeded correct-answer position
  const correctIndex = Math.floor(rng.next() * count);

  const LABELS = [
    'Transmit acknowledgement on matched frequency',
    'Activate the resonance pathway and hold',
    'Broadcast compressed cultural archive',
  ];

  return Array.from({ length: count }, (_, i) => {
    const isCorrect = i === correctIndex;
    return {
      id: `wormhole-opt-${i}`,
      label: LABELS[i],
      confidenceHint: isCorrect ? correctHint : rng.next() > 0.5 ? 'low' : null,
      correct: isCorrect,
    };
  });
}

/**
 * Commit the player's chosen response.
 * Sets responseCommitted = true; wormholeActivated = true iff the chosen
 * option is correct.
 */
export function commitSignalResponse(
  signal: SignalState,
  optionId: string,
  options: SignalResponseOption[],
): SignalState {
  const chosen = options.find((o) => o.id === optionId);
  if (!chosen) return signal;

  return {
    ...signal,
    responseCommitted: true,
    responseCorrect: chosen.correct,
    wormholeActivated: chosen.correct,
  };
}

// ---------------------------------------------------------------------------
// Signal event generation
// ---------------------------------------------------------------------------

/**
 * Era-appropriate flavour text for a signal progress news item.
 * Used by the World Phase to generate periodic news feed entries.
 */
export function signalProgressNewsText(progress: number, turn: number): string {
  if (progress >= 90) {
    return 'Signal analysis complete. The transmission structure is now fully mapped. A response window is open.';
  }
  if (progress >= 70) {
    return `The signal has become urgent. Analysts report unmistakable intentional structure. Decode at ${Math.round(progress)}%.`;
  }
  if (progress >= 30) {
    return `Signal decoding continues. Pattern recognition algorithms confirm non-random origin. Decode at ${Math.round(progress)}%.`;
  }
  return `Anomalous transmission detected from outer solar system (turn ${turn}). Initial analysis underway.`;
}

/**
 * Returns true if the signal progress crossed a threshold newsworthy boundary
 * this tick (i.e. previous progress was below threshold, new is at or above).
 */
export function didCrossStrengthThreshold(previous: number, current: number): boolean {
  return (
    (previous < STRENGTH_THRESHOLD.structured && current >= STRENGTH_THRESHOLD.structured) ||
    (previous < STRENGTH_THRESHOLD.urgent && current >= STRENGTH_THRESHOLD.urgent)
  );
}
