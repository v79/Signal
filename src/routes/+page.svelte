<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import HUD from '$lib/components/HUD.svelte';
  import EventZone from '$lib/components/EventZone.svelte';
  import ResearchFeed from '$lib/components/ResearchFeed.svelte';
  import TechProgressSummary from '$lib/components/TechProgressSummary.svelte';
  import TechTreeModal from '$lib/components/TechTreeModal.svelte';
  import SignalTrack from '$lib/components/SignalTrack.svelte';
  import ScienceNewsFeed from '$lib/components/ScienceNewsFeed.svelte';
  import OngoingActionsPanel from '$lib/components/OngoingActionsPanel.svelte';
  import CardHand from '$lib/components/CardHand.svelte';
  import MapContainer from '$lib/components/MapContainer.svelte';
  import NewsTicker from '$lib/components/NewsTicker.svelte';
  import PhaseControls from '$lib/components/PhaseControls.svelte';
  import NarrativeModal from '$lib/components/NarrativeModal.svelte';

  import { gameStore } from '$lib/stores/game.svelte';
  import { CARD_DEFS, EVENT_DEFS, FACILITY_DEFS, BLOC_DEFS, TECH_DEFS, PROJECT_DEFS, BOARD_DEFS } from '../data/loader';
  import { getActiveMembers } from '../engine/board';
  import type { BoardRole } from '../engine/types';
  import { getAvailableProjects } from '../engine/projects';
  import {
    computeAdjacencyEffects,
    computeResourceBreakdown,
    computeClimateBreakdown,
    type ResourceBreakdown,
    type ClimateBreakdown,
  } from '../engine/facilities';
  import { CLIMATE_PRESSURE_PER_TURN } from '../engine/turn';
  import { computeBankDecay, tickWill, DEFAULT_WILL_CONFIG } from '../engine/resources';
  import { isSignalClimax } from '../engine/signal';
  // Redirect to /newgame if there is no active game state (cold start).
  // Also register back-button / unload guards during the action phase.
  function beforeUnloadHandler(e: BeforeUnloadEvent): string | undefined {
    if (gameStore.state?.phase === 'action') {
      e.preventDefault();
      return (e.returnValue = 'Game in progress — leave and lose unsaved turn?');
    }
  }

  function popstateHandler(): void {
    if (gameStore.state?.phase === 'action') {
      const leave = window.confirm('Game in progress — leave and lose unsaved turn?');
      if (!leave) {
        // Push the current URL back so the browser URL doesn't change.
        history.pushState(null, '', window.location.href);
      }
    }
  }

  onMount(() => {
    if (!gameStore.state) goto('/newgame');
    window.addEventListener('beforeunload', beforeUnloadHandler);
    window.addEventListener('popstate', popstateHandler);
    // Ensure there is a history entry to intercept popstate.
    history.pushState(null, '', window.location.href);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    window.removeEventListener('popstate', popstateHandler);
  });

  const resourceBreakdown = $derived<ResourceBreakdown>(
    gameStore.state
      ? computeResourceBreakdown(
          gameStore.state.player.facilities,
          FACILITY_DEFS,
          computeAdjacencyEffects(
            gameStore.state.player.facilities,
            FACILITY_DEFS,
            gameStore.state.map.earthTiles,
          ),
          gameStore.state.map.earthTiles,
          {
            bankDecay: computeBankDecay(gameStore.state.player.cards),
            drift:
              tickWill(
                gameStore.state.player.will,
                DEFAULT_WILL_CONFIG[gameStore.state.player.willProfile],
              ) - gameStore.state.player.will,
          },
          gameStore.state.launchAllocation,
          gameStore.state.map.spaceNodes,
          gameStore.state.isruOperational,
        )
      : { funding: [], materials: [], politicalWill: [] },
  );

  const climateBreakdown = $derived<ClimateBreakdown>(
    gameStore.state
      ? computeClimateBreakdown(gameStore.state.player.facilities, FACILITY_DEFS, CLIMATE_PRESSURE_PER_TURN)
      : { base: CLIMATE_PRESSURE_PER_TURN, entries: [] },
  );

  // Generate wormhole options once when the climax is reached (deterministic seed).
  const wormholeOptions = $derived(
    gameStore.state && isSignalClimax(gameStore.state.signal) ? gameStore.getWormholeOptions() : [],
  );

  let showTechTree = $state(false);
  let hasNewResearch = $state(false);
  // Plain JS counter (not reactive) to avoid effect loops
  let _knownResearchCount = 0;

  $effect(() => {
    if (!gameStore.state) return;
    const count = gameStore.state.player.techs.filter(
      (t) => t.stage === 'rumour' || t.stage === 'progress',
    ).length;
    if (count > _knownResearchCount) {
      hasNewResearch = true;
    }
    _knownResearchCount = count;
  });

  // Available projects (filtered from full project pool based on current state).
  const availableProjects = $derived(
    gameStore.state ? getAvailableProjects(gameStore.state, PROJECT_DEFS) : [],
  );

  // Actions remaining this turn.
  const actionsRemaining = $derived(
    gameStore.state
      ? (gameStore.state.maxActionsPerTurn ?? 3) + (gameStore.state.bonusActionsThisTurn ?? 0) - (gameStore.state.actionsThisTurn ?? 0)
      : 0,
  );

  // Roles filled by currently active board members — used to gate board-required cards.
  const activeBoardRoles = $derived(
    gameStore.state
      ? new Set<BoardRole>(
          getActiveMembers(gameStore.state.player.board)
            .map((m) => BOARD_DEFS.get(m.defId)?.role)
            .filter((r): r is BoardRole => r !== undefined),
        )
      : new Set<BoardRole>(),
  );

  // Tags of active counterable events — used to highlight matching counter cards in hand.
  const counterableTags = $derived(
    gameStore.state
      ? gameStore.state.activeEvents
          .filter((e) => {
            if (e.resolved) return false;
            const tier = EVENT_DEFS.get(e.defId)?.responseTier;
            return tier === 'fullCounter' || tier === 'partialMitigation';
          })
          .flatMap((e) => EVENT_DEFS.get(e.defId)?.tags ?? [])
      : [],
  );

</script>

{#if gameStore.state && gameStore.state.narrativeQueue.length > 0}
  {#key gameStore.state.narrativeQueue[0].id}
    <NarrativeModal
      narrative={gameStore.state.narrativeQueue[0]}
      onDismiss={() => gameStore.dismissNarrativeModal()}
    />
  {/key}
{/if}

{#if showTechTree && gameStore.state}
  <TechTreeModal
    techs={gameStore.state.player.techs}
    techDefs={TECH_DEFS}
    signal={gameStore.state.signal}
    cardDefs={CARD_DEFS}
    facilityDefs={FACILITY_DEFS}
    era={gameStore.state.era}
    turn={gameStore.state.turn}
    year={gameStore.state.year}
    onClose={() => {
      showTechTree = false;
      hasNewResearch = false;
    }}
  />
{/if}

{#if gameStore.state}
  {@const gs = gameStore.state}
  <div class="game-layout">
    <!-- Top bar -->
    <HUD
      resources={gs.player.resources}
      fields={gs.player.fields}
      turn={gs.turn}
      year={gs.year}
      era={gs.era}
      phase={gs.phase}
      climatePressure={gs.climatePressure}
      will={gs.player.will}
      seed={gs.seed}
      blocName={BLOC_DEFS.get(gs.player.blocDefId)?.name ?? ''}
      {resourceBreakdown}
      {climateBreakdown}
      onExport={() => gameStore.exportSave()}
      onImport={(file) => gameStore.importSaveFile(file)}
      onRestart={() => gameStore.startNewGame(gs.seed, gs.player.blocDefId, gs.pushFactor)}
      onNewGame={() => gameStore.resetGame()}
      onSettings={() => {}}
    />

    <!-- Middle row -->
    <div class="middle-row">
      <!-- Left column: events + ongoing construction + standing actions -->
      <div class="left-column">
        <EventZone
          events={gs.activeEvents}
          eventDefs={EVENT_DEFS}
          currentTurn={gs.turn}
          onMitigate={(id) => gameStore.mitigateEvent(id)}
          onAccept={(id) => gameStore.acceptEvent(id)}
          onDefer={(id) => gameStore.deferBoardProposal(id)}
        />

        <OngoingActionsPanel
          queue={gs.player.constructionQueue}
          facilityDefs={FACILITY_DEFS}
          availableProjects={gs.phase === 'action' ? availableProjects : []}
          activeProjects={gs.player.activeProjects}
          projectDefs={PROJECT_DEFS}
          completedProjectIds={gs.player.completedProjectIds}
          actionsRemaining={actionsRemaining}
          onInitiateProject={(defId) => gameStore.initiateProject(defId)}
        />

      </div>

      <!-- Centre: Earth map (Phaser) -->
      <MapContainer />

      <!-- Right column: signal track + tech tree + in-progress research -->
      <div class="right-column">
        <SignalTrack signal={gs.signal} era={gs.era} techs={gs.player.techs} />

        <button
          class="tree-btn"
          onclick={() => {
            showTechTree = true;
            hasNewResearch = false;
          }}
        >
          TECH TREE
          {#if hasNewResearch}
            <span class="new-dot"></span>
          {/if}
        </button>

        <ScienceNewsFeed items={gs.player.newsFeed} />

        <TechProgressSummary techs={gs.player.techs} techDefs={TECH_DEFS} />

        <ResearchFeed
          signal={gs.signal}
          {wormholeOptions}
          onCommitWormholeResponse={(id) => gameStore.commitWormholeResponse(id, wormholeOptions)}
        />
      </div>
    </div>

    <!-- News ticker strip (click to open popup) -->
    <NewsTicker items={gs.player.newsFeed} />

    <!-- Bottom row: card hand + phase controls -->
    <div class="bottom-row">
      <CardHand
        cards={gs.player.cards}
        cardDefs={CARD_DEFS}
        phase={gs.phase}
        activeEventTags={counterableTags}
        actionsThisTurn={gs.actionsThisTurn ?? 0}
        maxActionsPerTurn={(gs.maxActionsPerTurn ?? 3) + (gs.bonusActionsThisTurn ?? 0)}
        playerResources={gs.player.resources}
        activeBoardRoles={activeBoardRoles}
        onPlay={(id) => gameStore.playCard(id)}
        onBank={(id) => gameStore.bankCard(id)}
        onUnbank={(id) => gameStore.unbankCard(id)}
      />

      <PhaseControls
        phase={gs.phase}
        actionsThisTurn={gs.actionsThisTurn ?? 0}
        maxActionsPerTurn={(gs.maxActionsPerTurn ?? 3) + (gs.bonusActionsThisTurn ?? 0)}
        onAdvance={() => gameStore.advancePhase()}
      />
    </div>
  </div>
{/if}

<style>
  .game-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .middle-row {
    display: grid;
    grid-template-columns: 17rem 1fr 20rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .left-column {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid #1e2530;
    min-height: 0;
  }

  .right-column {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .tree-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    position: relative;
    flex-shrink: 0;
    width: 100%;
    background: #0a1218;
    border: none;
    border-top: 1px solid #1e2530;
    border-bottom: 1px solid #1e2530;
    border-left: 1px solid #1e2530;
    color: #4a7888;
    font-family: var(--ff-mono);
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    padding: 0.55rem 0;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .tree-btn:hover {
    color: #8aacca;
    background: #0d1820;
  }

  .new-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ab8d8;
    box-shadow: 0 0 6px #4ab8d8;
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .bottom-row {
    display: grid;
    grid-template-columns: 1fr auto;
    border-top: 1px solid #1e2530;
    flex-shrink: 0;
    max-height: 16rem;
    overflow: hidden;
  }
</style>
