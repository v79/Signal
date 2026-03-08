// =============================================================================
// SIGNAL — Bloc Tile Map Layouts
//
// Each bloc has a predefined hex tile layout shaped abstractly after its
// real-world geography. The layout defines the Earth-map tiles the player
// operates on when playing as that bloc.
//
// Rules:
//  - Exactly one tile at (0,0), always type 'urban' — the HQ anchor.
//  - 24–36 tiles per layout.
//  - No duplicate (q,r) coordinates.
//  - Tile types reflect geographic character:
//      forested  = boreal/tropical forest
//      arid      = desert, steppe, dry interior
//      highland  = mountain ranges, plateaux
//      coastal   = sea-adjacent territory
//      agricultural = plains, farmland, pastoral land
//      industrial = heavy-industry zones
//      urban     = population centres, capital regions
// =============================================================================

import type { TileType } from '../engine/types';

export interface TileLayout {
  q: number;
  r: number;
  type: TileType;
}

// ---------------------------------------------------------------------------
// North American Alliance
// Wide continent: boreal north, industrial heartland, agricultural plains,
// arid southwest, coastal east and west.
// ---------------------------------------------------------------------------
const northAmerica: TileLayout[] = [
  // Urban core (0,0) + capital region
  { q:  0, r:  0, type: 'urban' },
  { q: -1, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'industrial' },
  // Industrial belt
  { q:  0, r:  1, type: 'industrial' },
  { q: -1, r:  1, type: 'industrial' },
  { q:  1, r: -1, type: 'industrial' },
  // Boreal north
  { q: -2, r: -1, type: 'forested' },
  { q: -1, r: -1, type: 'forested' },
  { q:  0, r: -1, type: 'forested' },
  { q:  1, r: -2, type: 'forested' },
  { q:  2, r: -2, type: 'forested' },
  { q: -3, r:  0, type: 'forested' },
  { q: -2, r:  0, type: 'forested' },
  // Highland/mountain west
  { q: -3, r:  1, type: 'highland' },
  { q: -2, r:  1, type: 'highland' },
  { q: -1, r:  2, type: 'highland' },
  // Agricultural plains
  { q:  0, r:  2, type: 'agricultural' },
  { q:  1, r:  1, type: 'agricultural' },
  { q:  2, r:  0, type: 'agricultural' },
  { q:  2, r: -1, type: 'agricultural' },
  // Arid southwest
  { q: -1, r:  3, type: 'arid' },
  { q:  0, r:  3, type: 'arid' },
  { q:  1, r:  2, type: 'arid' },
  { q:  2, r:  1, type: 'arid' },
  // Coastal east & south
  { q:  3, r: -1, type: 'coastal' },
  { q:  3, r:  0, type: 'coastal' },
  { q:  2, r:  2, type: 'coastal' },
  { q:  1, r:  3, type: 'coastal' },
  // Coastal west
  { q: -3, r:  2, type: 'coastal' },
  { q: -2, r:  2, type: 'coastal' },
];

// ---------------------------------------------------------------------------
// East Asian Consortium
// Dense coastal east, urban-industrial core, highland interior, forested
// north. Elongated north-south.
// ---------------------------------------------------------------------------
const eastAsia: TileLayout[] = [
  // Urban core
  { q:  0, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  { q:  0, r:  1, type: 'urban' },
  // Industrial
  { q: -1, r:  1, type: 'industrial' },
  { q:  1, r:  1, type: 'industrial' },
  { q: -1, r:  2, type: 'industrial' },
  { q:  0, r:  2, type: 'industrial' },
  // Highland interior
  { q: -2, r:  1, type: 'highland' },
  { q: -2, r:  2, type: 'highland' },
  { q: -1, r:  0, type: 'highland' },
  { q: -2, r:  0, type: 'highland' },
  { q: -1, r: -1, type: 'highland' },
  // Forested north
  { q:  0, r: -1, type: 'forested' },
  { q:  1, r: -2, type: 'forested' },
  { q:  0, r: -2, type: 'forested' },
  { q: -1, r: -2, type: 'forested' },
  { q: -2, r: -1, type: 'forested' },
  // Agricultural
  { q:  1, r: -1, type: 'agricultural' },
  { q:  2, r: -1, type: 'agricultural' },
  { q:  1, r:  2, type: 'agricultural' },
  { q:  0, r:  3, type: 'agricultural' },
  // Coastal east
  { q:  2, r:  0, type: 'coastal' },
  { q:  3, r: -1, type: 'coastal' },
  { q:  2, r:  1, type: 'coastal' },
  { q:  3, r:  0, type: 'coastal' },
  { q:  1, r:  3, type: 'coastal' },
  { q:  2, r:  2, type: 'coastal' },
];

// ---------------------------------------------------------------------------
// South American Union
// Forested interior (Amazon), coastal rim, agricultural south.
// ---------------------------------------------------------------------------
const southAmerica: TileLayout[] = [
  // Urban core
  { q:  0, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  // Industrial north
  { q:  0, r: -1, type: 'industrial' },
  { q:  1, r: -1, type: 'industrial' },
  // Amazon interior — forested
  { q: -1, r:  0, type: 'forested' },
  { q: -1, r:  1, type: 'forested' },
  { q:  0, r:  1, type: 'forested' },
  { q: -2, r:  1, type: 'forested' },
  { q: -1, r:  2, type: 'forested' },
  { q: -2, r:  2, type: 'forested' },
  { q: -2, r:  0, type: 'forested' },
  // Andes highland
  { q: -3, r:  1, type: 'highland' },
  { q: -3, r:  2, type: 'highland' },
  { q: -2, r:  3, type: 'highland' },
  // Agricultural south (pampas)
  { q:  0, r:  2, type: 'agricultural' },
  { q:  1, r:  1, type: 'agricultural' },
  { q:  0, r:  3, type: 'agricultural' },
  { q:  1, r:  2, type: 'agricultural' },
  { q: -1, r:  3, type: 'agricultural' },
  // Coastal east
  { q:  2, r: -1, type: 'coastal' },
  { q:  2, r:  0, type: 'coastal' },
  { q:  2, r:  1, type: 'coastal' },
  { q:  2, r:  2, type: 'coastal' },
  { q:  1, r:  3, type: 'coastal' },
  // Coastal north/west
  { q: -1, r: -1, type: 'coastal' },
  { q: -3, r:  3, type: 'coastal' },
];

// ---------------------------------------------------------------------------
// African Coalition
// Large continent: arid Sahara north, forested equatorial centre,
// agricultural east, coastal rim.
// ---------------------------------------------------------------------------
const africaCoalition: TileLayout[] = [
  // Urban core (sub-Saharan capital belt)
  { q:  0, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  { q:  0, r:  1, type: 'urban' },
  // Arid north (Sahara)
  { q: -1, r: -1, type: 'arid' },
  { q:  0, r: -1, type: 'arid' },
  { q:  1, r: -1, type: 'arid' },
  { q:  2, r: -1, type: 'arid' },
  { q: -1, r: -2, type: 'arid' },
  { q:  0, r: -2, type: 'arid' },
  { q:  1, r: -2, type: 'arid' },
  { q: -2, r: -1, type: 'arid' },
  // Industrial
  { q: -1, r:  0, type: 'industrial' },
  { q:  2, r:  0, type: 'industrial' },
  // Equatorial forested (Congo basin)
  { q: -1, r:  1, type: 'forested' },
  { q:  0, r:  2, type: 'forested' },
  { q: -1, r:  2, type: 'forested' },
  { q:  1, r:  1, type: 'forested' },
  // Agricultural east
  { q:  2, r:  1, type: 'agricultural' },
  { q:  1, r:  2, type: 'agricultural' },
  { q:  2, r:  2, type: 'agricultural' },
  { q:  0, r:  3, type: 'agricultural' },
  // Highland (Rift Valley, Ethiopian plateau)
  { q:  3, r:  0, type: 'highland' },
  { q:  3, r: -1, type: 'highland' },
  // Coastal north
  { q: -2, r: -2, type: 'coastal' },
  { q: -1, r: -3, type: 'coastal' },
  { q:  0, r: -3, type: 'coastal' },
  // Coastal south
  { q: -1, r:  3, type: 'coastal' },
  { q:  1, r:  3, type: 'coastal' },
  { q: -2, r:  2, type: 'coastal' },
];

// ---------------------------------------------------------------------------
// European Union
// Dense, mixed urban and industrial. Coastal north and west. Alpine highland.
// ---------------------------------------------------------------------------
const eurozone: TileLayout[] = [
  // Urban core (Rhine-Ruhr, Paris basin)
  { q:  0, r:  0, type: 'urban' },
  { q: -1, r:  0, type: 'urban' },
  { q:  1, r: -1, type: 'urban' },
  { q:  0, r: -1, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  // Industrial (Ruhr, Po Valley, Silesia)
  { q: -1, r:  1, type: 'industrial' },
  { q:  0, r:  1, type: 'industrial' },
  { q:  2, r: -1, type: 'industrial' },
  { q:  2, r:  0, type: 'industrial' },
  { q: -2, r:  1, type: 'industrial' },
  // Alpine highland
  { q:  0, r:  2, type: 'highland' },
  { q:  1, r:  1, type: 'highland' },
  { q: -1, r:  2, type: 'highland' },
  // Agricultural (France, Iberia, Poland)
  { q: -2, r:  0, type: 'agricultural' },
  { q: -2, r: -1, type: 'agricultural' },
  { q: -1, r: -1, type: 'agricultural' },
  { q:  3, r: -1, type: 'agricultural' },
  { q:  3, r:  0, type: 'agricultural' },
  // Mediterranean coastal south
  { q:  2, r:  1, type: 'coastal' },
  { q:  1, r:  2, type: 'coastal' },
  { q:  0, r:  3, type: 'coastal' },
  { q: -1, r:  3, type: 'coastal' },
  // Atlantic coastal west/north
  { q: -3, r:  1, type: 'coastal' },
  { q: -3, r:  0, type: 'coastal' },
  { q: -2, r: -2, type: 'coastal' },
  { q: -1, r: -2, type: 'coastal' },
  // Nordic forested north
  { q:  1, r: -2, type: 'forested' },
  { q:  0, r: -2, type: 'forested' },
];

// ---------------------------------------------------------------------------
// South Asian Federation
// Peninsular cluster, coastal-heavy. Highland north (Himalayas).
// Agricultural interior.
// ---------------------------------------------------------------------------
const southAsia: TileLayout[] = [
  // Urban core (Ganges plain)
  { q:  0, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  { q:  0, r:  1, type: 'urban' },
  // Industrial
  { q: -1, r:  1, type: 'industrial' },
  { q:  1, r:  1, type: 'industrial' },
  { q:  2, r:  0, type: 'industrial' },
  // Himalayan highland
  { q: -1, r: -1, type: 'highland' },
  { q:  0, r: -1, type: 'highland' },
  { q:  1, r: -1, type: 'highland' },
  { q: -1, r:  0, type: 'highland' },
  { q:  2, r: -1, type: 'highland' },
  // Agricultural (Deccan, Bengal)
  { q:  0, r:  2, type: 'agricultural' },
  { q:  1, r:  2, type: 'agricultural' },
  { q: -1, r:  2, type: 'agricultural' },
  { q:  2, r:  1, type: 'agricultural' },
  // Peninsula coastal (Bay of Bengal, Arabian Sea)
  { q:  3, r:  0, type: 'coastal' },
  { q:  3, r: -1, type: 'coastal' },
  { q:  2, r:  2, type: 'coastal' },
  { q:  1, r:  3, type: 'coastal' },
  { q:  0, r:  3, type: 'coastal' },
  { q: -1, r:  3, type: 'coastal' },
  { q: -2, r:  2, type: 'coastal' },
  { q: -2, r:  1, type: 'coastal' },
  // Forested northeast
  { q:  2, r: -2, type: 'forested' },
  { q:  1, r: -2, type: 'forested' },
];

// ---------------------------------------------------------------------------
// Gulf Consortium (Middle East)
// Arid-dominated. Urban and industrial pockets. Coastal south and west.
// ---------------------------------------------------------------------------
const middleEast: TileLayout[] = [
  // Urban core (Gulf cities, Levant)
  { q:  0, r:  0, type: 'urban' },
  { q:  1, r:  0, type: 'urban' },
  { q:  0, r: -1, type: 'urban' },
  // Industrial (oil processing, petrochemical)
  { q:  1, r: -1, type: 'industrial' },
  { q:  2, r: -1, type: 'industrial' },
  { q:  2, r:  0, type: 'industrial' },
  // Arid interior (Arabian Desert, Rub' al Khali)
  { q: -1, r:  0, type: 'arid' },
  { q: -1, r:  1, type: 'arid' },
  { q:  0, r:  1, type: 'arid' },
  { q:  1, r:  1, type: 'arid' },
  { q: -2, r:  1, type: 'arid' },
  { q:  0, r:  2, type: 'arid' },
  { q: -1, r:  2, type: 'arid' },
  { q: -1, r: -1, type: 'arid' },
  { q: -2, r:  0, type: 'arid' },
  // Highland (Zagros, Hejaz)
  { q:  3, r: -1, type: 'highland' },
  { q:  3, r:  0, type: 'highland' },
  { q: -1, r: -2, type: 'highland' },
  // Coastal (Persian Gulf, Red Sea, Mediterranean)
  { q:  2, r:  1, type: 'coastal' },
  { q:  1, r:  2, type: 'coastal' },
  { q:  0, r:  3, type: 'coastal' },
  { q: -2, r: -1, type: 'coastal' },
  { q: -2, r: -2, type: 'coastal' },
  { q: -1, r: -3, type: 'coastal' },
  { q:  0, r: -2, type: 'coastal' },
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const BLOC_MAPS: Record<string, TileLayout[]> = {
  northAmerica,
  eastAsia,
  southAmerica,
  africaCoalition,
  eurozone,
  southAsia,
  // Key matches the BLOC_DEFS map key in blocs.ts
  middlewEast: middleEast,
};
