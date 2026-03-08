<script lang="ts">
  import type { NewsItem } from '../../engine/types';

  let { items }: { items: NewsItem[] } = $props();

  // Keep only the most recent 20 items, newest first
  const recent = $derived([...items].reverse().slice(0, 20));

  // Build the ticker text — duplicate for seamless loop
  const tickerText = $derived(
    recent.length === 0
      ? 'SIGNAL INTELLIGENCE NETWORK — NO DISPATCHES'
      : recent.map(i => `T${i.turn}: ${i.text}`).join('   ·   '),
  );
</script>

<div class="ticker-wrap" aria-live="polite" aria-label="News ticker">
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
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
</style>
