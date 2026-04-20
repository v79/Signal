import { describe, it, expect } from 'vitest';
import { applyClimateDegradation } from './climate';
import { createRng } from './rng';
import type { FacilityDef, FacilityInstance, MapTile, TileType } from './types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTile(
  q: number,
  r: number,
  type: TileType,
  opts: Partial<MapTile> = {},
): MapTile {
  return {
    coord: { q, r },
    type,
    destroyedStatus: null,
    productivity: 1,
    mineDepletion: 0,
    facilitySlots: [null, null, null],
    pendingActionId: null,
    ...opts,
  };
}

function makeDef(id: string, overrides: Partial<FacilityDef> = {}): FacilityDef {
  return {
    id,
    name: id,
    description: '',
    era: 'earth',
    allowedTileTypes: [],
    buildCost: {},
    upkeepCost: {},
    buildTime: 0,
    deleteTime: 0,
    canDelete: true,
    fieldOutput: {},
    resourceOutput: {},
    adjacencyBonuses: [],
    adjacencyPenalties: [],
    depletes: false,
    requiredTechId: null,
    ...overrides,
  };
}

function makeFacility(id: string, defId: string, locationKey: string): FacilityInstance {
  return { id, defId, locationKey, condition: 1, builtTurn: 1 };
}

const defs = new Map<string, FacilityDef>([
  ['lab', makeDef('lab')],
  ['hq', makeDef('hq', { climateImmune: true })],
  ['slc', makeDef('slc', { climateImmune: true })],
]);

// ---------------------------------------------------------------------------
// No-op cases
// ---------------------------------------------------------------------------

describe('applyClimateDegradation — no rules apply', () => {
  it('returns unchanged when climate pressure is below all thresholds', () => {
    const tiles = [makeTile(0, 0, 'forested'), makeTile(1, 0, 'agricultural')];
    const result = applyClimateDegradation(tiles, 50, [], defs, createRng('s'));

    expect(result.changed).toBe(false);
    expect(result.tiles).toBe(tiles);
    expect(result.facilities).toEqual([]);
    expect(result.newsText).toBe('');
  });

  it('returns unchanged when all probability rolls miss', () => {
    // Pressure > 55 gives forested/dustbowl at 3% probability.
    // Seed 'miss' happens to roll > 0.03 on first call — verified empirically below.
    const tiles = [makeTile(0, 0, 'forested')];
    // Find a seed whose first roll exceeds 0.03.
    const rng = createRng('climate-miss-seed');
    expect(rng.next()).toBeGreaterThan(0.03);

    const result = applyClimateDegradation(tiles, 60, [], defs, createRng('climate-miss-seed'));
    expect(result.changed).toBe(false);
  });

  it('returns unchanged when no tiles match the rule type', () => {
    // Pressure > 85: rules target forested, agricultural, coastal, highland.
    // Provide only urban tiles — every rule that fires finds no candidates.
    const tiles = [makeTile(0, 0, 'urban'), makeTile(1, 0, 'industrial')];
    const result = applyClimateDegradation(tiles, 90, [], defs, createRng('any'));
    expect(result.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pressure-threshold gating
// ---------------------------------------------------------------------------

describe('applyClimateDegradation — threshold gating', () => {
  it('does not flood coastal tiles below the > 85 pressure threshold', () => {
    const tiles = Array.from({ length: 50 }, (_, i) => makeTile(i, 0, 'coastal'));
    // At pressure 85 (not > 85), coastal flooding rule should not appear.
    const result = applyClimateDegradation(tiles, 85, [], defs, createRng('s1'));
    expect(result.tiles.every((t) => t.destroyedStatus !== 'flooded')).toBe(true);
  });

  it('does not degrade agricultural tiles below the > 70 threshold', () => {
    const tiles = Array.from({ length: 50 }, (_, i) => makeTile(i, 0, 'agricultural'));
    const result = applyClimateDegradation(tiles, 70, [], defs, createRng('s2'));
    expect(result.tiles.every((t) => t.destroyedStatus === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Degradation behaviour (seeded — find a seed that reliably triggers)
// ---------------------------------------------------------------------------

/**
 * Find a seed that causes the first rule to fire (roll < probability).
 * Used to write reliable deterministic tests.
 */
function findTriggeringSeed(probability: number, prefix = 'trigger'): string {
  for (let i = 0; i < 1000; i++) {
    const seed = `${prefix}-${i}`;
    if (createRng(seed).next() < probability) return seed;
  }
  throw new Error('no triggering seed found');
}

describe('applyClimateDegradation — successful degradation', () => {
  it('marks a forested tile as dustbowl when the drought rule fires', () => {
    const seed = findTriggeringSeed(0.03, 'forest');
    const tiles = [makeTile(0, 0, 'forested')];
    const result = applyClimateDegradation(tiles, 60, [], defs, createRng(seed));

    expect(result.changed).toBe(true);
    expect(result.tiles[0].destroyedStatus).toBe('dustbowl');
    expect(result.tiles[0].facilitySlots).toEqual([null, null, null]);
    expect(result.newsText).toContain('forested');
    expect(result.newsText).toContain('drought');
  });

  it('clears pendingActionId when a tile is destroyed', () => {
    const seed = findTriggeringSeed(0.03, 'pending');
    const tiles = [makeTile(0, 0, 'forested', { pendingActionId: 'action-1' })];
    const result = applyClimateDegradation(tiles, 60, [], defs, createRng(seed));
    expect(result.tiles[0].pendingActionId).toBeNull();
  });

  it('removes facilities on the destroyed tile', () => {
    const seed = findTriggeringSeed(0.03, 'remove');
    const tiles = [
      makeTile(0, 0, 'forested', { facilitySlots: ['lab-1', null, null] }),
      makeTile(1, 0, 'urban', { facilitySlots: ['lab-2', null, null] }),
    ];
    const facilities = [
      makeFacility('lab-1', 'lab', '0,0'),
      makeFacility('lab-2', 'lab', '1,0'),
    ];

    const result = applyClimateDegradation(tiles, 60, facilities, defs, createRng(seed));

    expect(result.changed).toBe(true);
    expect(result.facilities.map((f) => f.id)).toEqual(['lab-2']);
  });

  it('does not mutate the input tiles or facilities arrays', () => {
    const seed = findTriggeringSeed(0.03, 'immut');
    const tiles = [makeTile(0, 0, 'forested', { facilitySlots: ['lab-1', null, null] })];
    const facilities = [makeFacility('lab-1', 'lab', '0,0')];
    const tilesCopy = structuredClone(tiles);
    const facsCopy = structuredClone(facilities);

    applyClimateDegradation(tiles, 60, facilities, defs, createRng(seed));

    expect(tiles).toEqual(tilesCopy);
    expect(facilities).toEqual(facsCopy);
  });

  it('is deterministic for a given seed', () => {
    const seed = findTriggeringSeed(0.03, 'det');
    const tiles = Array.from({ length: 5 }, (_, i) => makeTile(i, 0, 'forested'));

    const a = applyClimateDegradation(tiles, 60, [], defs, createRng(seed));
    const b = applyClimateDegradation(tiles, 60, [], defs, createRng(seed));

    expect(a.tiles.map((t) => t.destroyedStatus)).toEqual(b.tiles.map((t) => t.destroyedStatus));
    expect(a.newsText).toEqual(b.newsText);
  });
});

// ---------------------------------------------------------------------------
// Protection: sea walls and climate-immune facilities
// ---------------------------------------------------------------------------

describe('applyClimateDegradation — sea wall protection', () => {
  it('excludes sea-wall-protected coastal tiles from flooding', () => {
    // Pressure > 85 activates coastal/flooded. Provide only protected coastal tiles.
    const tiles = Array.from({ length: 30 }, (_, i) =>
      makeTile(i, 0, 'coastal', { seaWallProtected: true }),
    );

    // Try many seeds; none should ever flood a protected tile.
    for (let i = 0; i < 20; i++) {
      const result = applyClimateDegradation(tiles, 90, [], defs, createRng(`sw-${i}`));
      expect(result.tiles.every((t) => t.destroyedStatus !== 'flooded')).toBe(true);
    }
  });

  it('still floods unprotected coastal tiles when some are protected', () => {
    const tiles = [
      makeTile(0, 0, 'coastal', { seaWallProtected: true }),
      ...Array.from({ length: 30 }, (_, i) => makeTile(i + 1, 0, 'coastal')),
    ];

    // Find a seed that fires the coastal rule. Coastal is 3rd rule at pressure > 85:
    // rules run in order forested(0.03), forested(0.06), agricultural(0.03), coastal(0.04),
    // agricultural(0.06), highland(0.02). We need the 4th rng.next() < 0.04.
    // With no forested/agricultural/highland candidates, earlier rules still consume RNG.
    let flooded = false;
    for (let i = 0; i < 200 && !flooded; i++) {
      const result = applyClimateDegradation(tiles, 90, [], defs, createRng(`swflood-${i}`));
      if (result.tiles.some((t) => t.destroyedStatus === 'flooded')) {
        flooded = true;
        // Verify the protected tile was never the one flooded.
        expect(result.tiles[0].destroyedStatus).toBeNull();
      }
    }
    expect(flooded).toBe(true);
  });

  it('sea wall does not protect against dustbowl on other tile types', () => {
    // A sea wall flag on a forested tile (nonsensical but harmless) shouldn't block drought.
    const seed = findTriggeringSeed(0.03, 'swdust');
    const tiles = [makeTile(0, 0, 'forested', { seaWallProtected: true })];
    const result = applyClimateDegradation(tiles, 60, [], defs, createRng(seed));
    expect(result.tiles[0].destroyedStatus).toBe('dustbowl');
  });
});

describe('applyClimateDegradation — climate-immune facilities', () => {
  it('excludes tiles hosting a climate-immune facility (HQ)', () => {
    const tiles = Array.from({ length: 30 }, (_, i) =>
      makeTile(i, 0, 'forested', { facilitySlots: ['hq-1', null, null] }),
    );
    const facilities = tiles.map((t, i) => makeFacility('hq-1', 'hq', `${i},0`));

    // Try many seeds; no tile should ever degrade.
    for (let i = 0; i < 20; i++) {
      const result = applyClimateDegradation(tiles, 60, facilities, defs, createRng(`imm-${i}`));
      expect(result.tiles.every((t) => t.destroyedStatus === null)).toBe(true);
    }
  });

  it('climate-immune facility in any slot protects the tile', () => {
    const tiles = Array.from({ length: 30 }, (_, i) =>
      makeTile(i, 0, 'agricultural', { facilitySlots: [null, 'slc-1', null] }),
    );
    const facilities = [makeFacility('slc-1', 'slc', '0,0')];

    for (let i = 0; i < 20; i++) {
      const result = applyClimateDegradation(tiles, 90, facilities, defs, createRng(`slc-${i}`));
      expect(result.tiles.every((t) => t.destroyedStatus === null)).toBe(true);
    }
  });

  it('does not remove non-immune facilities on a non-degraded tile', () => {
    const tiles = [
      makeTile(0, 0, 'forested', { facilitySlots: ['lab-1', null, null] }),
      makeTile(1, 0, 'forested'),
    ];
    const facilities = [makeFacility('lab-1', 'lab', '0,0')];
    // With no trigger, nothing should change.
    const result = applyClimateDegradation(tiles, 50, facilities, defs, createRng('nochange'));
    expect(result.changed).toBe(false);
    expect(result.facilities).toEqual(facilities);
  });
});

// ---------------------------------------------------------------------------
// News text aggregation
// ---------------------------------------------------------------------------

describe('applyClimateDegradation — news text', () => {
  it('joins multiple degradations into one news string', () => {
    // Pressure > 85 provides 6 rules; pick a seed that fires at least 2.
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const tiles = [
        makeTile(0, 0, 'forested'),
        makeTile(1, 0, 'agricultural'),
        makeTile(2, 0, 'coastal'),
        makeTile(3, 0, 'highland'),
      ];
      const result = applyClimateDegradation(tiles, 90, [], defs, createRng(`multi-${i}`));
      const destroyedCount = result.tiles.filter((t) => t.destroyedStatus !== null).length;
      if (destroyedCount >= 2) {
        expect(result.newsText.split('.').filter((s) => s.trim().length > 0).length).toBe(
          destroyedCount,
        );
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
