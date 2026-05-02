<script lang="ts">
  import type { FacilityDef, PendingFacilityPlacement } from '../../engine/types';

  let {
    placement,
    facilityDef,
    eligibleTileCount,
    isPlacing,
    onPlace,
    onCancel,
  }: {
    placement: PendingFacilityPlacement;
    facilityDef: FacilityDef | null;
    eligibleTileCount: number;
    isPlacing: boolean;
    onPlace: () => void;
    onCancel: () => void;
  } = $props();

  const noEligibleTile = $derived(eligibleTileCount === 0);

  function handleKeydown(e: KeyboardEvent) {
    if (isPlacing && e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="dialog" aria-modal="true" aria-label="Place facility">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-label">PLACEMENT REQUIRED</span>
      <h2 class="modal-title">{facilityDef?.name ?? placement.facilityDefId}</h2>
    </div>

    <div class="modal-body">
      <p class="lede">
        This facility was produced {placement.deferCount} turns ago and still has
        no home. Choose where to site it before continuing.
      </p>

      {#if facilityDef}
        <p class="meta">
          Eligible tile types:
          <strong>
            {facilityDef.allowedTileTypes.length === 0
              ? 'Any'
              : facilityDef.allowedTileTypes.join(', ')}
          </strong>
        </p>
      {/if}

      {#if isPlacing}
        <p class="instruction">Click an eligible tile on the map.</p>
      {:else if noEligibleTile}
        <p class="instruction warn">
          No eligible tile is currently available in your bloc. Free a slot on a
          matching tile, then return here.
        </p>
      {:else}
        <p class="instruction">Press PLACE, then click a tile on the map.</p>
      {/if}
    </div>

    <div class="modal-footer">
      {#if isPlacing}
        <button class="btn btn-cancel" type="button" onclick={onCancel}>
          CANCEL
        </button>
      {:else}
        <button
          class="btn btn-place"
          type="button"
          onclick={onPlace}
          disabled={noEligibleTile}
        >
          PLACE
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 900;
    backdrop-filter: blur(2px);
  }

  .modal {
    width: 60vw;
    max-width: 580px;
    background: var(--surface-1);
    border: 1px solid var(--warn-border, #b8a05a);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 40px rgba(180, 130, 40, 0.2), 0 0 80px rgba(0, 0, 0, 0.6);
  }

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
    color: var(--warn, #d4a04a);
    border: 1px solid var(--warn-border, #b8a05a);
    padding: 0.15rem 0.4rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-family: var(--ff-mono);
    font-size: var(--fs-lg);
    letter-spacing: 0.12em;
    color: #e8d8b8;
    font-weight: normal;
    margin: 0;
    flex: 1;
    text-transform: uppercase;
  }

  .modal-body {
    padding: 1.4rem 1.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .lede {
    font-family: var(--ff-mono);
    font-size: 0.85rem;
    line-height: 1.6;
    color: #c8c0a8;
    margin: 0;
  }

  .meta {
    font-family: var(--ff-mono);
    font-size: 0.78rem;
    color: #8a8678;
    margin: 0;
  }

  .meta strong {
    color: #c8c0a8;
    font-weight: normal;
  }

  .instruction {
    font-family: var(--ff-mono);
    font-size: 0.8rem;
    color: var(--text-primary);
    margin: 0;
    font-style: italic;
  }

  .instruction.warn {
    color: var(--warn, #d4a04a);
  }

  .modal-footer {
    padding: 0.8rem 1.2rem;
    background: var(--surface-0);
    border-top: 1px solid var(--border-panel);
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  .btn {
    padding: 0.4rem 1rem;
    font-family: var(--ff-mono);
    font-size: var(--fs-sm);
    letter-spacing: 0.18em;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    border: 1px solid #4a5060;
  }

  .btn:hover:not(:disabled) {
    background: rgba(180, 130, 40, 0.12);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .btn-place {
    border-color: var(--warn-border, #b8a05a);
    color: var(--warn, #d4a04a);
  }

  .btn-cancel {
    border-color: #4a5060;
    color: #8a96a8;
  }
</style>
