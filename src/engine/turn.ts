import type {
  GameState,
  EventInstance,
  FacilityDef,
  ProjectDef,
  TechDef,
  EventDef,
  CardDef,
  BlocDef,
  BoardMemberDef,
  NewsItem,
  Resources,
  FieldPoints,
} from './types';
import {
  computeAdjacencyEffects,
  computeFacilityOutput,
  tickMineDepletion,
  computeHqBonus,
  tickConstructionQueue,
} from './facilities';
import {
  tickWill,
  computeBankDecay,
  applyResourceDeltas,
  DEFAULT_WILL_CONFIG,
} from './resources';
import {
  distributeResearchPoints,
  applyStageTransitions,
  checkBreakthroughConditions,
} from './research';
import { drawCards } from './cards';
import {
  selectNewEvents,
  tickEventCountdowns,
  getJustExpiredEvents,
  applyEventEffect,
  getEffectForResolution,
  formatEffectForNews,
} from './events';
import { simulateBlocs, checkBlocMergers } from './blocs';
import {
  computeBoardModifiers,
  applyBoardFieldMultipliers,
  applyBoardResourceMultipliers,
  tickBoardAges,
  addCommitteeNotification,
} from './board';
import { tickSignalProgress, didCrossStrengthThreshold, signalProgressNewsText } from './signal';
import { tickActiveProjects } from './projects';
import { applyClimateDegradation } from './climate';
import { checkVictoryConditions, tickEarthWelfare } from './victory';
import { ZERO_RESOURCES, ZERO_FIELDS } from './state';
import { createRng } from './rng';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Turn structure: Event → Draw → Action → Bank → World
//
// Event, Draw, and World phases are automated (called by the engine).
// Action and Bank phases are player-driven: the UI calls individual
// action functions (playCard, bankCard, etc.) from cards.ts and events.ts,
// then signals completion with endActionPhase / endBankPhase.
//
// PRNG canonical call order within each automated phase (must not change):
//   Event Phase: selectNewEvents → nextInt (count) → next() per pick
//   Draw Phase:  drawCards → shuffle (deck ids)
//   World Phase: (climate RNG — Phase 5) → (bloc RNG — Phase 7) → distributeResearchPoints (createRng(`${seed}-research-t${nextTurn}`))
// ---------------------------------------------------------------------------

const CLIMATE_PRESSURE_PER_TURN = 0.2;

// ---------------------------------------------------------------------------
// Phase 1: Event Phase
// ---------------------------------------------------------------------------

/**
 * Automated portion of the Event Phase:
 *   1. Tick countdowns on all active events.
 *   2. Apply effects of any events that just expired.
 *   3. Expire standing action restrictions that have ended.
 *   4. Select and add new events from the pool.
 *
 * Player counter/mitigation actions are handled separately by the UI
 * before this function is called (or can follow it, depending on UX order).
 */
export function executeEventPhase(
  state: GameState,
  eventDefs: Map<string, EventDef>,
  eventPool: EventDef[],
  rng: Rng,
): GameState {
  const { player } = state;

  // 1. Tick countdowns
  const tickedEvents = tickEventCountdowns(state.activeEvents);

  // 2. Apply effects of events that just expired
  let updatedPlayer = { ...player };
  let updatedTiles = [...state.map.earthTiles];
  const expired = getJustExpiredEvents(tickedEvents);
  const expiryNews: NewsItem[] = [];

  for (const event of expired) {
    const def = eventDefs.get(event.defId);
    if (!def) continue;
    const effect = getEffectForResolution(def, 'expired');
    if (!effect) continue;
    const result = applyEventEffect(effect, updatedPlayer, updatedTiles, state.turn, rng);
    updatedPlayer = result.player;
    updatedTiles = result.mapTiles;
    const summary = formatEffectForNews(effect);
    expiryNews.push({
      id: `event-expired-${event.id}-t${state.turn}`,
      turn: state.turn,
      text: `${def.name} expired — ${summary}.`,
      category: 'event-loss',
    });
  }

  // 3. Select and add new events
  const newEvents = selectNewEvents(
    eventPool,
    state.era,
    state.pushFactor,
    player.blocDefId,
    tickedEvents,
    rng,
    state.turn,
    state.climatePressure,
  );

  return {
    ...state,
    phase: 'draw',
    activeEvents: [...tickedEvents.filter((e) => !e.resolved), ...newEvents],
    map: { ...state.map, earthTiles: updatedTiles },
    player: {
      ...updatedPlayer,
      newsFeed: [...updatedPlayer.newsFeed, ...expiryNews],
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 2: Draw Phase
// ---------------------------------------------------------------------------

/**
 * Draw cards up to the hand limit from the player's deck.
 * Recycles the discard pile if the deck is insufficient.
 */
export function executeDrawPhase(state: GameState, rng: Rng): GameState {
  const newCards = drawCards(state.player.cards, rng);
  return {
    ...state,
    phase: 'action',
    actionsThisTurn: 0,
    bonusActionsThisTurn: state.bonusActionsNextTurn ?? 0,
    bonusActionsNextTurn: 0,
    player: { ...state.player, cards: newCards },
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Action Phase  (player-driven)
// Phase 4: Bank Phase    (player-driven)
//
// The UI calls functions in cards.ts and events.ts directly to mutate
// state during these phases. When done, it calls endBankPhase below.
// ---------------------------------------------------------------------------

/**
 * Transition out of the Action Phase: discard all remaining hand cards
 * and advance phase to 'world'. Called by the UI when the player ends their turn.
 */
export function endActionPhase(state: GameState): GameState {
  const discarded = state.player.cards.map((c) =>
    c.zone === 'hand' ? { ...c, zone: 'discard' as const } : c,
  );
  return {
    ...state,
    phase: 'world',
    player: { ...state.player, cards: discarded },
  };
}

// ---------------------------------------------------------------------------
// Phase 5: World Phase
// ---------------------------------------------------------------------------

/**
 * Execute the World Phase: apply all passive effects for the turn.
 * Advances turn counter and year at the end.
 */
export function executeWorldPhase(
  state: GameState,
  facilityDefs: Map<string, FacilityDef>,
  techDefs: Map<string, TechDef> = new Map(),
  blocDefs: Map<string, BlocDef> = new Map(),
  boardDefs: Map<string, BoardMemberDef> = new Map(),
  projectDefs: Map<string, ProjectDef> = new Map(),
): GameState {
  const { player, map } = state;

  // 0. Construction queue tick — completes builds/demolitions before output is computed.
  const nextTurn = state.turn + 1;
  const {
    updatedQueue,
    updatedFacilities: facilitiesAfterQueue,
    updatedTiles: tilesAfterQueue,
  } = tickConstructionQueue(player.constructionQueue, player.facilities, map.earthTiles, nextTurn, facilityDefs);

  // 1. Adjacency effects (Earth map only for now)
  const adjacencyEffects = computeAdjacencyEffects(
    facilitiesAfterQueue,
    facilityDefs,
    tilesAfterQueue,
  );

  // 2. Facility output (fields + resources, net of upkeep)
  const { totalFields, totalResources } = computeFacilityOutput(
    facilitiesAfterQueue,
    facilityDefs,
    adjacencyEffects,
    tilesAfterQueue,
  );

  // 2b. HQ bonus — applies if the player has an HQ facility on the map.
  //     Output varies by will profile (democratic vs authoritarian).
  //     Discovered technologies may add permanent field bonuses via hqFieldBonus.
  const hasHq = player.facilities.some((f) => f.defId === 'hq');
  if (hasHq) {
    const techFieldBonus: Partial<FieldPoints> = {};
    for (const ts of player.techs) {
      if (ts.stage !== 'discovered') continue;
      const bonus = techDefs.get(ts.defId)?.hqFieldBonus;
      if (!bonus) continue;
      for (const k of Object.keys(bonus) as (keyof FieldPoints)[]) {
        techFieldBonus[k] = (techFieldBonus[k] ?? 0) + (bonus[k] ?? 0);
      }
    }
    const hqBonus = computeHqBonus(player.willProfile, techFieldBonus);
    for (const k of Object.keys(hqBonus.resources) as (keyof Resources)[]) {
      totalResources[k] = (totalResources[k] ?? 0) + (hqBonus.resources[k] ?? 0);
    }
    for (const k of Object.keys(hqBonus.fields) as (keyof FieldPoints)[]) {
      totalFields[k] = (totalFields[k] ?? 0) + (hqBonus.fields[k] ?? 0);
    }
  }

  // 3. Board multipliers applied to facility output (includes vacant slot penalties after grace period)
  const boardMod = computeBoardModifiers(player.board, boardDefs, nextTurn, state.boardGracePeriodEnds);
  const boostedFields = applyBoardFieldMultipliers(totalFields, boardMod);
  const boostedResources = applyBoardResourceMultipliers(totalResources, boardMod);

  // 4. Bank decay
  const bankDecay = computeBankDecay(player.cards);

  // 5. Apply resource and field changes (facility output + bank decay)
  const newFields: FieldPoints = { ...ZERO_FIELDS, ...boostedFields };
  const newResources = applyResourceDeltas(
    player.resources,
    boostedResources,
    bankDecay,
    ZERO_RESOURCES,
  );

  // 6a. Breakthrough check — may promote 'unknown' techs to 'rumour' before distribution
  const activeFacilityDefIds = facilitiesAfterQueue
    .filter((f) => {
      // exclude facilities still under construction or being demolished
      const tile = tilesAfterQueue.find((t) => t.facilitySlots.some((s) => s === f.id));
      return tile ? tile.pendingActionId === null : true;
    })
    .map((f) => f.defId);
  const breakthroughs = checkBreakthroughConditions(
    player.techs, techDefs, newFields, activeFacilityDefIds,
  );
  let techsAfterBreakthroughs = player.techs.map((tech) => {
    if (breakthroughs.some((b) => b.techId === tech.defId)) {
      return { ...tech, stage: 'rumour' as const, unlockedByBreakthrough: true };
    }
    return tech;
  });

  // 6b. Distribute research points across rumour/progress techs
  const researchRng = createRng(`${state.seed}-research-t${nextTurn}`);
  const techsAfterDistribution = distributeResearchPoints(
    techsAfterBreakthroughs, techDefs, newFields, researchRng,
  );

  // 6c. Stage transitions (prerequisites + fieldProgress thresholds)
  const { updatedTechs, newDiscoveries, newRumours, newProgressTechs } = applyStageTransitions(
    techsAfterDistribution, techDefs, nextTurn, state.signal.eraStrength,
  );

  // 7. Card upgrades from newly discovered techs
  let updatedCards = player.cards;
  for (const defId of newDiscoveries) {
    const techDef = techDefs.get(defId);
    if (!techDef) continue;
    // New cards added to deck; upgrades handled via data layer in content pass
    for (const cardDefId of techDef.unlocksCards) {
      const newCard = {
        id: `${cardDefId}-t${nextTurn}`,
        defId: cardDefId,
        zone: 'deck' as const,
        bankedSinceTurn: null,
      };
      updatedCards = [...updatedCards, newCard];
    }
  }

  // 7a. Board proposal: fire if orbitalMechanics just discovered OR Space Launch Centre
  //     just completed, and the proposal has not been fired before.
  const spaceLaunchJustBuilt =
    !state.boardProposalFired &&
    facilitiesAfterQueue.some((f) => f.defId === 'spaceLaunchCentre') &&
    !player.facilities.some((f) => f.defId === 'spaceLaunchCentre');
  const orbitalMechanicsJustDiscovered =
    !state.boardProposalFired && newDiscoveries.includes('orbitalMechanics');

  const shouldFireBoardProposal = orbitalMechanicsJustDiscovered || spaceLaunchJustBuilt;
  const newBoardProposalEvent: EventInstance | null = shouldFireBoardProposal
    ? {
        id: `board-proposal-orbital-t${nextTurn}`,
        defId: 'boardProposalOrbitalStation',
        arrivedTurn: nextTurn,
        countdownRemaining: 999,
        resolved: false,
        resolvedWith: null,
      }
    : null;

  // 7b. Project tick — advance active projects, apply completions + upkeep
  // Run against a temporary state with the post-card resources so upkeep is
  // deducted from the already-updated resource total.
  const stateForProjectTick: GameState = {
    ...state,
    player: { ...player, resources: newResources, cards: updatedCards },
    signal: state.signal,
  };
  const projectTickResult = tickActiveProjects(stateForProjectTick, projectDefs, nextTurn);
  const playerAfterProjects = projectTickResult.state.player;
  const signalAfterProjects = projectTickResult.state.signal;
  const projectNews = playerAfterProjects.newsFeed.slice(player.newsFeed.length);

  // 7c. Orbital Station: scripted engineering challenge fires on stage 2's second turn.
  //     Only fires once — guarded by checking if the event is already in activeEvents.
  const stage2OnSecondTurn = playerAfterProjects.activeProjects.some(
    (p) => p.defId === 'orbitalStation_stage2' && p.turnsElapsed === 1,
  );
  const engineeringEventAlreadyFired = state.activeEvents.some(
    (e) => e.defId === 'orbitalStationEngineeringChallenge' && !e.resolved,
  );
  const engineeringChallengeEvent: EventInstance | null =
    stage2OnSecondTurn && !engineeringEventAlreadyFired
      ? {
          id: `orbital-engineering-challenge-t${nextTurn}`,
          defId: 'orbitalStationEngineeringChallenge',
          arrivedTurn: nextTurn,
          countdownRemaining: 2,
          resolved: false,
          resolvedWith: null,
        }
      : null;

  // 7d. Era transition: if a landmark project with opensEra2 completed this tick,
  //     advance era to nearSpace and apply a Will boost.
  const opensEra2 = projectTickResult.completedDefIds.some(
    (id) => projectDefs.get(id)?.landmarkGate === 'opensEra2',
  );
  const eraAfterProjects = opensEra2 && state.era === 'earth' ? ('nearSpace' as const) : state.era;
  const willBoostFromEraTransition = opensEra2 ? 30 : 0;
  const eraTransitionNews: NewsItem[] = opensEra2
    ? [
        {
          id: `era-transition-nearspace-t${nextTurn}`,
          turn: nextTurn,
          text: 'The Permanent Orbital Station is declared fully operational. Humanity has established a permanent presence in space. The Near Space era begins.',
          category: 'discovery' as const,
        },
      ]
    : [];

  // 8. News feed entries for research events
  const breakthroughNews: NewsItem[] = breakthroughs.map((b) => ({
    id: `${nextTurn}-breakthrough-${b.techId}`,
    turn: nextTurn,
    text: `Breakthrough: an unexpected convergence of research fields has revealed a new avenue of investigation.`,
    category: 'research' as const,
  }));
  const researchNews: NewsItem[] = [
    ...newRumours.map((defId) => ({
      id: `${nextTurn}-rumour-${defId}`,
      turn: nextTurn,
      text:
        techDefs.get(defId)?.rumourText ?? 'Something new is stirring in the research community.',
      category: 'research' as const,
    })),
    ...newProgressTechs.map((defId) => ({
      id: `${nextTurn}-progress-${defId}`,
      turn: nextTurn,
      text: `Research into ${techDefs.get(defId)?.name ?? 'an unknown field'} is showing concrete results.`,
      category: 'research' as const,
    })),
    ...newDiscoveries.map((defId) => ({
      id: `${nextTurn}-discovery-${defId}`,
      turn: nextTurn,
      text: `New horizons: ${techDefs.get(defId)?.name ?? 'Unknown technology'} is ready to be exploited.`,
      category: 'discovery' as const,
    })),
  ];

  // 9. Will natural drift
  const willConfig = DEFAULT_WILL_CONFIG[player.willProfile];
  const newWill = tickWill(player.will, willConfig);

  // 10. Mine depletion (applied to post-queue facilities)
  const { facilities: newFacilities, tiles: tilesAfterDepletion } = tickMineDepletion(
    facilitiesAfterQueue,
    facilityDefs,
    tilesAfterQueue,
  );

  // 11. Climate pressure — baseline + net facility impact
  const facilityClimateImpact = newFacilities.reduce((sum, inst) => {
    const def = facilityDefs.get(inst.defId);
    return sum + (def?.climateImpact ?? 0);
  }, 0);
  const newClimatePressure = Math.min(
    100,
    Math.max(0, state.climatePressure + CLIMATE_PRESSURE_PER_TURN + facilityClimateImpact),
  );

  // 12. Climate-driven tile degradation
  const rng = createRng(`${state.seed}-climate-t${nextTurn}`);
  const degradation = applyClimateDegradation(
    tilesAfterDepletion,
    newClimatePressure,
    newFacilities,
    facilityDefs,
    rng,
  );
  const degradedTiles = degradation.changed ? degradation.tiles : tilesAfterDepletion;
  const facilitiesAfterDegradation = degradation.changed ? degradation.facilities : newFacilities;
  const degradationNews: NewsItem[] = degradation.changed
    ? [{ id: `climate-deg-${nextTurn}`, turn: nextTurn, text: degradation.newsText, category: 'climate' }]
    : [];

  // 14. Bloc simulation
  const { updatedBlocs, newNewsItems: blocNews } = simulateBlocs(state.blocs, blocDefs, nextTurn);
  const mergerNews = checkBlocMergers(updatedBlocs, blocDefs, nextTurn);

  // 15. Board age ticking (retirements generate news)
  const { updatedBoard, newNewsItems: boardNews } = tickBoardAges(player.board, boardDefs, nextTurn);

  // 15b. Board proposal deferred re-surfacing: if the player deferred the proposal
  //      and the resurfaceTurn has arrived, re-queue the proposal event and add a
  //      committee notification from the active Chief Scientist.
  const proposalResurfaces =
    !state.orbitalStationAuthorised &&
    state.boardProposalFired &&
    state.orbitalStationDeferResurfaceTurn === nextTurn;

  const resurfacedProposalEvent: EventInstance | null = proposalResurfaces
    ? {
        id: `board-proposal-orbital-resurface-t${nextTurn}`,
        defId: 'boardProposalOrbitalStation',
        arrivedTurn: nextTurn,
        countdownRemaining: 999,
        resolved: false,
        resolvedWith: null,
      }
    : null;

  let committeeNotificationsAfterBoard = state.committeeNotifications;
  const chiefScientistMember = updatedBoard.chiefScientist;
  const chiefName = chiefScientistMember
    ? (boardDefs.get(chiefScientistMember.defId)?.name ?? 'The Chief Scientist')
    : 'The Chief Scientist';

  if (proposalResurfaces) {
    committeeNotificationsAfterBoard = addCommitteeNotification(
      committeeNotificationsAfterBoard,
      {
        id: `board-proposal-reminder-t${nextTurn}`,
        memberDefId: chiefScientistMember?.defId ?? 'unknown',
        text: `${chiefName} is again urging the board to authorise the Permanent Orbital Station programme. The proposal has been returned to the agenda.`,
        turnCreated: nextTurn,
        dismissed: false,
      },
    );
  }
  if (projectTickResult.completedDefIds.includes('orbitalStation_stage1')) {
    committeeNotificationsAfterBoard = addCommitteeNotification(
      committeeNotificationsAfterBoard,
      {
        id: `orbital-stage1-complete-t${nextTurn}`,
        memberDefId: chiefScientistMember?.defId ?? 'unknown',
        text: `${chiefName}: The Core Module is now in orbit. Phase one of the Orbital Station programme is complete. Construction of the Habitation Ring can begin immediately.`,
        turnCreated: nextTurn,
        dismissed: false,
      },
    );
  }
  if (projectTickResult.completedDefIds.includes('orbitalStation_stage2')) {
    committeeNotificationsAfterBoard = addCommitteeNotification(
      committeeNotificationsAfterBoard,
      {
        id: `orbital-stage2-complete-t${nextTurn}`,
        memberDefId: chiefScientistMember?.defId ?? 'unknown',
        text: `${chiefName}: The Habitation Ring has been successfully joined. The station is ready for final systems integration — one more phase and it becomes fully operational.`,
        turnCreated: nextTurn,
        dismissed: false,
      },
    );
  }
  if (opensEra2) {
    committeeNotificationsAfterBoard = addCommitteeNotification(
      committeeNotificationsAfterBoard,
      {
        id: `station-commander-slot-t${nextTurn}`,
        memberDefId: chiefScientistMember?.defId ?? 'unknown',
        text: `${chiefName}: With the Station now operational, we should appoint a Station Commander. The role is now open for recruitment.`,
        turnCreated: nextTurn,
        dismissed: false,
      },
    );
  }

  // 16. Signal progress tick — starts from post-project signal so project
  //     rewards (one-time signal boosts) are included before further ticking.
  const prevSignalProgress = state.signal.decodeProgress;
  const newSignal = tickSignalProgress(signalAfterProjects, newFields, newFacilities, facilityDefs);
  const signalNews: NewsItem[] = didCrossStrengthThreshold(
    prevSignalProgress,
    newSignal.decodeProgress,
  )
    ? [
        {
          id: `signal-${nextTurn}`,
          turn: nextTurn,
          text: signalProgressNewsText(newSignal.decodeProgress, nextTurn),
          category: 'signal' as const,
        },
      ]
    : [];

  // 17. Earth welfare tick
  const newEarthWelfare = tickEarthWelfare(state);

  // Assemble updated active events list (carry over non-resolved + any new ones)
  const eventsAfterWorld = [
    ...state.activeEvents,
    ...(newBoardProposalEvent ? [newBoardProposalEvent] : []),
    ...(resurfacedProposalEvent ? [resurfacedProposalEvent] : []),
    ...(engineeringChallengeEvent ? [engineeringChallengeEvent] : []),
  ];

  // Assemble the next state (outcome checked below)
  const nextState: GameState = {
    ...state,
    turn: nextTurn,
    year: state.year + 1,
    era: eraAfterProjects,
    phase: 'event', // reset to start of next turn
    climatePressure: newClimatePressure,
    earthWelfareScore: newEarthWelfare,
    blocs: updatedBlocs,
    signal: newSignal,
    activeEvents: eventsAfterWorld,
    map: { ...map, earthTiles: degradedTiles },
    boardProposalFired: state.boardProposalFired || shouldFireBoardProposal,
    orbitalStationAuthorised: state.orbitalStationAuthorised,
    orbitalStationDeferCount: state.orbitalStationDeferCount,
    orbitalStationDeferResurfaceTurn: proposalResurfaces ? null : state.orbitalStationDeferResurfaceTurn,
    committeeNotifications: committeeNotificationsAfterBoard,
    player: {
      ...player,
      resources: playerAfterProjects.resources,
      fields: newFields,
      will: Math.min(100, newWill + willBoostFromEraTransition),
      facilities: facilitiesAfterDegradation,
      techs: updatedTechs,
      cards: playerAfterProjects.cards,
      board: updatedBoard,
      constructionQueue: updatedQueue,
      activeProjects: playerAfterProjects.activeProjects,
      completedProjectIds: playerAfterProjects.completedProjectIds,
      newsFeed: [
        ...player.newsFeed,
        ...breakthroughNews,
        ...researchNews,
        ...projectNews,
        ...eraTransitionNews,
        ...degradationNews,
        ...blocNews,
        ...mergerNews,
        ...boardNews,
        ...signalNews,
      ],
    },
  };

  // 18. Victory / loss check (uses fully updated state)
  const outcome = nextState.outcome ?? checkVictoryConditions(nextState);
  return { ...nextState, outcome };
}
