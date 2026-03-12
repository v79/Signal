// =============================================================================
// SIGNAL — Canonical science field colour palette
// Single source of truth for field colours, abbreviations, and labels.
// Used by Svelte components (CSS strings) and TechTreeScene (Phaser numerics).
// Record<string, ...> is intentional — these are runtime lookup tables keyed
// by field name strings from Object.entries() and similar iteration patterns.
// =============================================================================

/** CSS hex colour strings — for use in Svelte components and inline styles. */
export const FIELD_COLOURS_CSS: Record<string, string> = {
  physics: '#6a9fd8',
  mathematics: '#8a70c8',
  engineering: '#c87840',
  biochemistry: '#58a870',
  computing: '#60b8a0',
  socialScience: '#c86080',
};

/** Phaser numeric colours — for use in TechTreeScene and other Phaser contexts. */
export const FIELD_COLOURS_PHASER: Record<string, number> = {
  physics: 0x6a9fd8,
  mathematics: 0x8a70c8,
  engineering: 0xc87840,
  biochemistry: 0x58a870,
  computing: 0x60b8a0,
  socialScience: 0xc86080,
};

/** Short abbreviations for compact UI contexts (HUD, tooltips, tech tree bars). */
export const FIELD_ABBR: Record<string, string> = {
  physics: 'PHY',
  mathematics: 'MATH',
  engineering: 'ENG',
  biochemistry: 'BIO',
  computing: 'COMP',
  socialScience: 'SOC',
};

/** Full display names. */
export const FIELD_LABELS: Record<string, string> = {
  physics: 'Physics',
  mathematics: 'Mathematics',
  engineering: 'Engineering',
  biochemistry: 'Biochemistry',
  computing: 'Computing',
  socialScience: 'Social Science',
};
