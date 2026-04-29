import type { FacilityDef, FacilityInstance, MapTile } from './types';
import { coordKey, findContiguousFreeStart } from './facilities';

/**
 * Each bloc's starter trio: science + income + resource.
 *
 * Phase 39 v1 ships a uniform default — `researchLab` + `coalPowerStation` + `mine` —
 * for every bloc. Per-bloc tuning (e.g. `bioresearchCentre` for South America,
 * `engineeringWorks` for East Asia) can be added by overriding entries here.
 *
 * Order in the array determines placement priority: earlier entries claim tiles
 * first when scanning the bloc's tile list, so put the most-flexible facility first.
 */
const DEFAULT_TRIO: readonly string[] = ['researchLab', 'coalPowerStation', 'mine'];

const STARTER_FACILITY_TRIOS: Record<string, readonly string[]> = {
  // No per-bloc overrides yet — everyone gets DEFAULT_TRIO.
};

export function getStarterFacilityDefIds(blocDefId: string): readonly string[] {
  return STARTER_FACILITY_TRIOS[blocDefId] ?? DEFAULT_TRIO;
}

export interface StarterPlacementResult {
  tiles: MapTile[];
  facilities: FacilityInstance[];
}

/**
 * Place each starter facility on the first tile (in declaration order) that
 * matches its `allowedTileTypes` and has enough free contiguous slot capacity.
 *
 * Pure function — input tiles are not mutated. The HQ tile (or any tile with
 * existing facility slots filled) is naturally skipped by the slot check.
 *
 * Per phase 39: all blocs are guaranteed to contain every tile type, so no
 * fallback path is needed when a tile-type match fails.
 */
export function placeStarterFacilities(
  blocDefId: string,
  tiles: MapTile[],
  facilityDefs: Map<string, FacilityDef>,
): StarterPlacementResult {
  const defIds = getStarterFacilityDefIds(blocDefId);
  let workingTiles = tiles.map((t) => ({ ...t, facilitySlots: [...t.facilitySlots] as MapTile['facilitySlots'] }));
  const facilities: FacilityInstance[] = [];

  for (const defId of defIds) {
    const def = facilityDefs.get(defId);
    if (!def) continue;
    const slotCost = def.slotCost ?? 1;

    const tileIdx = workingTiles.findIndex(
      (t) =>
        t.destroyedStatus === null &&
        def.allowedTileTypes.includes(t.type) &&
        findContiguousFreeStart(t.facilitySlots, slotCost) !== null,
    );
    if (tileIdx === -1) continue;

    const tile = workingTiles[tileIdx];
    const startSlot = findContiguousFreeStart(tile.facilitySlots, slotCost)!;
    const ck = coordKey(tile.coord);
    const facilityId = `${defId}-${ck}-t0`;

    const newSlots = [...tile.facilitySlots] as MapTile['facilitySlots'];
    for (let i = startSlot; i < startSlot + slotCost; i++) {
      newSlots[i] = facilityId;
    }
    workingTiles[tileIdx] = { ...tile, facilitySlots: newSlots };

    facilities.push({
      id: facilityId,
      defId,
      locationKey: ck,
      condition: 1.0,
      builtTurn: 0,
    });
  }

  return { tiles: workingTiles, facilities };
}
