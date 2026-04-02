<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type {
    TechState,
    TechDef,
    SignalState,
    CardDef,
    FacilityDef,
    Era,
  } from '../../engine/types';
  import type {
    TechTreeScene as TechTreeSceneType,
    TechTreeSceneData,
  } from '../../phaser/TechTreeScene';
  import { PROJECT_DEFS, TILE_ACTION_DEFS } from '../../data/loader';
  import { FIELD_COLOURS_CSS, FIELD_ABBR } from '../fieldColours';

  let {
    techs,
    techDefs,
    signal,
    cardDefs,
    facilityDefs,
    era,
    turn,
    year,
    onClose,
  }: {
    techs: TechState[];
    techDefs: Map<string, TechDef>;
    signal: SignalState;
    cardDefs: Map<string, CardDef>;
    facilityDefs: Map<string, FacilityDef>;
    era: Era;
    turn: number;
    year: number;
    onClose: () => void;
  } = $props();

  let containerEl: HTMLDivElement;
  let game: import('phaser').Game | null = null;
  let scene: TechTreeSceneType | null = null;
  let loading = $state(true);

  // Era currently displayed in the canvas.
  // Captured from the prop at open time — the modal remounts on each open so this is correct.
  // eslint-disable-next-line svelte/reactivity
  let activeEra = $state<Era>(era);
  // Selected tech defId for detail panel
  let selectedTechId = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Era metadata
  // ---------------------------------------------------------------------------

  const ERA_LABELS: Record<Era, string> = {
    earth: 'ERA I — EARTH PROGRAMME',
    nearSpace: 'ERA II — NEAR SPACE PROGRAMME',
    deepSpace: 'ERA III — DEEP SPACE PROGRAMME',
  };

  const ERA_TAB_LABELS: Record<Era, string> = {
    earth: 'ERA I',
    nearSpace: 'ERA II',
    deepSpace: 'ERA III',
  };

  const ERA_ORDER: Era[] = ['earth', 'nearSpace', 'deepSpace'];

  /** Whether a given era tab should be clickable (player has reached it). */
  function eraEnabled(tabEra: Era): boolean {
    const playerIdx = ERA_ORDER.indexOf(era);
    const tabIdx = ERA_ORDER.indexOf(tabEra);
    return tabIdx <= playerIdx;
  }

  // ---------------------------------------------------------------------------
  // Filtered techs for the active era
  // ---------------------------------------------------------------------------

  const eraFilteredTechs = $derived(
    techs.filter((t) => {
      const def = techDefs.get(t.defId);
      return (def?.era ?? 'earth') === activeEra;
    }),
  );

  const discoveredCount = $derived(
    eraFilteredTechs.filter((t) => t.stage === 'discovered').length,
  );
  const totalCount = $derived(eraFilteredTechs.length);

  // ---------------------------------------------------------------------------
  // Detail panel derived data
  // ---------------------------------------------------------------------------

  const selectedTech = $derived(
    selectedTechId ? techs.find((t) => t.defId === selectedTechId) ?? null : null,
  );
  const selectedDef = $derived(selectedTechId ? techDefs.get(selectedTechId) ?? null : null);

  /** Prereqs with their discovery stage. */
  const selectedPrereqs = $derived(
    selectedDef?.requiredTechIds.map((id) => ({
      id,
      name: techDefs.get(id)?.name ?? id,
      discovered: techs.find((t) => t.defId === id)?.stage === 'discovered',
    })) ?? [],
  );

  /** Card unlocks. */
  const selectedUnlockCards = $derived(
    selectedDef?.unlocksCards.map((id) => cardDefs.get(id)?.name ?? id) ?? [],
  );

  /** Facility unlocks. */
  const selectedUnlockFacilities = $derived(
    selectedDef?.unlocksFacilities.map((id) => facilityDefs.get(id)?.name ?? id) ?? [],
  );

  /** Project unlocks. */
  const selectedUnlockProjects = $derived(
    selectedDef?.unlocksProjects.map((id) => PROJECT_DEFS.get(id)?.name ?? id) ?? [],
  );

  /** Tile action unlocks (reverse lookup — tile actions whose requiredTechId matches). */
  const selectedUnlockTileActions = $derived(
    selectedTechId
      ? [...TILE_ACTION_DEFS.values()]
          .filter((ta) => ta.requiredTechId === selectedTechId)
          .map((ta) => ta.name)
      : [],
  );

  const hasUnlocks = $derived(
    selectedUnlockCards.length > 0 ||
      selectedUnlockFacilities.length > 0 ||
      selectedUnlockProjects.length > 0 ||
      selectedUnlockTileActions.length > 0,
  );

  /** Recipe with progress for the detail panel. */
  const selectedRecipe = $derived((): Array<{
    field: string;
    abbr: string;
    color: string;
    current: number;
    threshold: number;
    pct: number;
  }> => {
    if (!selectedDef || !selectedTech) return [];
    const recipe = selectedTech.recipe ?? selectedDef.baseRecipe;
    const fieldProgress = selectedTech.fieldProgress as Partial<Record<string, number>>;
    return Object.entries(recipe)
      .filter(([, v]) => v != null && v > 0)
      .map(([field, threshold]) => {
        const current = fieldProgress[field] ?? 0;
        const t = threshold as number;
        return {
          field,
          abbr: FIELD_ABBR[field] ?? field.slice(0, 3).toUpperCase(),
          color: FIELD_COLOURS_CSS[field] ?? '#4a6880',
          current: Math.min(current, t),
          threshold: t,
          pct: Math.min(100, Math.round((current / t) * 100)),
        };
      });
  });

  // ---------------------------------------------------------------------------
  // Phaser scene wiring
  // ---------------------------------------------------------------------------

  function handleNodeClick(defId: string): void {
    selectedTechId = defId;
  }

  function buildData(): TechTreeSceneData {
    return {
      techs: eraFilteredTechs,
      techDefs,
      signal,
      cardDefs,
      facilityDefs,
      onNodeClick: handleNodeClick,
    };
  }

  onMount(async () => {
    if (!browser) return;

    const [Phaser, { TechTreeScene }] = await Promise.all([
      import('phaser'),
      import('../../phaser/TechTreeScene'),
    ]);

    const sceneInstance = new TechTreeScene();

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerEl,
      width: containerEl.clientWidth || 900,
      height: containerEl.clientHeight || 560,
      backgroundColor: '#050a10',
      ...({ resolution: window.devicePixelRatio || 1 } as object),
      scene: sceneInstance,
      banner: false,
    });

    game.events.once('ready', () => {
      scene = game!.scene.getScene('TechTreeScene') as TechTreeSceneType;
      scene.setData(buildData());
      loading = false;
    });
  });

  onDestroy(() => {
    game?.destroy(true);
    game = null;
    scene = null;
  });

  // Re-push data to scene when era filter or techs change
  $effect(() => {
    const data = buildData();
    if (scene) scene.setData(data);
  });

  // Resize Phaser canvas when detail panel opens/closes
  $effect(() => {
    const _sel = selectedTechId; // create reactivity dependency
    // Run after DOM update so containerEl reflects the new width
    requestAnimationFrame(() => {
      if (game && containerEl) {
        game.scale.resize(containerEl.clientWidth, containerEl.clientHeight);
      }
    });
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (selectedTechId) {
        selectedTechId = null;
      } else {
        onClose();
      }
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }

  function closeDetailPanel(): void {
    selectedTechId = null;
  }

  const STAGE_LABELS: Record<string, string> = {
    progress: 'IN PROGRESS',
    discovered: 'DISCOVERED',
    rumour: 'UNCONFIRMED',
    unknown: 'RESTRICTED',
    'signal-hidden': 'SIGNAL HIDDEN',
  };

  const STAGE_COLORS: Record<string, string> = {
    progress: '#6aaabb',
    discovered: '#d4a820',
    rumour: '#3a6888',
    unknown: '#1e3040',
    'signal-hidden': '#3a7098',
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="backdrop"
  onclick={handleBackdropClick}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-label="Tech Tree"
>
  <div class="modal-box">
    <div class="modal-header">
      <div class="header-left">
        <span class="classify-badge">RESTRICTED</span>
        <span class="header-sep">·</span>
        <span class="modal-title">RESEARCH DATABASE</span>
        <span class="header-sep">·</span>
        <span class="header-datestamp">TURN {turn} · {year}</span>
        <span class="header-sep">·</span>
        <div class="era-tabs" role="tablist" aria-label="Era selector">
          {#each ERA_ORDER as e}
            <button
              class="era-tab"
              class:active={activeEra === e}
              class:disabled={!eraEnabled(e)}
              disabled={!eraEnabled(e)}
              onclick={() => {
                if (eraEnabled(e)) {
                  activeEra = e;
                  selectedTechId = null;
                }
              }}
              role="tab"
              aria-selected={activeEra === e}
              aria-label={ERA_TAB_LABELS[e]}
            >{ERA_TAB_LABELS[e]}</button>
          {/each}
        </div>
      </div>
      <div class="header-right">
        <span class="header-status">
          {ERA_LABELS[activeEra]}
          <span class="header-count">{discoveredCount}/{totalCount} CONFIRMED</span>
        </span>
        <button class="close-btn" onclick={onClose} aria-label="Close tech tree">✕</button>
      </div>
    </div>

    <div class="canvas-wrap">
      <div class="canvas-container" bind:this={containerEl}></div>

      {#if selectedTech && selectedDef}
        {@const effectiveStage =
          selectedDef.signalDerived && signal.eraStrength === 'faint'
            ? 'signal-hidden'
            : selectedTech.stage}
        <div class="detail-panel">
          <div class="detail-header">
            <div class="detail-badges">
              <span class="detail-era-badge">{ERA_TAB_LABELS[selectedDef.era ?? 'earth']}</span>
              <span class="detail-tier-badge">TIER {selectedDef.tier}</span>
            </div>
            <button class="detail-close" onclick={closeDetailPanel} aria-label="Close detail">✕</button>
          </div>

          <div class="detail-name" style="color: {STAGE_COLORS[effectiveStage] ?? '#a8c8d8'}">
            {selectedDef.name}
          </div>

          <div
            class="detail-stage-badge"
            style="color: {STAGE_COLORS[effectiveStage] ?? '#4a6888'}; border-color: {STAGE_COLORS[effectiveStage] ?? '#4a6888'}33"
          >
            {STAGE_LABELS[effectiveStage] ?? effectiveStage}
          </div>

          {#if selectedDef.rumourText}
            <div class="detail-rumour">{selectedDef.rumourText}</div>
          {/if}

          {#if selectedDef.requiresSimultaneous}
            <div class="detail-simultaneous">⊕ All fields must reach threshold simultaneously</div>
          {/if}

          <!-- Recipe -->
          {#if selectedRecipe().length > 0}
            <div class="detail-section-label">RECIPE</div>
            <div class="detail-recipe">
              {#each selectedRecipe() as row}
                <div class="recipe-row">
                  <span class="recipe-abbr" style="color: {row.color}">{row.abbr}</span>
                  <div class="recipe-bar-track">
                    <div
                      class="recipe-bar-fill"
                      style="width: {row.pct}%; background: {row.color}{effectiveStage === 'discovered' ? '88' : 'cc'}"
                    ></div>
                  </div>
                  <span class="recipe-nums">
                    {effectiveStage === 'discovered'
                      ? row.threshold
                      : `${row.current}/${row.threshold}`}
                  </span>
                  <span class="recipe-pct" style="color: {row.pct >= 100 ? row.color : '#3a5060'}"
                    >{row.pct}%</span
                  >
                </div>
              {/each}
            </div>
          {/if}

          <!-- Prerequisites -->
          {#if selectedPrereqs.length > 0}
            <div class="detail-section-label">PREREQUISITES</div>
            <div class="detail-prereqs">
              {#each selectedPrereqs as prereq}
                <div class="prereq-row" class:met={prereq.discovered}>
                  <span class="prereq-icon">{prereq.discovered ? '✓' : '✗'}</span>
                  <span class="prereq-name">{prereq.name}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Unlocks -->
          {#if hasUnlocks}
            <div class="detail-section-label">UNLOCKS</div>
            <div class="detail-unlocks">
              {#each selectedUnlockCards as name}
                <div class="unlock-row">
                  <span class="unlock-tag card-tag">CARD</span>
                  <span class="unlock-name">{name}</span>
                </div>
              {/each}
              {#each selectedUnlockFacilities as name}
                <div class="unlock-row">
                  <span class="unlock-tag facility-tag">FACILITY</span>
                  <span class="unlock-name">{name}</span>
                </div>
              {/each}
              {#each selectedUnlockProjects as name}
                <div class="unlock-row">
                  <span class="unlock-tag project-tag">PROJECT</span>
                  <span class="unlock-name">{name}</span>
                </div>
              {/each}
              {#each selectedUnlockTileActions as name}
                <div class="unlock-row">
                  <span class="unlock-tag tile-tag">TILE</span>
                  <span class="unlock-name">{name}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if loading}
        <div class="loading-overlay">
          <span class="loading-label">DECRYPTING RESEARCH ARCHIVE</span>
          <span class="loading-dots" aria-hidden="true">···</span>
        </div>
      {/if}
      <div class="zoom-controls" aria-label="Zoom controls">
        <button class="zoom-btn" onclick={() => scene?.zoomIn()} aria-label="Zoom in">+</button>
        <button
          class="zoom-btn zoom-reset"
          onclick={() => scene?.resetZoom()}
          aria-label="Reset zoom"
          title="Reset zoom">⊙</button
        >
        <button class="zoom-btn" onclick={() => scene?.zoomOut()} aria-label="Zoom out">−</button>
      </div>
    </div>

    <div class="tech-legend">
      <span class="legend-item">
        <span class="legend-dot" style="background:#d4a820; box-shadow: 0 0 4px #d4a82066;"></span>
        Discovered
      </span>
      <span class="legend-item">
        <span class="legend-dot" style="background:#4a8090;"></span>
        In Progress
      </span>
      <span class="legend-item">
        <span class="legend-dot" style="background:#2a4460;"></span>
        Rumoured
      </span>
      <span class="legend-item">
        <span class="legend-dot" style="background:#14222e; border: 1px solid #2a3a50;"></span>
        Unknown
      </span>
      <span class="legend-scroll-hint">DRAG · SCROLL TO ZOOM · CLICK NODE FOR DETAIL</span>
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

  .header-datestamp {
    font-family: monospace;
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    color: #3a5a6a;
    flex-shrink: 0;
  }

  .modal-title {
    font-family: monospace;
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    color: #4a7888;
    white-space: nowrap;
  }

  /* Era switcher tabs */
  .era-tabs {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .era-tab {
    font-family: monospace;
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    padding: 0.15rem 0.5rem;
    background: none;
    border: 1px solid #162230;
    color: #2e5068;
    cursor: pointer;
    border-radius: 1px;
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
    white-space: nowrap;
  }

  .era-tab:hover:not(.disabled) {
    color: #6aaabb;
    border-color: #2a5060;
    background: rgba(42, 72, 88, 0.12);
  }

  .era-tab.active {
    color: #90c8d8;
    border-color: #2a5870;
    background: rgba(42, 88, 112, 0.18);
  }

  .era-tab.disabled {
    color: #1a2e3a;
    border-color: #0e1c28;
    cursor: default;
    opacity: 0.6;
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
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
    line-height: 1;
  }

  .close-btn:hover {
    color: #90b8c8;
    border-color: #2a4858;
    background: rgba(42, 72, 88, 0.15);
  }

  /* Canvas area — flex row to accommodate the detail panel */
  .canvas-wrap {
    flex: 1;
    min-height: 0;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: row;
  }

  .canvas-container {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  /* CRT scanlines on the canvas only */
  .canvas-container::after {
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

  .canvas-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  /* Detail panel */
  .detail-panel {
    width: 280px;
    flex-shrink: 0;
    background: #06090f;
    border-left: 1px solid #0e1c28;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-family: monospace;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .detail-badges {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .detail-era-badge,
  .detail-tier-badge {
    font-size: 0.54rem;
    letter-spacing: 0.12em;
    padding: 0.1rem 0.35rem;
    border-radius: 1px;
    white-space: nowrap;
  }

  .detail-era-badge {
    color: #8a6810;
    background: rgba(212, 168, 32, 0.06);
    border: 1px solid #3a2c08;
  }

  .detail-tier-badge {
    color: #3a6888;
    border: 1px solid #1a3040;
  }

  .detail-close {
    background: none;
    border: 1px solid #162230;
    color: #3a5868;
    font-size: 0.65rem;
    padding: 0.12rem 0.35rem;
    cursor: pointer;
    font-family: monospace;
    border-radius: 1px;
    flex-shrink: 0;
    line-height: 1;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .detail-close:hover {
    color: #90b8c8;
    border-color: #2a4858;
  }

  .detail-name {
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    line-height: 1.3;
    font-weight: bold;
    border-bottom: 1px solid #0e1c28;
    padding-bottom: 0.5rem;
  }

  .detail-stage-badge {
    font-size: 0.54rem;
    letter-spacing: 0.16em;
    padding: 0.12rem 0.4rem;
    border: 1px solid;
    border-radius: 1px;
    align-self: flex-start;
  }

  .detail-rumour {
    font-size: 0.62rem;
    color: #4a6a7a;
    font-style: italic;
    line-height: 1.5;
    border-left: 2px solid #1a3040;
    padding-left: 0.5rem;
  }

  .detail-simultaneous {
    font-size: 0.58rem;
    color: #4a7080;
    letter-spacing: 0.04em;
    line-height: 1.4;
  }

  .detail-section-label {
    font-size: 0.54rem;
    letter-spacing: 0.2em;
    color: #2e5060;
    margin-top: 0.25rem;
    border-bottom: 1px solid #0c1820;
    padding-bottom: 0.2rem;
  }

  /* Recipe */
  .detail-recipe {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .recipe-row {
    display: grid;
    grid-template-columns: 3rem 1fr 3.5rem 2.5rem;
    align-items: center;
    gap: 0.3rem;
  }

  .recipe-abbr {
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-align: right;
  }

  .recipe-bar-track {
    height: 7px;
    background: #0e1820;
    border-radius: 1px;
    overflow: hidden;
  }

  .recipe-bar-fill {
    height: 100%;
    border-radius: 1px;
    transition: width 0.3s ease;
  }

  .recipe-nums {
    font-size: 0.55rem;
    color: #3a5868;
    text-align: right;
  }

  .recipe-pct {
    font-size: 0.58rem;
    text-align: right;
  }

  /* Prerequisites */
  .detail-prereqs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prereq-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.62rem;
    color: #304858;
  }

  .prereq-row.met {
    color: #4a8858;
  }

  .prereq-icon {
    flex-shrink: 0;
    font-size: 0.7rem;
  }

  .prereq-name {
    line-height: 1.3;
  }

  /* Unlocks */
  .detail-unlocks {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .unlock-row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: 0.62rem;
  }

  .unlock-tag {
    font-size: 0.5rem;
    letter-spacing: 0.1em;
    padding: 0.08rem 0.3rem;
    border-radius: 1px;
    flex-shrink: 0;
    border: 1px solid;
  }

  .card-tag {
    color: #4a8090;
    border-color: #1a3840;
  }

  .facility-tag {
    color: #7a6838;
    border-color: #3a3018;
  }

  .project-tag {
    color: #507060;
    border-color: #1e3028;
  }

  .tile-tag {
    color: #6a5880;
    border-color: #2e2440;
  }

  .unlock-name {
    color: #4a6878;
    line-height: 1.3;
  }

  /* Loading overlay */
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
    0%,
    100% {
      opacity: 1;
    }
    33% {
      opacity: 0.2;
    }
    66% {
      opacity: 0.6;
    }
  }

  .zoom-controls {
    position: absolute;
    bottom: 12px;
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
    transition:
      color 0.15s,
      border-color 0.15s,
      background 0.15s;
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

  /* Legend */
  .tech-legend {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.45rem 1rem;
    background: #040810;
    border-top: 1px solid #0e1c28;
    flex-shrink: 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: monospace;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    color: #587888;
  }

  .legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-scroll-hint {
    margin-left: auto;
    font-family: monospace;
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    color: #1e3040;
  }
</style>
