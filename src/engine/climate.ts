import type { MapTile, FacilityInstance, FacilityDef, TileDestroyedStatus } from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Climate-driven tile degradation
//
// Called once per World Phase after climate pressure is updated.
// Higher pressure raises the probability that tiles degrade spontaneously.
// Rules at higher thresholds stack with lower ones — each rule gets its own
// independent roll, so escalating pressure multiplies cumulative risk.
// ---------------------------------------------------------------------------

interface DegradationRule {
  tileType: MapTile['type'];
  status: TileDestroyedStatus;
  /** Probability per turn that one eligible tile of this type degrades. */
  probability: number;
  newsVerb: string;
}

function getRules(climatePressure: number): DegradationRule[] {
  const rules: DegradationRule[] = [];

  if (climatePressure > 55) {
    rules.push({ tileType: 'forested', status: 'dustbowl', probability: 0.03, newsVerb: 'drought' });
  }
  if (climatePressure > 70) {
    rules.push({ tileType: 'forested', status: 'dustbowl', probability: 0.06, newsVerb: 'drought' });
    rules.push({ tileType: 'agricultural', status: 'dustbowl', probability: 0.03, newsVerb: 'drought' });
  }
  if (climatePressure > 85) {
    rules.push({ tileType: 'coastal', status: 'flooded', probability: 0.04, newsVerb: 'rising sea levels' });
    rules.push({ tileType: 'agricultural', status: 'dustbowl', probability: 0.06, newsVerb: 'drought' });
  }
  if (climatePressure > 80) {
    rules.push({ tileType: 'highland', status: 'dustbowl', probability: 0.02, newsVerb: 'desertification' });
  }

  return rules;
}

const tileKey = (t: MapTile) => `${t.coord.q},${t.coord.r}`;

function hasClimateImmuneFacility(
  tile: MapTile,
  facilityById: Map<string, FacilityInstance>,
  facilityDefs: Map<string, FacilityDef>,
): boolean {
  for (const id of tile.facilitySlots) {
    if (!id) continue;
    const inst = facilityById.get(id);
    if (inst && facilityDefs.get(inst.defId)?.climateImmune === true) return true;
  }
  return false;
}

export function applyClimateDegradation(
  tiles: MapTile[],
  climatePressure: number,
  facilities: FacilityInstance[],
  facilityDefs: Map<string, FacilityDef>,
  rng: Rng,
): { changed: boolean; tiles: MapTile[]; facilities: FacilityInstance[]; newsText: string } {
  const rules = getRules(climatePressure);
  if (rules.length === 0) return { changed: false, tiles, facilities, newsText: '' };

  // Lazy copies — only allocate once a rule actually fires.
  let workingTiles: MapTile[] | null = null;
  let workingFacilities: FacilityInstance[] | null = null;
  const newsLines: string[] = [];

  // Mutable index of live facilities; updated in place as facilities are removed.
  const facilityById = new Map(facilities.map((f) => [f.id, f]));
  // Fixed tile index by coord — tile identity (q,r) doesn't change, only its
  // slot in the working array.
  const tileIndexByKey = new Map(tiles.map((t, i) => [tileKey(t), i]));

  for (const rule of rules) {
    if (rng.next() >= rule.probability) continue;

    const currentTiles = workingTiles ?? tiles;
    const candidates = currentTiles.filter((t) => {
      if (t.type !== rule.tileType) return false;
      if (t.destroyedStatus !== null) return false;
      if (rule.status === 'flooded' && t.seaWallProtected) return false;
      return !hasClimateImmuneFacility(t, facilityById, facilityDefs);
    });

    if (candidates.length === 0) continue;

    const chosen = candidates[Math.floor(rng.next() * candidates.length)];
    const chosenIdx = tileIndexByKey.get(tileKey(chosen))!;

    if (workingTiles === null) workingTiles = [...tiles];
    workingTiles[chosenIdx] = {
      ...chosen,
      destroyedStatus: rule.status,
      facilitySlots: [null, null, null],
      pendingActionId: null,
    };

    // Remove non-immune facilities occupying the destroyed tile. Climate-immune
    // facilities can't be on a degrading tile (filter above excludes them), so
    // every slot ID here belongs to a facility slated for removal — but we
    // still check the def in case of stale/orphaned IDs.
    const removeIds = new Set<string>();
    for (const id of chosen.facilitySlots) {
      if (!id) continue;
      const inst = facilityById.get(id);
      if (inst && facilityDefs.get(inst.defId)?.climateImmune !== true) {
        removeIds.add(id);
      }
    }
    if (removeIds.size > 0) {
      if (workingFacilities === null) workingFacilities = [...facilities];
      workingFacilities = workingFacilities.filter((f) => !removeIds.has(f.id));
      for (const id of removeIds) facilityById.delete(id);
    }

    newsLines.push(`A ${rule.tileType} tile has been lost to ${rule.newsVerb}.`);
  }

  if (newsLines.length === 0) {
    return { changed: false, tiles, facilities, newsText: '' };
  }

  return {
    changed: true,
    tiles: workingTiles ?? tiles,
    facilities: workingFacilities ?? facilities,
    newsText: newsLines.join(' '),
  };
}
