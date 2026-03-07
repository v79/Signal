<script lang="ts">
  import HUD             from '$lib/components/HUD.svelte';
  import EventZone       from '$lib/components/EventZone.svelte';
  import ResearchFeed    from '$lib/components/ResearchFeed.svelte';
  import BoardPanel      from '$lib/components/BoardPanel.svelte';
  import StandingActions from '$lib/components/StandingActions.svelte';
  import CardHand        from '$lib/components/CardHand.svelte';
  import MapContainer    from '$lib/components/MapContainer.svelte';
  import NewsTicker      from '$lib/components/NewsTicker.svelte';
  import PhaseControls   from '$lib/components/PhaseControls.svelte';

  import {
    gameStore,
    STUB_CARD_DEFS,
    STUB_EVENT_DEFS,
    STUB_STANDING_ACTIONS,
    STUB_BOARD_DEFS,
  } from '$lib/stores/game.svelte';
  import type { BoardRole } from '../engine/types';
  import { isSignalClimax } from '../engine/signal';

  // Generate wormhole options once when the climax is reached (deterministic seed).
  const wormholeOptions = $derived(
    isSignalClimax(gameStore.state.signal) ? gameStore.getWormholeOptions() : [],
  );

  function handleStandingAction(id: string): void {
    if (id === 'build') {
      // Prompt the player to click a tile on the map.
      // If a tile is already selected, deselect it (toggle).
      if (gameStore.selectedCoordKey != null) {
        gameStore.selectTile(null);
      }
      // Otherwise the player clicks a tile — EarthScene handles onTileClick.
    }
    // Other actions (recruit, trade, survey, negotiate) wired in later phases.
  }
</script>

<div class="game-layout">
  <!-- Top bar -->
  <HUD
    resources={gameStore.state.player.resources}
    fields={gameStore.state.player.fields}
    turn={gameStore.state.turn}
    year={gameStore.state.year}
    era={gameStore.state.era}
    phase={gameStore.state.phase}
    climatePressure={gameStore.state.climatePressure}
    will={gameStore.state.player.will}
  />

  <!-- Middle row -->
  <div class="middle-row">
    <!-- Left: active events -->
    <EventZone
      events={gameStore.state.activeEvents}
      eventDefs={STUB_EVENT_DEFS}
      onMitigate={(id) => gameStore.mitigateEvent(id)}
      onAccept={(id)   => gameStore.acceptEvent(id)}
      onDecline={(id)  => gameStore.declineEvent(id)}
    />

    <!-- Centre: Earth map (Phaser) -->
    <MapContainer />

    <!-- Right: research + board -->
    <div class="right-column">
      <ResearchFeed
        fields={gameStore.state.player.fields}
        newsFeed={gameStore.state.player.newsFeed}
        signal={gameStore.state.signal}
        {wormholeOptions}
        onCommitWormholeResponse={(id) => gameStore.commitWormholeResponse(id, wormholeOptions)}
      />
      <BoardPanel
        board={gameStore.state.player.board}
        boardDefs={STUB_BOARD_DEFS}
        phase={gameStore.state.phase}
        onRecruit={(defId) => gameStore.recruitMember(defId, 40)}
        onDismiss={(role) => gameStore.dismissMember(role as BoardRole)}
      />
    </div>
  </div>

  <!-- News ticker strip -->
  <NewsTicker items={gameStore.state.player.newsFeed} />

  <!-- Bottom row -->
  <div class="bottom-row">
    <StandingActions
      actions={STUB_STANDING_ACTIONS}
      restrictions={gameStore.state.player.activeEventRestrictions}
      turn={gameStore.state.turn}
      phase={gameStore.state.phase}
      playerResources={gameStore.state.player.resources}
      onAction={handleStandingAction}
    />

    <CardHand
      cards={gameStore.state.player.cards}
      cardDefs={STUB_CARD_DEFS}
      phase={gameStore.state.phase}
      onPlay={(id)   => gameStore.playCard(id)}
      onBank={(id)   => gameStore.bankCard(id)}
      onUnbank={(id) => gameStore.unbankCard(id)}
    />

    <PhaseControls
      phase={gameStore.state.phase}
      turn={gameStore.state.turn}
      onAdvance={() => gameStore.advancePhase()}
    />
  </div>
</div>

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
