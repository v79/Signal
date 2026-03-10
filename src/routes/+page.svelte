<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import HUD from '$lib/components/HUD.svelte';
  import EventZone from '$lib/components/EventZone.svelte';
  import ResearchFeed from '$lib/components/ResearchFeed.svelte';
  import BoardPanel from '$lib/components/BoardPanel.svelte';
  import SignalTrack from '$lib/components/SignalTrack.svelte';
  import StandingActions from '$lib/components/StandingActions.svelte';
  import OngoingActionsPanel from '$lib/components/OngoingActionsPanel.svelte';
  import CardHand from '$lib/components/CardHand.svelte';
  import MapContainer from '$lib/components/MapContainer.svelte';
  import NewsTicker from '$lib/components/NewsTicker.svelte';
  import PhaseControls from '$lib/components/PhaseControls.svelte';
  import NarrativeModal from '$lib/components/NarrativeModal.svelte';

  import { gameStore } from '$lib/stores/game.svelte';
  import { CARD_DEFS } from '../data/cards';
  import { EVENT_DEFS } from '../data/events';
  import { STANDING_ACTIONS } from '../data/standingActions';
  import { BOARD_DEFS } from '../data/board';
  import { FACILITY_DEFS } from '../data/facilities';
  import { TECH_DEFS } from '../data/technologies';
  import {
    computeAdjacencyEffects,
    computeResourceBreakdown,
    type ResourceBreakdown,
  } from '../engine/facilities';
  import type { BoardRole } from '../engine/types';
  import { isSignalClimax } from '../engine/signal';
  // Redirect to /newgame if there is no active game state (cold start).
  onMount(() => {
    if (!gameStore.state) goto('/newgame');
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
        )
      : { funding: [], materials: [], politicalWill: [] },
  );

  // Generate wormhole options once when the climax is reached (deterministic seed).
  const wormholeOptions = $derived(
    gameStore.state && isSignalClimax(gameStore.state.signal) ? gameStore.getWormholeOptions() : [],
  );

  let rightTab = $state<'research' | 'board'>('research');

  // Tags of active fullCounter events — used to highlight matching counter cards in hand.
  const counterableTags = $derived(
    gameStore.state
      ? gameStore.state.activeEvents
          .filter(
            (e) => !e.resolved && EVENT_DEFS.get(e.defId)?.responseTier === 'fullCounter',
          )
          .flatMap((e) => EVENT_DEFS.get(e.defId)?.tags ?? [])
      : [],
  );

  function handleStandingAction(id: string): void {
    if (id === 'build') {
      if (gameStore.selectedCoordKey != null) {
        gameStore.selectTile(null);
      }
    } else if (id === 'emergencyAppeal') {
      gameStore.emergencyAppeal();
    }
  }
</script>

{#if gameStore.state && gameStore.state.narrativeQueue.length > 0}
  <NarrativeModal
    narrative={gameStore.state.narrativeQueue[0]}
    onDismiss={() => gameStore.dismissNarrativeModal()}
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
      {resourceBreakdown}
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
        />

        {#if gs.player.constructionQueue.length > 0}
          <OngoingActionsPanel queue={gs.player.constructionQueue} facilityDefs={FACILITY_DEFS} />
        {/if}

        <StandingActions
          actions={STANDING_ACTIONS}
          restrictions={gs.player.activeEventRestrictions}
          turn={gs.turn}
          phase={gs.phase}
          playerResources={gs.player.resources}
          onAction={handleStandingAction}
        />
      </div>

      <!-- Centre: Earth map (Phaser) -->
      <MapContainer />

      <!-- Right column: signal track + tabbed research/board -->
      <div class="right-column">
        <SignalTrack signal={gs.signal} />

        <div class="panel-tabs">
          <button
            class="tab-btn"
            class:active={rightTab === 'research'}
            onclick={() => (rightTab = 'research')}>RESEARCH</button
          >
          <button
            class="tab-btn"
            class:active={rightTab === 'board'}
            onclick={() => (rightTab = 'board')}>BOARD</button
          >
        </div>

        {#if rightTab === 'research'}
          <ResearchFeed
            fields={gs.player.fields}
            signal={gs.signal}
            techs={gs.player.techs}
            techDefs={TECH_DEFS}
            cardDefs={CARD_DEFS}
            facilityDefs={FACILITY_DEFS}
            {wormholeOptions}
            onCommitWormholeResponse={(id) => gameStore.commitWormholeResponse(id, wormholeOptions)}
          />
        {:else}
          <BoardPanel
            board={gs.player.board}
            boardDefs={BOARD_DEFS}
            phase={gs.phase}
            onRecruit={(defId) => gameStore.recruitMember(defId, 40)}
            onDismiss={(role) => gameStore.dismissMember(role as BoardRole)}
          />
        {/if}
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
        maxActionsPerTurn={gs.maxActionsPerTurn ?? 3}
        onPlay={(id) => gameStore.playCard(id)}
        onBank={(id) => gameStore.bankCard(id)}
        onUnbank={(id) => gameStore.unbankCard(id)}
      />

      <PhaseControls phase={gs.phase} onAdvance={() => gameStore.advancePhase()} />
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

  .panel-tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid #1e2530;
    background: #0c1018;
    border-left: 1px solid #1e2530;
  }

  .tab-btn {
    flex: 1;
    background: none;
    border: none;
    border-right: 1px solid #1e2530;
    color: #4a6070;
    font-family: monospace;
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    padding: 0.4rem 0;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .tab-btn:last-child {
    border-right: none;
  }

  .tab-btn:hover {
    color: #8aacca;
    background: #0f1820;
  }

  .tab-btn.active {
    color: #8aacca;
    background: #0a1420;
    border-bottom: 2px solid #2a6090;
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
