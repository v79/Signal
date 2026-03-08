<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import HUD             from '$lib/components/HUD.svelte';
  import EventZone       from '$lib/components/EventZone.svelte';
  import ResearchFeed    from '$lib/components/ResearchFeed.svelte';
  import BoardPanel      from '$lib/components/BoardPanel.svelte';
  import StandingActions from '$lib/components/StandingActions.svelte';
  import CardHand        from '$lib/components/CardHand.svelte';
  import MapContainer    from '$lib/components/MapContainer.svelte';
  import NewsTicker      from '$lib/components/NewsTicker.svelte';
  import PhaseControls   from '$lib/components/PhaseControls.svelte';

  import { gameStore } from '$lib/stores/game.svelte';
  import { CARD_DEFS } from '../data/cards';
  import { EVENT_DEFS } from '../data/events';
  import { STANDING_ACTIONS } from '../data/standingActions';
  import { BOARD_DEFS } from '../data/board';
  import type { BoardRole } from '../engine/types';
  import { isSignalClimax } from '../engine/signal';

  // Redirect to /newgame if there is no active game state (cold start).
  onMount(() => {
    if (!gameStore.state) goto('/newgame');
  });

  // Generate wormhole options once when the climax is reached (deterministic seed).
  const wormholeOptions = $derived(
    gameStore.state && isSignalClimax(gameStore.state.signal) ? gameStore.getWormholeOptions() : [],
  );

  function handleStandingAction(id: string): void {
    if (id === 'build') {
      if (gameStore.selectedCoordKey != null) {
        gameStore.selectTile(null);
      }
    }
  }
</script>

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
      onExport={() => gameStore.exportSave()}
      onImport={(file) => gameStore.importSaveFile(file)}
      onRestart={() => gameStore.startNewGame(gs.seed, gs.player.blocDefId, gs.pushFactor)}
      onNewGame={() => gameStore.resetGame()}
      onSettings={() => {}}
    />

    <!-- Middle row -->
    <div class="middle-row">
      <!-- Left: active events -->
      <EventZone
        events={gs.activeEvents}
        eventDefs={EVENT_DEFS}
        onMitigate={(id) => gameStore.mitigateEvent(id)}
        onAccept={(id)   => gameStore.acceptEvent(id)}
        onDecline={(id)  => gameStore.declineEvent(id)}
      />

      <!-- Centre: Earth map (Phaser) -->
      <MapContainer />

      <!-- Right: research + board -->
      <div class="right-column">
        <ResearchFeed
          fields={gs.player.fields}
          newsFeed={gs.player.newsFeed}
          signal={gs.signal}
          {wormholeOptions}
          onCommitWormholeResponse={(id) => gameStore.commitWormholeResponse(id, wormholeOptions)}
        />
        <BoardPanel
          board={gs.player.board}
          boardDefs={BOARD_DEFS}
          phase={gs.phase}
          onRecruit={(defId) => gameStore.recruitMember(defId, 40)}
          onDismiss={(role) => gameStore.dismissMember(role as BoardRole)}
        />
      </div>
    </div>

    <!-- News ticker strip -->
    <NewsTicker items={gs.player.newsFeed} />

    <!-- Bottom row -->
    <div class="bottom-row">
      <StandingActions
        actions={STANDING_ACTIONS}
        restrictions={gs.player.activeEventRestrictions}
        turn={gs.turn}
        phase={gs.phase}
        playerResources={gs.player.resources}
        onAction={handleStandingAction}
      />

      <CardHand
        cards={gs.player.cards}
        cardDefs={CARD_DEFS}
        phase={gs.phase}
        onPlay={(id)   => gameStore.playCard(id)}
        onBank={(id)   => gameStore.bankCard(id)}
        onUnbank={(id) => gameStore.unbankCard(id)}
      />

      <PhaseControls
        phase={gs.phase}
        turn={gs.turn}
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
    grid-template-columns: 17rem 1fr 16rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .right-column {
    display: grid;
    grid-template-rows: 1fr 1fr;
    overflow: hidden;
    min-height: 0;
  }

  .bottom-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    border-top: 1px solid #1e2530;
    flex-shrink: 0;
    max-height: 14rem;
    overflow: hidden;
  }
</style>
