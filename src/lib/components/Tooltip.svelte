<script lang="ts">
  import type { Snippet } from 'svelte';

  let { text, direction = 'above', children }: {
    text: string;
    direction?: 'above' | 'below';
    children: Snippet;
  } = $props();

  let hostEl = $state<HTMLSpanElement | undefined>(undefined);
  let bubbleEl = $state<HTMLSpanElement | undefined>(undefined);

  // Initial style parks the bubble off-screen while invisible so
  // getBoundingClientRect() can measure its true rendered size on first hover.
  let bubbleStyle = $state('position:fixed;left:-9999px;top:-9999px;bottom:auto');

  function handleMouseEnter() {
    if (!hostEl || !bubbleEl) return;

    const host   = hostEl.getBoundingClientRect();
    const bubble = bubbleEl.getBoundingClientRect();
    const margin = 6;
    const gap    = 4;

    // Preferred vertical position
    let top = direction === 'below'
      ? host.bottom + gap
      : host.top - bubble.height - gap;

    // Preferred horizontal centre-align
    let left = host.left + host.width / 2 - bubble.width / 2;

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, window.innerWidth  - bubble.width  - margin));
    top  = Math.max(margin, Math.min(top,  window.innerHeight - bubble.height - margin));

    bubbleStyle = `position:fixed;left:${left}px;top:${top}px;bottom:auto`;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="tooltip-host" onmouseenter={handleMouseEnter} bind:this={hostEl}>
  {@render children()}
  <span class="tooltip-bubble" style={bubbleStyle} bind:this={bubbleEl}>{text}</span>
</span>

<style>
  .tooltip-host {
    position: relative;
    display: inline-block;
  }

  .tooltip-bubble {
    visibility: hidden;
    opacity: 0;
    position: fixed; /* overridden by inline style; declared here for specificity */
    background: #1a2236;
    color: #c8d8f0;
    font-size: 0.6rem;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    transition: opacity 0.15s;
    border: 1px solid #2a3a56;
    z-index: 1000;
  }

  .tooltip-host:hover .tooltip-bubble {
    visibility: visible;
    opacity: 1;
  }
</style>
