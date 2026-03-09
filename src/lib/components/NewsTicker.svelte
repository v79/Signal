<script lang="ts">
  import type { NewsItem } from '../../engine/types';

  let { items }: { items: NewsItem[] } = $props();

  // Keep only the most recent 20 items, newest first
  const recent = $derived([...items].reverse().slice(0, 20));

  // Build the ticker text — duplicate for seamless loop
  const tickerText = $derived(
    recent.length === 0
      ? 'SIGNAL INTELLIGENCE NETWORK — NO DISPATCHES'
      : recent.map((i) => `T${i.turn}: ${i.text}`).join('   ·   '),
  );

  let showPopup = $state(false);
  let tickerEl: HTMLDivElement | undefined = $state();
  let popupStyle = $state('');

  function openPopup() {
    if (tickerEl) {
      const rect = tickerEl.getBoundingClientRect();
      popupStyle = `bottom: ${window.innerHeight - rect.top}px; left: ${rect.left}px; width: ${rect.width}px;`;
    }
    showPopup = true;
  }

  function closePopup() {
    showPopup = false;
  }
</script>

{#if showPopup}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="popup-backdrop" onclick={closePopup}></div>
  <div class="news-popup" style={popupStyle}>
    <div class="popup-header">
      <span class="popup-title">DISPATCHES</span>
      <button class="popup-close" onclick={closePopup}>✕</button>
    </div>
    <div class="popup-list">
      {#each recent as item (item.id)}
        <div class="popup-item">
          <span class="popup-turn">T{item.turn}</span>
          <span class="popup-text">{item.text}</span>
        </div>
      {/each}
      {#if recent.length === 0}
        <div class="popup-empty">No dispatches yet.</div>
      {/if}
    </div>
  </div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="ticker-wrap"
  aria-live="polite"
  aria-label="News ticker — click to view all dispatches"
  bind:this={tickerEl}
  onclick={openPopup}
>
  <span class="ticker-label">DISPATCH</span>
  <div class="ticker-track">
    <span class="ticker-content">
      {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
    </span>
  </div>
</div>

<style>
  .ticker-wrap {
    display: flex;
    align-items: center;
    gap: 0;
    height: 1.6rem;
    background: #080c14;
    border-top: 1px solid #1a2530;
    border-bottom: 1px solid #1a2530;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
  }

  .ticker-wrap:hover .ticker-label {
    color: #aacce8;
  }

  .ticker-label {
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    color: #8aacca;
    padding: 0 0.6rem;
    border-right: 1px solid #1a2530;
    height: 100%;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    background: #060a10;
    transition: color 0.15s;
  }

  .ticker-track {
    flex: 1;
    overflow: hidden;
    height: 100%;
    display: flex;
    align-items: center;
  }

  .ticker-content {
    display: inline-block;
    white-space: nowrap;
    font-size: 0.68rem;
    color: #7a9eb8;
    letter-spacing: 0.05em;
    padding-left: 100%;
    animation: ticker-scroll 60s linear infinite;
  }

  @keyframes ticker-scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .popup-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .news-popup {
    position: fixed;
    z-index: 201;
    background: #0a1018;
    border: 1px solid #1e2d40;
    border-bottom: none;
    display: flex;
    flex-direction: column;
    max-height: 20rem;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.6);
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #1a2530;
    flex-shrink: 0;
  }

  .popup-title {
    font-size: 0.62rem;
    letter-spacing: 0.2em;
    color: #5a7890;
  }

  .popup-close {
    background: none;
    border: none;
    color: #4a6070;
    font-size: 0.65rem;
    cursor: pointer;
    padding: 0 0.2rem;
    line-height: 1;
  }

  .popup-close:hover {
    color: #8aaabb;
  }

  .popup-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.6rem;
  }

  .popup-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .popup-turn {
    color: #4a6878;
    font-size: 0.62rem;
    flex-shrink: 0;
    padding-top: 0.05rem;
    font-variant-numeric: tabular-nums;
  }

  .popup-text {
    color: #7a8a98;
    flex: 1;
    min-width: 0;
  }

  .popup-empty {
    color: #3a4050;
    font-size: 0.68rem;
    font-style: italic;
  }
</style>
