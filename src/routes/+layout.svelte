<script lang="ts">
  import type { Snippet } from 'svelte';
  import '../styles/index.css';

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Signal: The Game</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
</svelte:head>

<div class="app">
  {@render children()}
</div>

<style>
  .app {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
