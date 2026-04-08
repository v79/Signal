import type { GameState, GameOutcome, VictoryCondition, LossCondition } from './types';

// ---------------------------------------------------------------------------
// Victory & Loss condition checking
//
// checkVictoryConditions() is called at the end of every World Phase.
// Loss conditions are evaluated before victories: a turn that triggers
// both a loss and a victory resolves as a loss.
//
// The Abandoned Earth moral outcome is appended to any victory if the
// earthWelfareScore has fallen below the threshold — the player "won"
// but at a cost.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** earthWelfareScore below this at any victory triggers the AbandonedEarth outcome. */
const ABANDONED_EARTH_THRESHOLD = 40;

const ECO_WELFARE_MIN = 88;
const ECO_CLIMATE_MAX = 25;
const ECON_FUNDING_MIN = 500;
const ECON_MATERIAL_MIN = 300;
const POLITICAL_WILL_MIN = 5; // will AND politicalWill must both be ≤ this

// ---------------------------------------------------------------------------
// Individual victory checks
// ---------------------------------------------------------------------------

export function checkWormholeVictory(state: GameState): boolean {
  return state.signal.wormholeActivated;
}

/**
 * Ecological Restoration: Earth is healthy enough to be called a success.
 * Requires high Earth welfare AND low climate pressure.
 */
export function checkEcologicalRestorationVictory(state: GameState): boolean {
  return state.earthWelfareScore >= ECO_WELFARE_MIN && state.climatePressure <= ECO_CLIMATE_MAX;
}

/**
 * Economic Hegemony: the programme dominates global resource flows.
 */
export function checkEconomicHegemonyVictory(state: GameState): boolean {
  return (
    state.player.resources.funding >= ECON_FUNDING_MIN &&
    state.player.resources.materials >= ECON_MATERIAL_MIN
  );
}

/**
 * Terraforming: a self-sustaining lunar colony has been established.
 * Requires the Lunar Colony Hub (top of the habitation chain) to be
 * operational on the lunar surface. A mine or basic habitat is not enough.
 * TODO: gate on Moon Colony Stage 3 landmark completion once Phase 30 is implemented.
 */
export function checkTerraformingVictory(state: GameState): boolean {
  if (state.era === 'earth') return false;
  const lunarNode = state.map.spaceNodes.find((n) => n.id === 'lunarSurface');
  return lunarNode?.facilityId === 'lunarColonyHub';
}

// ---------------------------------------------------------------------------
// Individual loss checks
// ---------------------------------------------------------------------------

export function checkClimateCollapseLoss(state: GameState): boolean {
  return state.climatePressure >= 100;
}

/**
 * Signal Misinterpretation: the player committed a response to the wormhole
 * signal and chose incorrectly.
 */
export function checkSignalMisinterpretationLoss(state: GameState): boolean {
  return state.signal.responseCommitted && state.signal.responseCorrect === false;
}

/**
 * Political Collapse: Will has bottomed out and political capital is gone.
 */
export function checkPoliticalCollapseLoss(state: GameState): boolean {
  return state.player.will <= POLITICAL_WILL_MIN && state.player.resources.politicalWill <= 0;
}

/**
 * Resource Exhaustion: all three resource pools have reached zero simultaneously.
 */
export function checkResourceExhaustionLoss(state: GameState): boolean {
  return (
    state.player.resources.funding <= 0 &&
    state.player.resources.materials <= 0 &&
    state.player.resources.politicalWill <= 0
  );
}

// ---------------------------------------------------------------------------
// Moral outcome
// ---------------------------------------------------------------------------

export function computeMoralOutcome(state: GameState): 'abandonedEarth' | null {
  return state.earthWelfareScore < ABANDONED_EARTH_THRESHOLD ? 'abandonedEarth' : null;
}

// ---------------------------------------------------------------------------
// Earth welfare tick
// ---------------------------------------------------------------------------

/**
 * Update earthWelfareScore once per World Phase.
 *
 * - Climate pressure causes decay (faster as pressure rises).
 * - Earth-based facilities provide a small recovery incentive.
 *
 * Range is clamped to [0, 100].
 */
export function tickEarthWelfare(state: GameState): number {
  const { climatePressure, earthWelfareScore, player, map } = state;

  const climateDecay = (climatePressure / 100) * 0.8;

  const earthFacilityCount = player.facilities.filter((f) =>
    map.earthTiles.some((t) => `${t.coord.q},${t.coord.r}` === f.locationKey),
  ).length;
  const facilityRecovery = Math.min(0.4, earthFacilityCount * 0.05);

  return Math.max(0, Math.min(100, earthWelfareScore + facilityRecovery - climateDecay));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Check all victory and loss conditions after the World Phase.
 * Returns a GameOutcome if any condition is triggered, null otherwise.
 *
 * Priority order (first match wins):
 *   1. Loss conditions (climateCollapse, signalMisinterpretation, politicalCollapse, resourceExhaustion)
 *   2. Victory conditions (wormhole, ecologicalRestoration, economicHegemony, terraforming)
 */
export function checkVictoryConditions(state: GameState): GameOutcome | null {
  const lossConds: [() => boolean, LossCondition][] = [
    [() => checkClimateCollapseLoss(state), 'climateCollapse'],
    [() => checkSignalMisinterpretationLoss(state), 'signalMisinterpretation'],
    [() => checkPoliticalCollapseLoss(state), 'politicalCollapse'],
    [() => checkResourceExhaustionLoss(state), 'resourceExhaustion'],
  ];

  for (const [check, condition] of lossConds) {
    if (check()) {
      return { type: 'loss', condition, turn: state.turn, moralOutcome: null };
    }
  }

  const victConds: [() => boolean, VictoryCondition][] = [
    [() => checkWormholeVictory(state), 'wormhole'],
    [() => checkEcologicalRestorationVictory(state), 'ecologicalRestoration'],
    [() => checkEconomicHegemonyVictory(state), 'economicHegemony'],
    [() => checkTerraformingVictory(state), 'terraforming'],
  ];

  for (const [check, condition] of victConds) {
    if (check()) {
      return {
        type: 'victory',
        condition,
        turn: state.turn,
        moralOutcome: computeMoralOutcome(state),
      };
    }
  }

  return null;
}
