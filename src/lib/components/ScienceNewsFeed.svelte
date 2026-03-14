<script lang="ts">
  import type { NewsItem } from '../../engine/types';

  let { items }: { items: NewsItem[] } = $props();

  const SCIENCE_CATEGORIES = new Set(['research', 'discovery', 'signal']);

  // Most recent science-related items, newest first, capped at 12
  const scienceItems = $derived(
    [...items]
      .filter((i) => SCIENCE_CATEGORIES.has(i.category ?? ''))
      .reverse()
      .slice(0, 12),
  );
</script>

<div class="science-feed">
  <div class="feed-header">RESEARCH LOG</div>
  <div class="feed-list">
    {#if scienceItems.length === 0}
      <div class="feed-empty">No research events yet.</div>
    {:else}
      {#each scienceItems as item (item.id)}
        <div class="feed-item cat-{item.category}">
          <span class="feed-turn">T{item.turn}</span>
          <span class="feed-text">{item.text}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .science-feed {
    display: flex;
    flex-direction: column;
    border-top: 1px solid #1e2530;
    border-bottom: 1px solid #1e2530;
    min-height: 0;
    flex: 1;
    overflow: hidden;
  }

  .feed-header {
    font-size: 0.58rem;
    letter-spacing: 0.18em;
    color: #3a5060;
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid #141c26;
    flex-shrink: 0;
    background: #060a10;
  }

  .feed-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-height: 0;
  }

  .feed-item {
    display: flex;
    gap: 0.4rem;
    padding: 0.25rem 0.6rem;
    line-height: 1.4;
    flex-shrink: 0;
  }

  .feed-turn {
    color: #2a3a48;
    font-size: 0.58rem;
    flex-shrink: 0;
    padding-top: 0.05rem;
    font-variant-numeric: tabular-nums;
  }

  .feed-text {
    font-size: 0.62rem;
    flex: 1;
    min-width: 0;
  }

  /* Category colours */
  .cat-research .feed-text {
    color: #6a8aaa;
  }
  .cat-research .feed-turn {
    color: #2a4a60;
  }

  .cat-discovery {
    background: #060c18;
  }
  .cat-discovery .feed-text {
    color: #6ab0d8;
  }
  .cat-discovery .feed-turn {
    color: #1a4060;
  }

  .cat-signal .feed-text {
    color: #c8a040;
  }
  .cat-signal .feed-turn {
    color: #5a4818;
  }

  .feed-empty {
    color: #2a3840;
    font-size: 0.62rem;
    font-style: italic;
    padding: 0.4rem 0.6rem;
  }
</style>
