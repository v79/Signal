import type {
  GameState,
  ProjectDef,
  ProjectInstance,
  PlayerState,
  Resources,
  FieldPoints,
  NewsItem,
  PendingFacilityPlacement,
  FacilityDef,
  FacilityInstance,
  MapTile,
  OngoingAction,
} from './types';
import { coordKey } from './facilities';

// ---------------------------------------------------------------------------
// Projects
//
// Projects are finite, goal-oriented endeavours distinct from facilities.
// They have a one-time cost, a multi-turn duration, and a one-time reward
// on completion. Some have per-turn upkeep while active.
//
// Related projects may share a groupId — the UI groups and sequences them,
// with requiredProjects prerequisites enforcing initiation order.
//
// Prerequisites are checked before initiation:
//   - Era gate (player must be in the required era or later)
//   - Required techs (must be at 'discovered' stage)
//   - Required facility defs (at least one active instance must exist)
//   - Required projects (must be completed)
//   - Cost affordability (player has enough resources to pay upfront)
// ---------------------------------------------------------------------------

const ERA_ORDER = ['earth', 'nearSpace', 'deepSpace'] as const;
type Era = (typeof ERA_ORDER)[number];

/**
 * Convert a turn number to an in-world year.
 * Turn 1 = 1970; each turn advances one year.
 */
export function turnToYear(turn: number): number {
  return 1969 + turn;
}

// ---------------------------------------------------------------------------
// Prerequisite / availability checks
// ---------------------------------------------------------------------------

/**
 * Return true if all prerequisites are met and the player can afford the
 * upfront cost. Does NOT check whether the project is already active or
 * completed — call site should guard against duplicates.
 */
export function canInitiateProject(state: GameState, def: ProjectDef): boolean {
  const { player } = state;
  const prereqs = def.prerequisites;

  // Era gate
  if (prereqs.era) {
    const required = ERA_ORDER.indexOf(prereqs.era as Era);
    const current = ERA_ORDER.indexOf(state.era as Era);
    if (current < required) return false;
  }

  // Required techs
  if (prereqs.requiredTechs) {
    for (const techId of prereqs.requiredTechs) {
      if (!player.techs.some((t) => t.defId === techId && t.stage === 'discovered')) return false;
    }
  }

  // Required facility defs — at least one active (non-pending-demolition) instance
  if (prereqs.requiredFacilityDefs) {
    for (const defId of prereqs.requiredFacilityDefs) {
      const hasActive = player.facilities.some((f) => {
        if (f.defId !== defId) return false;
        const tile = state.map.earthTiles.find((t) =>
          t.facilitySlots.some((s) => s === f.id),
        );
        return tile ? tile.pendingActionId === null : true;
      });
      if (!hasActive) return false;
    }
  }

  // Required completed projects
  if (prereqs.requiredProjects) {
    for (const projId of prereqs.requiredProjects) {
      if (!(projId in player.completedProjectIds)) return false;
    }
  }

  // Orbital Station authorisation gate
  if (prereqs.requiresOrbitalStationAuthorised && !state.orbitalStationAuthorised) return false;

  // Moon Colony authorisation gate
  if (prereqs.requiresMoonColonyAuthorised && !state.moonColonyAuthorised) return false;

  // Minimum resource prerequisites (separate from cost)
  if (prereqs.minResources) {
    const r = prereqs.minResources;
    if ((r.funding ?? 0) > player.resources.funding) return false;
    if ((r.materials ?? 0) > player.resources.materials) return false;
    if ((r.politicalWill ?? 0) > player.resources.politicalWill) return false;
  }

  // Upfront cost affordability
  if ((def.cost.funding ?? 0) > player.resources.funding) return false;
  if ((def.cost.materials ?? 0) > player.resources.materials) return false;
  if ((def.cost.politicalWill ?? 0) > player.resources.politicalWill) return false;

  return true;
}

/**
 * Return all projects from the defs map that:
 *   - Are not already active
 *   - Are not already completed
 *   - Pass canInitiateProject
 */
export function getAvailableProjects(
  state: GameState,
  defs: Map<string, ProjectDef>,
): ProjectDef[] {
  const activeDefIds = new Set(state.player.activeProjects.map((p) => p.defId));
  const completed = state.player.completedProjectIds;
  return [...defs.values()].filter(
    (def) => !activeDefIds.has(def.id) && !(def.id in completed) && canInitiateProject(state, def),
  );
}

// ---------------------------------------------------------------------------
// Initiation
// ---------------------------------------------------------------------------

/**
 * Initiate a project: deduct upfront cost, create the ProjectInstance,
 * and add a news item. Caller must verify canInitiateProject first.
 */
export function initiateProject(state: GameState, def: ProjectDef): GameState {
  const resources: Resources = {
    funding: state.player.resources.funding - (def.cost.funding ?? 0),
    materials: Math.max(0, state.player.resources.materials - (def.cost.materials ?? 0)),
    politicalWill: Math.max(
      0,
      state.player.resources.politicalWill - (def.cost.politicalWill ?? 0),
    ),
  };

  const instance: ProjectInstance = {
    id: `${def.id}-t${state.turn}`,
    defId: def.id,
    startTurn: state.turn,
    turnsElapsed: 0,
    effectiveDuration: def.baseDuration,
  };

  const newsItem: NewsItem = {
    id: `project-start-${def.id}-t${state.turn}`,
    turn: state.turn,
    text: `Project initiated: ${def.name}.`,
    category: 'discovery',
  };

  return {
    ...state,
    player: {
      ...state.player,
      resources,
      activeProjects: [...state.player.activeProjects, instance],
      newsFeed: [...state.player.newsFeed, newsItem],
    },
  };
}

// ---------------------------------------------------------------------------
// World-phase tick
// ---------------------------------------------------------------------------

export interface ProjectTickResult {
  state: GameState;
  /** DefIds of projects that completed this tick. */
  completedDefIds: string[];
  /** New pending placements written by completions this tick (for news/UI hooks). */
  newPendingPlacements: PendingFacilityPlacement[];
}

/**
 * Advance all active projects by one turn. Projects that reach their
 * effectiveDuration are completed: rewards are applied, upkeep stops,
 * and they move to completedProjectIds.
 *
 * Per-turn upkeep for still-active projects is also deducted here.
 */
export function tickActiveProjects(
  state: GameState,
  defs: Map<string, ProjectDef>,
  turn: number,
): ProjectTickResult {
  const completedDefIds: string[] = [];
  let player: PlayerState = { ...state.player };
  let signal = { ...state.signal };
  const stillActive: ProjectInstance[] = [];
  const projectNews: NewsItem[] = [];
  const newPendingPlacements: PendingFacilityPlacement[] = [];

  for (const project of player.activeProjects) {
    const def = defs.get(project.defId);
    if (!def) {
      // Unknown def — keep as-is to avoid data loss
      stillActive.push(project);
      continue;
    }

    const advanced = { ...project, turnsElapsed: project.turnsElapsed + 1 };

    if (advanced.turnsElapsed >= advanced.effectiveDuration) {
      // ---- Completion ----
      completedDefIds.push(def.id);
      player = { ...player, completedProjectIds: { ...player.completedProjectIds, [def.id]: turn } };

      // Deduct final turn upkeep before applying reward
      if (def.upkeepCost.funding || def.upkeepCost.materials || def.upkeepCost.politicalWill) {
        player = {
          ...player,
          resources: {
            funding: player.resources.funding - (def.upkeepCost.funding ?? 0),
            materials: Math.max(0, player.resources.materials - (def.upkeepCost.materials ?? 0)),
            politicalWill: Math.max(0, player.resources.politicalWill - (def.upkeepCost.politicalWill ?? 0)),
          },
        };
      }

      // Apply one-off resource reward
      const oneOff = def.oneOffReward;
      if (oneOff?.resources) {
        const r = oneOff.resources;
        player = {
          ...player,
          resources: {
            funding: player.resources.funding + (r.funding ?? 0),
            materials: Math.max(0, player.resources.materials + (r.materials ?? 0)),
            politicalWill: Math.max(
              0,
              player.resources.politicalWill + (r.politicalWill ?? 0),
            ),
          },
        };
      }

      // Apply one-off field reward
      if (oneOff?.fields) {
        for (const [k, v] of Object.entries(oneOff.fields) as [keyof FieldPoints, number][]) {
          // Field boosts from one-off rewards are applied to accumulated fields next turn;
          // here we just note them. The ongoing reward path handles per-turn output.
          // One-off field grants are rare (e.g. computingResearchProgramme) and applied as
          // a direct addition to the player's current field snapshot.
          player = {
            ...player,
            fields: { ...player.fields, [k]: (player.fields[k] ?? 0) + (v ?? 0) },
          };
        }
      }

      // Apply signal progress reward
      if (oneOff?.signalProgress) {
        signal = {
          ...signal,
          decodeProgress: Math.min(100, signal.decodeProgress + oneOff.signalProgress),
        };
      }

      // Add unlocked cards to deck
      if (oneOff?.unlocksCards) {
        for (const cardDefId of oneOff.unlocksCards) {
          player = {
            ...player,
            cards: [
              ...player.cards,
              { id: `${cardDefId}-proj-${def.id}-t${turn}`, defId: cardDefId, zone: 'deck' as const, bankedSinceTurn: null },
            ],
          };
        }
      }

      // Resolve host facility for projects that anchor to a facility on the map
      if (def.id === 'cern') {
        const hostId = resolveHostFacility(player, 'publicUniversity');
        player = {
          ...player,
          projectHostFacilityIds: { ...player.projectHostFacilityIds, cern: hostId },
        };
      }

      // Infrastructure projects: queue a manual placement, or auto-resolve a host.
      // anchoredToHost is documentation-only here — CERN's host resolution above
      // remains the load-bearing implementation. Listing it on the def lets
      // future tooling (UI, save inspectors) reason about producers consistently.
      if (def.producesFacility) {
        if (def.producesFacility.placement === 'manualTile') {
          newPendingPlacements.push({
            sourceId: def.id,
            facilityDefId: def.producesFacility.defId,
            deferCount: 0,
          });
        }
      }

      projectNews.push({
        id: `project-complete-${def.id}-t${turn}`,
        turn,
        text: `Project complete: ${def.name}. ${formatRewardForNews(def)}`.trimEnd(),
        category: 'discovery',
      });
    } else {
      stillActive.push(advanced);
    }
  }

  // Deduct per-turn upkeep for projects still running
  if (stillActive.length > 0) {
    let upkeepFunding = 0;
    let upkeepMaterials = 0;
    let upkeepWill = 0;
    for (const project of stillActive) {
      const def = defs.get(project.defId);
      if (!def) continue;
      upkeepFunding += def.upkeepCost.funding ?? 0;
      upkeepMaterials += def.upkeepCost.materials ?? 0;
      upkeepWill += def.upkeepCost.politicalWill ?? 0;
    }
    player = {
      ...player,
      resources: {
        funding: player.resources.funding - upkeepFunding,
        materials: Math.max(0, player.resources.materials - upkeepMaterials),
        politicalWill: Math.max(0, player.resources.politicalWill - upkeepWill),
      },
    };
  }

  player = {
    ...player,
    activeProjects: stillActive,
    newsFeed: [...player.newsFeed, ...projectNews],
  };

  const pendingFacilityPlacements =
    newPendingPlacements.length > 0
      ? [...state.pendingFacilityPlacements, ...newPendingPlacements]
      : state.pendingFacilityPlacements;

  return {
    state: { ...state, player, signal, pendingFacilityPlacements },
    completedDefIds,
    newPendingPlacements,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRewardForNews(def: ProjectDef): string {
  const parts: string[] = [];
  const r = def.oneOffReward;
  if (r?.signalProgress) parts.push(`+${r.signalProgress} signal progress`);
  if (r?.resources?.funding) parts.push(`+${r.resources.funding}F`);
  if (r?.resources?.materials) parts.push(`+${r.resources.materials}M`);
  if (r?.resources?.politicalWill) parts.push(`+${r.resources.politicalWill}W`);
  if (r?.unlocksCards?.length) parts.push(`${r.unlocksCards.length} new card(s) added to deck`);
  if (def.ongoingReward) parts.push('ongoing output each turn');
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/**
 * Returns the field and resource output from all completed scientific/landmark
 * projects with an ongoingReward. Called each world phase.
 */
export function applyOngoingProjectRewards(
  player: PlayerState,
  defs: Map<string, ProjectDef>,
): { fields: Partial<FieldPoints>; resources: Partial<Resources> } {
  const fields: Partial<FieldPoints> = {};
  const resources: Partial<Resources> = {};

  for (const defId of Object.keys(player.completedProjectIds)) {
    const def = defs.get(defId);
    if (!def?.ongoingReward) continue;
    if (def.type !== 'scientific' && def.type !== 'landmark') continue;

    const r = def.ongoingReward;
    if (r.fields) {
      for (const [k, v] of Object.entries(r.fields) as [keyof FieldPoints, number][]) {
        fields[k] = (fields[k] ?? 0) + (v ?? 0);
      }
    }
    if (r.resources) {
      for (const [k, v] of Object.entries(r.resources) as [keyof Resources, number][]) {
        resources[k] = (resources[k] ?? 0) + (v ?? 0);
      }
    }
  }

  return { fields, resources };
}

/**
 * Finds the earliest-built facility instance with the given defId.
 * Tie-break: builtTurn asc, then id asc (lexicographic).
 * Returns the instance id, or null if none exists.
 */
function resolveHostFacility(player: PlayerState, defId: string): string | null {
  const candidates = player.facilities
    .filter((f) => f.defId === defId)
    .sort((a, b) => a.builtTurn - b.builtTurn || a.id.localeCompare(b.id));
  return candidates[0]?.id ?? null;
}

/**
 * Re-resolves CERN's host facility after a publicUniversity is destroyed.
 * Called from the facility destruction path in turn.ts.
 */
export function reanchorCern(player: PlayerState): PlayerState {
  if (!('cern' in player.completedProjectIds)) return player;
  const hostId = resolveHostFacility(player, 'publicUniversity');
  return {
    ...player,
    projectHostFacilityIds: { ...player.projectHostFacilityIds, cern: hostId },
  };
}

// ---------------------------------------------------------------------------
// Pending facility placements (manualTile flow)
// ---------------------------------------------------------------------------

/**
 * Returns true if the tile can host a facility of the given def in a single
 * contiguous run of slots starting at slotIndex. Honours tile-type filter,
 * existing slot occupancy, destroyedStatus, and any pending action on the tile.
 */
export function canPlaceProducedFacility(
  tile: MapTile,
  def: FacilityDef,
  slotIndex: number,
): boolean {
  if (tile.destroyedStatus !== null) return false;
  if (tile.pendingActionId !== null) return false;
  if (def.allowedTileTypes.length > 0 && !def.allowedTileTypes.includes(tile.type)) return false;

  const slotCost = def.slotCost ?? 1;
  if (slotIndex < 0 || slotIndex + slotCost > 3) return false;
  for (let i = slotIndex; i < slotIndex + slotCost; i++) {
    if (tile.facilitySlots[i] !== null) return false;
  }
  return true;
}

/**
 * Find any tile in the bloc that can host the produced facility. Used to
 * detect the zero-eligible-tiles edge case so the UI can keep the prompt
 * dismissed instead of escalating to the blocking modal.
 */
export function hasAnyEligibleTile(
  tiles: MapTile[],
  def: FacilityDef,
): boolean {
  for (const tile of tiles) {
    for (let slot = 0; slot < 3; slot++) {
      if (canPlaceProducedFacility(tile, def, slot)) return true;
    }
  }
  return false;
}

/**
 * Place a pending facility on the chosen tile and remove the pending entry.
 *
 * Honours the facility def's `buildTime`:
 *   - buildTime === 0 → instant placement (FacilityInstance created now).
 *   - buildTime  >  0 → an OngoingAction is enqueued and the tile marked
 *     pending; the FacilityInstance is created later by tickConstructionQueue
 *     when turnsRemaining reaches zero. Build cost is NOT charged — the
 *     player has already paid via the upstream source (project completion or
 *     event acceptance).
 *
 * Returns the new GameState; throws if the tile cannot host the facility.
 */
export function placePendingFacility(
  state: GameState,
  sourceId: string,
  targetCoordKey: string,
  slotIndex: number,
  facilityDefs: Map<string, FacilityDef>,
): GameState {
  const pending = state.pendingFacilityPlacements.find((p) => p.sourceId === sourceId);
  if (!pending) {
    throw new Error(`No pending placement for source ${sourceId}`);
  }
  const def = facilityDefs.get(pending.facilityDefId);
  if (!def) {
    throw new Error(`Unknown facility def ${pending.facilityDefId}`);
  }
  const tile = state.map.earthTiles.find((t) => coordKey(t.coord) === targetCoordKey);
  if (!tile) {
    throw new Error(`Tile not found at ${targetCoordKey}`);
  }
  if (!canPlaceProducedFacility(tile, def, slotIndex)) {
    throw new Error(`Tile ${targetCoordKey} cannot host ${def.id} at slot ${slotIndex}`);
  }

  const slotCost = def.slotCost ?? 1;
  const remainingPending = state.pendingFacilityPlacements.filter(
    (p) => p.sourceId !== sourceId,
  );

  if (def.buildTime > 0) {
    // Multi-turn construction — enqueue an OngoingAction, mark the tile
    // pending. The FacilityInstance is created by tickConstructionQueue.
    const actionId = `construct-${def.id}-${targetCoordKey}-t${state.turn}`;
    const action: OngoingAction = {
      id: actionId,
      type: 'construct',
      facilityDefId: def.id,
      coordKey: targetCoordKey,
      turnsRemaining: def.buildTime,
      totalTurns: def.buildTime,
      slotIndex,
    };
    const updatedTiles = state.map.earthTiles.map((t) =>
      coordKey(t.coord) === targetCoordKey ? { ...t, pendingActionId: actionId } : t,
    );
    const newsItem: NewsItem = {
      id: `placement-begun-${sourceId}-t${state.turn}`,
      turn: state.turn,
      text: `Construction of ${def.name} has begun (${def.buildTime} turns).`,
      category: 'discovery',
    };
    return {
      ...state,
      map: { ...state.map, earthTiles: updatedTiles },
      pendingFacilityPlacements: remainingPending,
      player: {
        ...state.player,
        constructionQueue: [...state.player.constructionQueue, action],
        newsFeed: [...state.player.newsFeed, newsItem],
      },
    };
  }

  // Instant placement (buildTime === 0).
  const facilityId = `${def.id}-${targetCoordKey}-t${state.turn}`;
  const startCondition = def.depletes ? tile.mineDepletion : 1.0;
  const newInstance: FacilityInstance = {
    id: facilityId,
    defId: def.id,
    locationKey: targetCoordKey,
    condition: startCondition,
    builtTurn: state.turn,
  };

  const updatedTiles = state.map.earthTiles.map((t) => {
    if (coordKey(t.coord) !== targetCoordKey) return t;
    const newSlots = [...t.facilitySlots] as [string | null, string | null, string | null];
    for (let i = slotIndex; i < slotIndex + slotCost && i < 3; i++) {
      newSlots[i] = facilityId;
    }
    return { ...t, facilitySlots: newSlots };
  });

  const newsItem: NewsItem = {
    id: `placement-complete-${sourceId}-t${state.turn}`,
    turn: state.turn,
    text: `${def.name} sited and operational.`,
    category: 'discovery',
  };

  return {
    ...state,
    map: { ...state.map, earthTiles: updatedTiles },
    pendingFacilityPlacements: remainingPending,
    player: {
      ...state.player,
      facilities: [...state.player.facilities, newInstance],
      newsFeed: [...state.player.newsFeed, newsItem],
    },
  };
}

/**
 * Increment the defer counter on a pending placement. Caller should compare
 * the resulting deferCount to 3 to decide whether to escalate to the blocking
 * modal next time the prompt resurfaces.
 */
export function deferPendingPlacement(
  state: GameState,
  sourceId: string,
): GameState {
  return {
    ...state,
    pendingFacilityPlacements: state.pendingFacilityPlacements.map((p) =>
      p.sourceId === sourceId ? { ...p, deferCount: p.deferCount + 1 } : p,
    ),
  };
}
