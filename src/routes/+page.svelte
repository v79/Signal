<script lang="ts">
  import HUD             from '$lib/components/HUD.svelte';
  import EventZone       from '$lib/components/EventZone.svelte';
  import ResearchFeed    from '$lib/components/ResearchFeed.svelte';
  import StandingActions from '$lib/components/StandingActions.svelte';
  import CardHand        from '$lib/components/CardHand.svelte';

  import {
    gameStore,
    STUB_CARD_DEFS,
    STUB_EVENT_DEFS,
    STUB_STANDING_ACTIONS,
  } from '$lib/stores/game.svelte';
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

    <!-- Centre: map placeholder (Phase 5) -->
    <div class="map-placeholder">
      <span class="map-placeholder-text">MAP</span>
      <span class="map-placeholder-sub">Earth surface layer renders here in Phase 5.</span>
    </div>

    <!-- Right: research fields + news feed -->
    <ResearchFeed
      fields={gameStore.state.player.fields}
      newsFeed={gameStore.state.player.newsFeed}
      signal={gameStore.state.signal}
    />
  </div>

  <!-- Bottom row -->
  <div class="bottom-row">
    <StandingActions
      actions={STUB_STANDING_ACTIONS}
      restrictions={gameStore.state.player.activeEventRestrictions}
      turn={gameStore.state.turn}
      phase={gameStore.state.phase}
      playerResources={gameStore.state.player.resources}
      onAction={(id) => console.log('Standing action:', id)}
    />

    <CardHand
      cards={gameStore.state.player.cards}
      cardDefs={STUB_CARD_DEFS}
      phase={gameStore.state.phase}
      onPlay={(id)   => gameStore.playCard(id)}
      onBank={(id)   => gameStore.bankCard(id)}
      onUnbank={(id) => gameStore.unbankCard(id)}
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

  .map-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: #070b10;
    border-right: 1px solid #1e2530;
  }

  .map-placeholder-text {
    font-size: 1.5rem;
    letter-spacing: 0.5em;
    color: #1a2530;
  }

  .map-placeholder-sub {
    font-size: 0.68rem;
    color: #2a3545;
    letter-spacing: 0.08em;
    max-width: 20rem;
    text-align: center;
    line-height: 1.5;
  }

  .bottom-row {
    display: grid;
    grid-template-columns: auto 1fr;
    border-top: 1px solid #1e2530;
    flex-shrink: 0;
    max-height: 14rem;
    overflow: hidden;
  }
</style>
