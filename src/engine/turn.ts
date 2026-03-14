import type {
  GameState,
  FacilityDef,
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
} from './board';
import { tickSignalProgress, didCrossStrengthThreshold, signalProgressNewsText } from './signal';
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

const CLIMATE_PRESSURE_PER_TURN = 0.5;

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
    const result = applyEventEffect(effect, updatedPlayer, updatedTiles, state.turn);
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
): GameState {
  const { player, map } = state;

  // 0. Construction queue tick — completes builds/demolitions before output is computed.
  const nextTurn = state.turn + 1;
  const {
    updatedQueue,
    updatedFacilities: facilitiesAfterQueue,
    updatedTiles: tilesAfterQueue,
  } = tickConstructionQueue(player.constructionQueue, player.facilities, map.earthTiles, nextTurn);

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
  const hasHq = player.facilities.some((f) => f.defId === 'hq');
  if (hasHq) {
    const hqBonus = computeHqBonus(player.willProfile);
    for (const k of Object.keys(hqBonus.resources) as (keyof Resources)[]) {
      totalResources[k] = (totalResources[k] ?? 0) + (hqBonus.resources[k] ?? 0);
    }
    for (const k of Object.keys(hqBonus.fields) as (keyof FieldPoints)[]) {
      totalFields[k] = (totalFields[k] ?? 0) + (hqBonus.fields[k] ?? 0);
    }
  }

  // 3. Board multipliers applied to facility output
  const boardMod = computeBoardModifiers(player.board, boardDefs);
  const boostedFields = applyBoardFieldMultipliers(totalFields, boardMod);
  const boostedResources = applyBoardResourceMultipliers(totalResources, boardMod);

  // 4. Bank decay and project upkeep
  const bankDecay = computeBankDecay(player.cards);
  const projectUpkeep = ZERO_RESOURCES; // Phase 4 extended: wire in actual project upkeep

  // 5. Apply resource and field changes
  const newFields: FieldPoints = { ...ZERO_FIELDS, ...boostedFields };
  const newResources = applyResourceDeltas(
    player.resources,
    boostedResources,
    bankDecay,
    projectUpkeep,
  );

  // 6a. Breakthrough check — may promote 'unknown' techs to 'rumour' before distribution
  const activeFacilityDefIds = facilitiesAfterQueue
    .filter((f) => {
      // exclude facilities still under construction or being demolished
      const tile = tilesAfterQueue.find((t) => t.facilityId === f.id);
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
      text: `Breakthrough: ${techDefs.get(defId)?.name ?? 'Unknown technology'} has been achieved.`,
      category: 'discovery' as const,
    })),
  ];

  // 9. Will natural drift
  const willConfig = DEFAULT_WILL_CONFIG[player.willProfile];
  const newWill = tickWill(player.will, willConfig);

  // 10. Mine depletion (applied to post-queue facilities)
  const newFacilities = tickMineDepletion(facilitiesAfterQueue, facilityDefs);

  // 11. Climate pressure
  const newClimatePressure = Math.min(100, state.climatePressure + CLIMATE_PRESSURE_PER_TURN);

  // 12. Bloc simulation
  const { updatedBlocs, newNewsItems: blocNews } = simulateBlocs(state.blocs, blocDefs, nextTurn);
  const mergerNews = checkBlocMergers(updatedBlocs, blocDefs, nextTurn);

  // 13. Board age ticking (retirements generate news)
  const { updatedBoard, newNewsItems: boardNews } = tickBoardAges(player.board, nextTurn);

  // 14. Signal progress tick
  const prevSignalProgress = state.signal.decodeProgress;
  const newSignal = tickSignalProgress(state.signal, newFields, newFacilities, facilityDefs);
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

  // 15. Earth welfare tick
  const newEarthWelfare = tickEarthWelfare(state);

  // Assemble the next state (outcome checked below)
  const nextState: GameState = {
    ...state,
    turn: nextTurn,
    year: state.year + 1,
    phase: 'event', // reset to start of next turn
    climatePressure: newClimatePressure,
    earthWelfareScore: newEarthWelfare,
    blocs: updatedBlocs,
    signal: newSignal,
    map: { ...map, earthTiles: tilesAfterQueue },
    player: {
      ...player,
      resources: newResources,
      fields: newFields,
      will: newWill,
      facilities: newFacilities,
      techs: updatedTechs,
      cards: updatedCards,
      board: updatedBoard,
      constructionQueue: updatedQueue,
      newsFeed: [
        ...player.newsFeed,
        ...breakthroughNews,
        ...researchNews,
        ...blocNews,
        ...mergerNews,
        ...boardNews,
        ...signalNews,
      ],
    },
  };

  // 16. Victory / loss check (uses fully updated state)
  const outcome = nextState.outcome ?? checkVictoryConditions(nextState);
  return { ...nextState, outcome };
}
