<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import FacilityPicker from './FacilityPicker.svelte';
  import { gameStore, STUB_FACILITY_DEFS } from '../stores/game.svelte';
  import type { EarthScene as EarthSceneType } from '../../phaser/EarthScene';

  // Phaser and EarthScene are dynamically imported to avoid SSR.
  let container: HTMLDivElement;
  let game: import('phaser').Game | null = null;

  // The selected tile for facility placement (read from store).
  const selectedTile = $derived(
    gameStore.selectedCoordKey != null
      ? gameStore.state.map.earthTiles.find(
          t => `${t.coord.q},${t.coord.r}` === gameStore.selectedCoordKey,
        ) ?? null
      : null,
  );

  onMount(async () => {
    if (!browser) return;

    const [Phaser, { EarthScene }] = await Promise.all([
      import('phaser'),
      import('../../phaser/EarthScene'),
    ]);

    const scene = new EarthScene();

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width:  container.clientWidth  || 600,
      height: container.clientHeight || 400,
      backgroundColor: '#060a10',
      scene: [scene],
      // Disable the Phaser default banner in console
      banner: false,
    });

    // Wire callbacks once the scene is ready
    game.events.once('ready', () => {
      const earth = game!.scene.getScene('EarthScene') as EarthSceneType;
      earth.setCallbacks({
        getTiles:      () => gameStore.state.map.earthTiles,
        getFacilities: () => gameStore.state.player.facilities,
        getSelected:   () => gameStore.selectedCoordKey,
        getClimate:    () => gameStore.state.climatePressure,
        onTileClick:   (key: string) => {
          // Toggle selection; already-selected tile deselects
          gameStore.selectTile(gameStore.selectedCoordKey === key ? null : key);
        },
      });
    });
  });

  onDestroy(() => {
    game?.destroy(true);
    game = null;
  });
</script>

<div class="map-container" bind:this={container}>
  {#if selectedTile}
    <FacilityPicker
      tile={selectedTile}
      facilityDefs={STUB_FACILITY_DEFS}
      playerResources={gameStore.state.player.resources}
      onBuild={(defId) => gameStore.buildFacility(gameStore.selectedCoordKey!, defId)}
      onClose={() => gameStore.selectTile(null)}
    />
  {/if}
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Phaser mounts a canvas inside this div; ensure it fills the space */
  .map-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
