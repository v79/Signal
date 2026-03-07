<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // Phaser is imported dynamically to avoid SSR (Phaser uses browser APIs).
  // The game instance is initialised in onMount and destroyed in onDestroy.
  let container: HTMLDivElement;
  let game: import('phaser').Game | null = null;

  onMount(async () => {
    if (!browser) return;

    const Phaser = await import('phaser');

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: '100%',
      height: '100%',
      backgroundColor: '#0a0a0f',
      scene: [],
    });
  });

  onDestroy(() => {
    game?.destroy(true);
    game = null;
  });
</script>

<div class="map-container" bind:this={container}></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
