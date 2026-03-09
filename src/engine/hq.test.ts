// =============================================================================
// HQ facility tests: placement, bonus, canDelete flag
// =============================================================================

import { describe, it, expect } from 'vitest';
import { computeHqBonus } from './facilities';
import { FACILITY_DEFS } from '../data/facilities';
import { generateEarthTilesForBloc } from '../lib/stores/game.svelte';

describe('HQ FacilityDef', () => {
  const hqDef = FACILITY_DEFS.get('hq');

  it('exists in FACILITY_DEFS', () => {
    expect(hqDef).toBeDefined();
  });

  it('has canDelete = false', () => {
    expect(hqDef?.canDelete).toBe(false);
  });

  it('has buildTime = 0 (instant placement)', () => {
    expect(hqDef?.buildTime).toBe(0);
  });

  it('has no build cost', () => {
    expect(hqDef?.buildCost).toEqual({});
  });

  it('has a negative funding upkeep (acts as income)', () => {
    expect(hqDef?.upkeepCost).toEqual({ funding: -5 });
  });

  it('is restricted to urban tiles', () => {
    expect(hqDef?.allowedTileTypes).toContain('urban');
  });
});

describe('computeHqBonus', () => {
  it('returns Funding and Will for both profiles', () => {
    const dem = computeHqBonus('democratic');
    expect(dem.resources.funding).toBeGreaterThan(0);
    expect(dem.resources.politicalWill).toBeGreaterThan(0);

    const auth = computeHqBonus('authoritarian');
    expect(auth.resources.funding).toBeGreaterThan(0);
    expect(auth.resources.politicalWill).toBeGreaterThan(0);
  });

  it('democratic bloc gets Computing and SocialScience fields', () => {
    const bonus = computeHqBonus('democratic');
    expect(bonus.fields.computing).toBeGreaterThan(0);
    expect(bonus.fields.socialScience).toBeGreaterThan(0);
  });

  it('authoritarian bloc gets Materials resources', () => {
    const bonus = computeHqBonus('authoritarian');
    expect(bonus.resources.materials).toBeGreaterThan(0);
  });

  it('authoritarian bloc does NOT get research fields', () => {
    const bonus = computeHqBonus('authoritarian');
    expect(bonus.fields.computing ?? 0).toBe(0);
    expect(bonus.fields.socialScience ?? 0).toBe(0);
  });
});

describe('generateEarthTilesForBloc', () => {
  it('places HQ tile at origin (0,0) as urban', () => {
    const tiles = generateEarthTilesForBloc('northAmerica');
    const origin = tiles.find(t => t.coord.q === 0 && t.coord.r === 0);
    expect(origin).toBeDefined();
    expect(origin?.type).toBe('urban');
  });

  it('generates tiles for all known blocs', () => {
    const knownBlocs = ['northAmerica', 'eastAsia', 'southAmerica', 'africaCoalition', 'eurozone', 'southAsia', 'middlewEast'];
    for (const blocId of knownBlocs) {
      const tiles = generateEarthTilesForBloc(blocId);
      expect(tiles.length, `${blocId} should have tiles`).toBeGreaterThan(0);
    }
  });

  it('all tiles have pendingActionId = null initially', () => {
    const tiles = generateEarthTilesForBloc('eurozone');
    for (const tile of tiles) {
      expect(tile.pendingActionId).toBeNull();
    }
  });

  it('returns a fallback for an unknown bloc ID', () => {
    const tiles = generateEarthTilesForBloc('__unknown__');
    expect(tiles.length).toBe(1);
    expect(tiles[0].type).toBe('urban');
  });
});
