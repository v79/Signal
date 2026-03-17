import type { MapTile, FacilityInstance, FacilityDef } from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Climate-driven tile degradation
//
// Called once per World Phase after climate pressure is updated.
// Higher pressure raises the probability that tiles degrade spontaneously.
// ---------------------------------------------------------------------------

interface DegradationRule {
  tileType: MapTile['type'];
  status: MapTile['destroyedStatus'] & string;
  /** Probability per turn that one eligible tile of this type degrades. */
  probability: number;
  newsVerb: string; // "drought" | "flooding"
}

function getRules(climatePressure: number): DegradationRule[] {
  const rules: DegradationRule[] = [];

  if (climatePressure > 55) {
    rules.push({ tileType: 'forested', status: 'dustbowl', probability: 0.03, newsVerb: 'drought' });
  }
  if (climatePressure > 70) {
    rules.push({ tileType: 'forested',     status: 'dustbowl', probability: 0.06, newsVerb: 'drought' });
    rules.push({ tileType: 'agricultural', status: 'dustbowl', probability: 0.03, newsVerb: 'drought' });
  }
  if (climatePressure > 85) {
    rules.push({ tileType: 'coastal',      status: 'flooded',  probability: 0.04, newsVerb: 'flooding' });
    rules.push({ tileType: 'agricultural', status: 'dustbowl', probability: 0.06, newsVerb: 'drought' });
  }

  return rules;
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

  let updatedTiles = [...tiles];
  let updatedFacilities = [...facilities];
  const newsLines: string[] = [];

  for (const rule of rules) {
    if (rng.next() >= rule.probability) continue;

    // Candidates: non-destroyed tiles of the target type, excluding any tile with HQ in a slot
    const candidates = updatedTiles.filter((t) => {
      if (t.type !== rule.tileType) return false;
      if (t.destroyedStatus !== null) return false;
      if (t.facilitySlots.some((id) => id && updatedFacilities.find((f) => f.id === id)?.defId === 'hq')) return false;
      return true;
    });

    if (candidates.length === 0) continue;

    const chosen = candidates[Math.floor(rng.next() * candidates.length)];
    const chosenKey = `${chosen.coord.q},${chosen.coord.r}`;

    // Collect all non-HQ facility IDs on the chosen tile
    const slotIds = new Set(chosen.facilitySlots.filter(Boolean) as string[]);
    const facilsToRemove = updatedFacilities.filter(
      (f) => slotIds.has(f.id) && f.defId !== 'hq',
    );
    const removeIds = new Set(facilsToRemove.map((f) => f.id));

    // Destroy the tile: clear all slots, set status
    updatedTiles = updatedTiles.map((t) =>
      `${t.coord.q},${t.coord.r}` === chosenKey
        ? { ...t, destroyedStatus: rule.status, facilitySlots: [null, null, null] as [null, null, null], pendingActionId: null }
        : t,
    );

    // Remove all non-HQ facilities from the destroyed tile
    updatedFacilities = updatedFacilities.filter((f) => !removeIds.has(f.id));

    newsLines.push(`A ${rule.tileType} tile has been lost to ${rule.newsVerb}.`);
  }

  if (newsLines.length === 0) return { changed: false, tiles, facilities, newsText: '' };

  return {
    changed: true,
    tiles: updatedTiles,
    facilities: updatedFacilities,
    newsText: newsLines.join(' '),
  };
}
