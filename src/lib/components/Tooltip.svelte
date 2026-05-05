<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    text,
    direction = 'above',
    disabled = false,
    children,
  }: {
    text: string;
    direction?: 'above' | 'below';
    disabled?: boolean;
    children: Snippet;
  } = $props();

  let hostEl = $state<HTMLSpanElement | undefined>(undefined);
  let bubbleEl = $state<HTMLSpanElement | undefined>(undefined);
  let visible = $state(false);

  const tooltipId = `tt-${crypto.randomUUID()}`;

  // Park bubble off-screen on first paint so getBoundingClientRect() can measure
  // its true rendered size before the first hover/focus event fires.
  let bubbleStyle = $state('position:fixed;left:-9999px;top:-9999px;bottom:auto');

  function position() {
    if (!hostEl || !bubbleEl) return;

    const host = hostEl.getBoundingClientRect();
    const bubble = bubbleEl.getBoundingClientRect();
    const margin = 6;
    const gap = 4;

    let top = direction === 'below' ? host.bottom + gap : host.top - bubble.height - gap;
    let left = host.left + host.width / 2 - bubble.width / 2;

    left = Math.max(margin, Math.min(left, window.innerWidth - bubble.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - bubble.height - margin));

    bubbleStyle = `position:fixed;left:${left}px;top:${top}px;bottom:auto`;
  }

  function show() {
    if (disabled) return;
    visible = true;
    requestAnimationFrame(position);
  }

  function hide() {
    visible = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && visible) hide();
  }

  // Wire aria-describedby onto the first focusable descendant so screen
  // readers announce tooltip text when the wrapped control receives focus.
  // Wrapper span is left non-focusable to avoid duplicate tab stops.
  $effect(() => {
    if (!hostEl) return;
    const focusable = hostEl.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable && focusable !== hostEl) {
      focusable.setAttribute('aria-describedby', tooltipId);
      return () => focusable.removeAttribute('aria-describedby');
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="tooltip-host"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  bind:this={hostEl}
>
  {@render children()}
  <span
    class="tooltip-bubble"
    style={bubbleStyle}
    bind:this={bubbleEl}
    id={tooltipId}
    role="tooltip"
    data-visible={visible}
  >{text}</span>
</span>

<style>
  .tooltip-host {
    position: relative;
    display: inline-block;
  }

  .tooltip-bubble {
    visibility: hidden;
    opacity: 0;
    position: fixed;
    background: var(--surface-3);
    color: var(--text-primary);
    font-size: var(--fs-sm);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    white-space: pre-wrap;
    max-width: 18rem;
    pointer-events: none;
    transition: opacity 0.15s;
    border: 1px solid var(--border-active);
    z-index: 1000;
  }

  .tooltip-bubble[data-visible='true'] {
    visibility: visible;
    opacity: 1;
  }
</style>
