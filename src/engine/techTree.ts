// =============================================================================
// SIGNAL — Tech Tree Helpers
// Pure functions for computing tech tree layout properties.
// No Svelte or Phaser dependencies — fully testable.
// =============================================================================

import type { TechDef } from './types';

/**
 * Return the display tier for a technology.
 * Tier is now authoritative on TechDef itself (set in technologies.ts).
 */
export function getTechTier(def: TechDef): number {
  return def.tier;
}
