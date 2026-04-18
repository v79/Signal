<script lang="ts">
  import type { NarrativeDef, NarrativeUnlockItem } from '../../engine/types';

  let {
    narrative,
    onDismiss,
  }: {
    narrative: NarrativeDef;
    onDismiss: () => void;
  } = $props();

  let slideIndex = $state(0);

  const currentSlide = $derived(narrative.slides[slideIndex]);
  const isFirst = $derived(slideIndex === 0);
  const isLast = $derived(slideIndex === narrative.slides.length - 1);
  const slideCount = $derived(narrative.slides.length);

  function next() {
    if (!isLast) slideIndex++;
  }

  function prev() {
    if (!isFirst) slideIndex--;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (isLast) onDismiss();
      else next();
    } else if (e.key === 'ArrowLeft') {
      prev();
    } else if (e.key === 'Escape' && narrative.skippable) {
      onDismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div class="backdrop" role="dialog" aria-modal="true" aria-label={narrative.title}>
  <!-- Modal box -->
  <div class="modal">
    <!-- Header -->
    <div class="modal-header">
      <span class="modal-label">TRANSMISSION</span>
      <h2 class="modal-title">{narrative.title}</h2>
      {#if narrative.skippable}
        <button class="skip-btn" onclick={onDismiss}>SKIP</button>
      {/if}
    </div>

    <!-- Image panel (placeholder) -->
    {#if currentSlide.imageColour}
      <div class="image-panel" style="background-color: {currentSlide.imageColour}">
        <span class="image-placeholder-label">[ IMAGE ]</span>
      </div>
    {/if}

    <!-- Content row: slide text + unlocks panel -->
    <div class="content-row">
      <div class="slide-body">
        <p class="slide-text">{currentSlide.text}</p>
      </div>

      {#if narrative.unlockItems && narrative.unlockItems.length > 0}
        <div class="unlocks-panel">
          <div class="unlocks-label">UNLOCKS</div>
          <ul class="unlocks-list">
            {#each narrative.unlockItems as item}
              <li class="unlock-item">
                <span class="unlock-type unlock-type--{item.type}">{item.type}</span>
                <span class="unlock-name">{item.name}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>

    <!-- Footer: pagination + navigation -->
    <div class="modal-footer">
      <div class="pagination">
        {#each narrative.slides as _, i}
          <button
            class="pip"
            class:active={i === slideIndex}
            onclick={() => (slideIndex = i)}
            aria-label="Go to slide {i + 1}"
          ></button>
        {/each}
      </div>

      <div class="nav-buttons">
        <button class="nav-btn" onclick={prev} disabled={isFirst}>← PREV</button>

        {#if isLast}
          <button class="nav-btn nav-btn--close" onclick={onDismiss}>CLOSE</button>
        {:else}
          <button class="nav-btn nav-btn--next" onclick={next}>
            NEXT → <span class="slide-counter">{slideIndex + 1} / {slideCount}</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal {
    width: 80vw;
    max-width: 900px;
    max-height: 80vh;
    background: var(--surface-1);
    border: 1px solid #2a6090;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 40px rgba(42, 96, 144, 0.25), 0 0 80px rgba(0, 0, 0, 0.6);
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 1.2rem;
    background: var(--surface-0);
    border-bottom: 1px solid var(--border-panel);
    flex-shrink: 0;
  }

  .modal-label {
    font-family: var(--ff-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.25em;
    color: #2a6090;
    border: 1px solid #2a6090;
    padding: 0.15rem 0.4rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-family: var(--ff-mono);
    font-size: var(--fs-lg);
    letter-spacing: 0.12em;
    color: #c8dce8;
    font-weight: normal;
    margin: 0;
    flex: 1;
    text-transform: uppercase;
  }

  .skip-btn {
    background: none;
    border: 1px solid var(--border-panel);
    color: #4a6070;
    font-family: var(--ff-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.2em;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }

  .skip-btn:hover {
    color: var(--text-accent);
    border-color: #4a6070;
  }

  /* Image panel */
  .image-panel {
    flex-shrink: 0;
    height: 18rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-panel);
    position: relative;
  }

  .image-placeholder-label {
    font-family: var(--ff-mono);
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.2);
  }

  /* Content row */
  .content-row {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  /* Slide text */
  .slide-body {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 2.5rem;
    display: flex;
    align-items: center;
  }

  .slide-text {
    font-family: var(--ff-mono);
    font-size: 1rem;
    line-height: 1.8;
    color: #a8c4d8;
    margin: 0;
    max-width: 68ch;
  }

  /* Unlocks panel */
  .unlocks-panel {
    width: 14rem;
    flex-shrink: 0;
    border-left: 1px solid var(--border-panel);
    background: var(--surface-0);
    padding: 1.2rem 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .unlocks-label {
    font-family: var(--ff-mono);
    font-size: var(--fs-xxs);
    letter-spacing: 0.25em;
    color: #2a6090;
    margin-bottom: 0.2rem;
  }

  .unlocks-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .unlock-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .unlock-type {
    font-family: var(--ff-mono);
    font-size: 0.45rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 0.1rem 0.3rem;
    border: 1px solid;
    align-self: flex-start;
  }

  .unlock-type--card {
    color: #4a9060;
    border-color: #2a5040;
  }

  .unlock-type--facility {
    color: #8a6040;
    border-color: #5a4030;
  }

  .unlock-type--project {
    color: #6070a8;
    border-color: #404870;
  }

  .unlock-name {
    font-family: var(--ff-mono);
    font-size: var(--fs-sm);
    color: var(--text-accent);
    line-height: 1.4;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 1.2rem;
    border-top: 1px solid var(--border-panel);
    background: var(--surface-0);
    flex-shrink: 0;
  }

  .pagination {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .pip {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--border-panel);
    border: 1px solid var(--border-active);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s;
  }

  .pip.active {
    background: #2a6090;
    border-color: #4a90c0;
  }

  .pip:hover:not(.active) {
    background: var(--border-active);
  }

  .nav-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .nav-btn {
    background: none;
    border: 1px solid var(--border-panel);
    color: #4a6070;
    font-family: var(--ff-mono);
    font-size: var(--fs-sm);
    letter-spacing: var(--ls-wider);
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .nav-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .nav-btn:not(:disabled):hover {
    color: var(--text-accent);
    border-color: #4a6070;
  }

  .nav-btn--next {
    color: var(--text-accent);
    border-color: #2a6090;
    background: rgba(42, 96, 144, 0.1);
  }

  .nav-btn--next:hover {
    background: rgba(42, 96, 144, 0.2) !important;
    border-color: #4a90c0 !important;
    color: #c8dce8 !important;
  }

  .nav-btn--close {
    color: #c8dce8;
    border-color: #2a6090;
    background: rgba(42, 96, 144, 0.15);
  }

  .nav-btn--close:hover {
    background: rgba(42, 96, 144, 0.3) !important;
    border-color: #4a90c0 !important;
    color: #fff !important;
  }

  .slide-counter {
    color: #4a6070;
    margin-left: 0.4rem;
  }
</style>
