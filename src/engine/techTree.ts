// =============================================================================
// SIGNAL — Tech Tree Helpers
// Pure functions for computing tech tree layout properties.
// No Svelte or Phaser dependencies — fully testable.
// =============================================================================

import type { TechDef } from './types';

/**
 * Compute the display tier for a technology based on the sum of its
 * base recipe field values. Tiers determine column placement in the
 * tech tree visualisation.
 *
 * Thresholds calibrated against Era 1 recipes to produce a 3/4/2/3
 * distribution across the four columns:
 *
 * | Tier | Sum ≤   | Era 1 examples                                    |
 * |------|---------|---------------------------------------------------|
 * | 1    | 100     | Integrated Circuits, Satellite Comms, Microproc.  |
 * | 2    | 165     | Rocket Guidance, Personal Computing, Robotics...  |
 * | 3    | 255     | Global Positioning Network, Internet Protocols    |
 * | 4    | ∞       | Digitised Telemetry, Orbital Mechanics, Signal... |
 */
export function getTechTier(def: TechDef): 1 | 2 | 3 | 4 {
  const sum = Object.values(def.baseRecipe).reduce((acc, v) => acc + (v ?? 0), 0);
  if (sum <= 100) return 1;
  if (sum <= 165) return 2;
  if (sum <= 255) return 3;
  return 4;
}
