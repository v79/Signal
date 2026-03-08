<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type {
    TechState, TechDef, FieldPoints, SignalState, CardDef, FacilityDef,
  } from '../../engine/types';
  import type { TechTreeScene as TechTreeSceneType, TechTreeSceneData } from '../../phaser/TechTreeScene';

  let {
    techs,
    techDefs,
    fields,
    signal,
    cardDefs,
    facilityDefs,
    onClose,
  }: {
    techs:        TechState[];
    techDefs:     Map<string, TechDef>;
    fields:       FieldPoints;
    signal:       SignalState;
    cardDefs:     Map<string, CardDef>;
    facilityDefs: Map<string, FacilityDef>;
    onClose:      () => void;
  } = $props();

  let containerEl: HTMLDivElement;
  let game: import('phaser').Game | null = null;
  let scene: TechTreeSceneType | null = null;
  let loading = $state(true);

  function buildData(): TechTreeSceneData {
    return { techs, techDefs, fields, signal, cardDefs, facilityDefs };
  }

  onMount(async () => {
    if (!browser) return;

    const [Phaser, { TechTreeScene }] = await Promise.all([
      import('phaser'),
      import('../../phaser/TechTreeScene'),
    ]);

    const sceneInstance = new TechTreeScene();

    game = new Phaser.Game({
      type:            Phaser.AUTO,
      parent:          containerEl,
      width:           containerEl.clientWidth  || 900,
      height:          containerEl.clientHeight || 560,
      backgroundColor: '#050a10',
      // Match the display's pixel density so text renders crisply on HiDPI screens.
      // Phaser doubles the canvas buffer while keeping game coordinates the same,
      // so all font sizes and positions are unchanged.
      // (resolution is a valid Phaser config key; the @types/phaser package omits it)
      ...({ resolution: window.devicePixelRatio || 1 } as object),
      scene:           sceneInstance,
      banner:          false,
    });

    game.events.once('ready', () => {
      scene = game!.scene.getScene('TechTreeScene') as TechTreeSceneType;
      scene.setData(buildData());
      loading = false;
    });
  });

  onDestroy(() => {
    game?.destroy(true);
    game  = null;
    scene = null;
  });

  $effect(() => {
    const data = buildData();
    if (scene) scene.setData(data);
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  // Discovered tech count for header status
  const discoveredCount = $derived(techs.filter(t => t.stage === 'discovered').length);
  const totalCount      = $derived(techs.length);
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleBackdropClick} role="dialog" tabindex="-1" aria-modal="true" aria-label="Tech Tree">
  <div class="modal-box">

    <div class="modal-header">
      <div class="header-left">
        <span class="classify-badge">RESTRICTED</span>
        <span class="header-sep">·</span>
        <span class="modal-title">RESEARCH DATABASE</span>
      </div>
      <div class="header-right">
        <span class="header-status">
          ERA I — EARTH PROGRAMME
          <span class="header-count">{discoveredCount}/{totalCount} CONFIRMED</span>
        </span>
        <button class="close-btn" onclick={onClose} aria-label="Close tech tree">✕</button>
      </div>
    </div>

    <div class="canvas-wrap">
      <div class="canvas-container" bind:this={containerEl}></div>
      {#if loading}
        <div class="loading-overlay">
          <span class="loading-label">DECRYPTING RESEARCH ARCHIVE</span>
          <span class="loading-dots" aria-hidden="true">···</span>
        </div>
      {/if}
      <div class="zoom-controls" aria-label="Zoom controls">
        <button class="zoom-btn" onclick={() => scene?.zoomIn()}    aria-label="Zoom in">+</button>
        <button class="zoom-btn zoom-reset" onclick={() => scene?.resetZoom()} aria-label="Reset zoom" title="Reset zoom">⊙</button>
        <button class="zoom-btn" onclick={() => scene?.zoomOut()}   aria-label="Zoom out">−</button>
      </div>
    </div>

  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 12, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .modal-box {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 90vw;
    height: 90vh;
    background: #050a10;
    /* Amber top border — classification accent */
    border-top: 1px solid #3a2e08;
    border-right: 1px solid #0e1c28;
    border-bottom: 1px solid #0e1c28;
    border-left: 1px solid #0e1c28;
    border-radius: 2px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(212, 168, 32, 0.06),
      0 24px 80px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 rgba(212, 168, 32, 0.05);
  }

  /* Corner bracket accents */
  .modal-box::before,
  .modal-box::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    border-color: #2a3e18;
    border-style: solid;
    z-index: 2;
    pointer-events: none;
  }
  .modal-box::before {
    bottom: 4px;
    left: 4px;
    border-width: 0 0 1px 1px;
  }
  .modal-box::after {
    bottom: 4px;
    right: 4px;
    border-width: 0 1px 1px 0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.9rem;
    border-bottom: 1px solid #0e1c28;
    background: #040810;
    flex-shrink: 0;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .classify-badge {
    font-family: monospace;
    font-size: 0.58rem;
    letter-spacing: 0.18em;
    color: #8a6810;
    background: rgba(212, 168, 32, 0.06);
    border: 1px solid #3a2c08;
    padding: 0.1rem 0.4rem;
    border-radius: 1px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .header-sep {
    color: #1e3040;
    font-size: 0.7rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-family: monospace;
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    color: #4a7888;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    flex-shrink: 0;
  }

  .header-status {
    font-family: monospace;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    color: #304858;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    white-space: nowrap;
  }

  .header-count {
    color: #3a6040;
    font-size: 0.58rem;
    padding: 0.1rem 0.35rem;
    border: 1px solid #1a3020;
    border-radius: 1px;
  }

  .close-btn {
    background: none;
    border: 1px solid #162230;
    color: #3a5868;
    font-size: 0.7rem;
    padding: 0.18rem 0.45rem;
    cursor: pointer;
    font-family: monospace;
    border-radius: 1px;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    line-height: 1;
  }

  .close-btn:hover {
    color: #90b8c8;
    border-color: #2a4858;
    background: rgba(42, 72, 88, 0.15);
  }

  .canvas-wrap {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
  }

  /* CRT scanlines overlay — very subtle, adds depth without obscuring content */
  .canvas-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.07) 3px,
      rgba(0, 0, 0, 0.07) 4px
    );
    pointer-events: none;
    z-index: 1;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
  }

  .canvas-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    background: #050a10;
    z-index: 3;
  }

  .loading-label {
    font-family: monospace;
    font-size: 0.65rem;
    letter-spacing: 0.25em;
    color: #2e5870;
  }

  .loading-dots {
    font-family: monospace;
    font-size: 0.8rem;
    color: #1e3c50;
    animation: blink 1.4s step-start infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    33%       { opacity: 0.2; }
    66%       { opacity: 0.6; }
  }

  .zoom-controls {
    position: absolute;
    bottom: 52px; /* sits above the Phaser legend strip */
    right: 12px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
    font-family: monospace;
    font-size: 1rem;
    line-height: 1;
    background: rgba(4, 8, 16, 0.88);
    border: 1px solid #1a3040;
    color: #4a7080;
    cursor: pointer;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .zoom-btn:hover {
    color: #6aaabb;
    border-color: #2a5060;
    background: rgba(10, 24, 40, 0.95);
  }

  .zoom-reset {
    font-size: 0.8rem;
    color: #2e5060;
  }
</style>
