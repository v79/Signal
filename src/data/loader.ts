// =============================================================================
// SIGNAL — Data Loader
// Imports all JSON data files and re-exports typed symbols that match the
// original per-file exports. All import sites should use this module.
// =============================================================================

import type {
  BlocDef,
  BoardMemberDef,
  CardDef,
  EventDef,
  FacilityDef,
  ProjectDef,
  TechDef,
  NarrativeDef,
  TileType,
} from '../engine/types';

import blocsJson from './blocs.json' with { type: 'json' };
import blocMapsJson from './blocMaps.json' with { type: 'json' };
import boardJson from './board.json' with { type: 'json' };
import cardsJson from './cards.json' with { type: 'json' };
import eventsJson from './events.json' with { type: 'json' };
import facilitiesJson from './facilities.json' with { type: 'json' };
import projectsJson from './projects.json' with { type: 'json' };
import narrativeJson from './narrative.json' with { type: 'json' };
import techsJson from './technologies.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// TileLayout — defined here since blocMaps.ts (which originally defined it)
// is being deleted.
// ---------------------------------------------------------------------------

export interface TileLayout {
  q: number;
  r: number;
  type: TileType;
}

// ---------------------------------------------------------------------------
// Core data maps
// ---------------------------------------------------------------------------

export const BLOC_DEFS: Map<string, BlocDef> = new Map(
  Object.entries(blocsJson) as [string, BlocDef][],
);

export const BLOC_MAPS: Record<string, TileLayout[]> = blocMapsJson as Record<
  string,
  TileLayout[]
>;

export const BOARD_DEFS: Map<string, BoardMemberDef> = new Map(
  Object.entries(boardJson) as [string, BoardMemberDef][],
);

export const CARD_DEFS: Map<string, CardDef> = new Map(
  Object.entries(cardsJson) as [string, CardDef][],
);

export const EVENT_DEFS: Map<string, EventDef> = new Map(
  Object.entries(eventsJson) as [string, EventDef][],
);

export const FACILITY_DEFS: Map<string, FacilityDef> = new Map(
  Object.entries(facilitiesJson) as [string, FacilityDef][],
);

export const PROJECT_DEFS: Map<string, ProjectDef> = new Map(
  Object.entries(projectsJson) as [string, ProjectDef][],
);

export const TECH_DEFS: Map<string, TechDef> = new Map(
  Object.entries(techsJson) as [string, TechDef][],
);

// ---------------------------------------------------------------------------
// Narrative named exports (same names as the old narrative.ts)
// ---------------------------------------------------------------------------

const n = narrativeJson as Record<string, NarrativeDef>;

export const NARRATIVE_OPENING: NarrativeDef = n.opening;
export const NARRATIVE_GAME_HELP: NarrativeDef = n.gameHelp;
export const NARRATIVE_ERA_NEARSPACE: NarrativeDef = n.eraNearspace;
export const NARRATIVE_ERA_DEEPSPACE: NarrativeDef = n.eraDeepspace;
export const NARRATIVE_SIGNAL_STRUCTURED: NarrativeDef = n.signalStructured;
export const NARRATIVE_SIGNAL_URGENT: NarrativeDef = n.signalUrgent;
export const NARRATIVE_VICTORY_WORMHOLE: NarrativeDef = n.victoryWormhole;
export const NARRATIVE_VICTORY_ECOLOGICAL: NarrativeDef = n.victoryEcological;
export const NARRATIVE_VICTORY_ECONOMIC: NarrativeDef = n.victoryEconomic;
export const NARRATIVE_VICTORY_TERRAFORMING: NarrativeDef = n.victoryTerraforming;
export const NARRATIVE_LOSS_CLIMATE: NarrativeDef = n.lossClimate;
export const NARRATIVE_LOSS_MISINTERPRETATION: NarrativeDef = n.lossMisinterpretation;
export const NARRATIVE_LOSS_POLITICAL: NarrativeDef = n.lossPolitical;
export const NARRATIVE_LOSS_RESOURCE: NarrativeDef = n.lossResource;

export const VICTORY_NARRATIVES: Record<string, NarrativeDef> = {
  wormhole: n.victoryWormhole,
  ecologicalRestoration: n.victoryEcological,
  economicHegemony: n.victoryEconomic,
  terraforming: n.victoryTerraforming,
};

export const LOSS_NARRATIVES: Record<string, NarrativeDef> = {
  climateCollapse: n.lossClimate,
  signalMisinterpretation: n.lossMisinterpretation,
  politicalCollapse: n.lossPolitical,
  resourceExhaustion: n.lossResource,
};
