import { describe, it, expect } from 'vitest';
import { placeStarterFacilities, getStarterFacilityDefIds } from './starterFacilities';
import { BLOC_DEFS, BLOC_MAPS, FACILITY_DEFS } from '../data/loader';
import type { MapTile } from './types';

function tilesForBloc(blocId: string): MapTile[] {
  const layout = BLOC_MAPS[blocId];
  return layout.map((entry) => ({
    coord: { q: entry.q, r: entry.r },
    type: entry.type,
    destroyedStatus: null,
    productivity: 1.0,
    mineDepletion: 1.0,
    facilitySlots: [null, null, null] as [null, null, null],
    pendingActionId: null,
  }));
}

describe('placeStarterFacilities', () => {
  it('places three facilities for every bloc', () => {
    for (const blocId of BLOC_DEFS.keys()) {
      const tiles = tilesForBloc(blocId);
      const result = placeStarterFacilities(blocId, tiles, FACILITY_DEFS);
      expect(result.facilities, `bloc ${blocId}`).toHaveLength(3);
    }
  });

  it('places each facility on a tile whose type is in its allowedTileTypes', () => {
    for (const blocId of BLOC_DEFS.keys()) {
      const tiles = tilesForBloc(blocId);
      const result = placeStarterFacilities(blocId, tiles, FACILITY_DEFS);
      for (const facility of result.facilities) {
        const def = FACILITY_DEFS.get(facility.defId)!;
        const tile = result.tiles.find(
          (t) => `${t.coord.q},${t.coord.r}` === facility.locationKey,
        );
        expect(tile, `tile for ${facility.id}`).toBeDefined();
        expect(def.allowedTileTypes).toContain(tile!.type);
      }
    }
  });

  it('writes facility ids into the chosen tiles\' slots', () => {
    const blocId = 'northAmerica';
    const tiles = tilesForBloc(blocId);
    const result = placeStarterFacilities(blocId, tiles, FACILITY_DEFS);
    for (const facility of result.facilities) {
      const tile = result.tiles.find(
        (t) => `${t.coord.q},${t.coord.r}` === facility.locationKey,
      )!;
      expect(tile.facilitySlots).toContain(facility.id);
    }
  });

  it('is deterministic: same bloc → same placement on every call', () => {
    const blocId = 'eurozone';
    const a = placeStarterFacilities(blocId, tilesForBloc(blocId), FACILITY_DEFS);
    const b = placeStarterFacilities(blocId, tilesForBloc(blocId), FACILITY_DEFS);
    expect(a.facilities).toEqual(b.facilities);
    expect(a.tiles).toEqual(b.tiles);
  });

  it('does not mutate the input tiles array', () => {
    const blocId = 'northAmerica';
    const tiles = tilesForBloc(blocId);
    const snapshot = JSON.parse(JSON.stringify(tiles));
    placeStarterFacilities(blocId, tiles, FACILITY_DEFS);
    expect(tiles).toEqual(snapshot);
  });

  it('sets builtTurn to 0 so the existing earliest-built tie-break treats starters as oldest', () => {
    const blocId = 'northAmerica';
    const result = placeStarterFacilities(blocId, tilesForBloc(blocId), FACILITY_DEFS);
    for (const f of result.facilities) {
      expect(f.builtTurn).toBe(0);
    }
  });

  it('places the v1 default trio (researchLab + coalPowerStation + mine) for blocs without an override', () => {
    const blocId = 'northAmerica';
    expect(getStarterFacilityDefIds(blocId)).toEqual(['researchLab', 'coalPowerStation', 'mine']);
    const result = placeStarterFacilities(blocId, tilesForBloc(blocId), FACILITY_DEFS);
    const defIds = result.facilities.map((f) => f.defId).sort();
    expect(defIds).toEqual(['coalPowerStation', 'mine', 'researchLab']);
  });
});
