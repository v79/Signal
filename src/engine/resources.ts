import type { FieldPoints, Resources, WillProfile, CardInstance } from './types';

// ---------------------------------------------------------------------------
// Will volatility model
//
// Democratic blocs: high ceiling, volatile — larger natural drift, quick to
// recover and quick to fall. Equilibrium at 55.
//
// Authoritarian blocs: lower ceiling, stable — smaller natural drift,
// resistant to gradual change but prone to catastrophic collapse if the
// collapse threshold is breached. Equilibrium at 60.
//
// The willCeiling and willCollapseThreshold values ultimately come from
// BlocDef (wired in during Phase 7). For now, willProfile drives defaults.
// ---------------------------------------------------------------------------

export interface WillConfig {
  willProfile: WillProfile;
  /** Maximum achievable Will for this bloc (0–100). */
  willCeiling: number;
  /** Authoritarian-only: Will collapse risk below this value. */
  willCollapseThreshold: number;
}

export const DEFAULT_WILL_CONFIG: Record<WillProfile, WillConfig> = {
  democratic: {
    willProfile: 'democratic',
    willCeiling: 95,
    willCollapseThreshold: 0,
  },
  authoritarian: {
    willProfile: 'authoritarian',
    willCeiling: 75,
    willCollapseThreshold: 15,
  },
};

const WILL_EQUILIBRIUM: Record<WillProfile, number> = {
  democratic: 55,
  authoritarian: 60,
};

/** Points of natural drift toward equilibrium per turn. */
const WILL_DRIFT_RATE: Record<WillProfile, number> = {
  democratic: 1.5,
  authoritarian: 0.4, // more stable — resists gradual change
};

/**
 * Apply one turn of natural Will drift toward the bloc's equilibrium.
 * Will is clamped to [0, willCeiling].
 */
export function tickWill(will: number, config: WillConfig): number {
  const equilibrium = WILL_EQUILIBRIUM[config.willProfile];
  const rate = WILL_DRIFT_RATE[config.willProfile];
  const delta = will < equilibrium ? rate : -rate;
  return Math.max(0, Math.min(config.willCeiling, will + delta));
}

// ---------------------------------------------------------------------------
// Bank decay
// ---------------------------------------------------------------------------

/**
 * Cost in Political Will of holding cards in the bank for one turn.
 * 10 Will per banked card.
 */
export function computeBankDecay(cards: CardInstance[]): number {
  return cards.filter((c) => c.zone === 'bank').length * 10;
}

// ---------------------------------------------------------------------------
// Field and resource application
// ---------------------------------------------------------------------------

/**
 * Apply field deltas to current field totals.
 * Fields are clamped at 0 — they never go negative.
 */
export function applyFieldDeltas(current: FieldPoints, delta: FieldPoints): FieldPoints {
  const result = { ...current };
  for (const k of Object.keys(delta) as (keyof FieldPoints)[]) {
    result[k] = Math.max(0, result[k] + delta[k]);
  }
  return result;
}

/**
 * Apply all resource changes for one World Phase tick:
 *   + facilityDelta (net output from all facilities, already includes upkeep)
 *   - bankDecay (Will cost of banked cards — 1 Will per card per turn)
 *   - projectUpkeep (running cost of active projects)
 *
 * Funding can go negative (running a deficit is allowed; bankruptcy is a loss condition).
 * Materials and PoliticalWill are clamped at 0.
 * PoliticalWill is managed separately via tickWill — this function handles
 * only resource-denominated Will effects (e.g. from facilities or bank decay).
 */
export function applyResourceDeltas(
  current: Resources,
  facilityDelta: Resources,
  bankDecay: number,
  projectUpkeep: Resources,
): Resources {
  return {
    // Funding can go negative (running a deficit is possible; bankruptcy is a loss condition).
    funding: current.funding + facilityDelta.funding - projectUpkeep.funding,
    materials: Math.max(0, current.materials + facilityDelta.materials - projectUpkeep.materials),
    // Bank decay costs 1 Will per banked card per turn; makes banking a Will trade-off.
    politicalWill: Math.max(
      0,
      current.politicalWill + facilityDelta.politicalWill - bankDecay - projectUpkeep.politicalWill,
    ),
  };
}
