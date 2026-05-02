<script lang="ts">
  import type { FacilityDef, PendingFacilityPlacement } from '../../engine/types';

  let {
    placement,
    facilityDef,
    eligibleTileCount,
    isPlacing,
    onPlace,
    onDefer,
    onCancel,
  }: {
    placement: PendingFacilityPlacement;
    facilityDef: FacilityDef | null;
    eligibleTileCount: number;
    /** True while the player is in tile-pick mode for this placement. */
    isPlacing: boolean;
    onPlace: () => void;
    onDefer: () => void;
    onCancel: () => void;
  } = $props();

  const noEligibleTile = $derived(eligibleTileCount === 0);
</script>

<div class="placement-card" class:placing={isPlacing}>
  <div class="header">
    <span class="title">PLACE FACILITY</span>
    <span class="defer-count" title="Times deferred">
      {placement.deferCount}/3
    </span>
  </div>

  <div class="facility-name">
    {facilityDef?.name ?? placement.facilityDefId}
  </div>

  {#if facilityDef}
    <div class="facility-meta">
      Tile: {facilityDef.allowedTileTypes.length === 0
        ? 'Any'
        : facilityDef.allowedTileTypes.join(', ')}
    </div>
  {/if}

  {#if isPlacing}
    <div class="instruction">
      Click an eligible tile on the map.
    </div>
  {:else if noEligibleTile}
    <div class="instruction warn">
      No eligible tile in your bloc — placement is blocked until a slot opens.
    </div>
  {/if}

  <div class="actions">
    {#if isPlacing}
      <button class="btn btn-cancel" onclick={onCancel}>CANCEL</button>
    {:else}
      <button
        class="btn btn-place"
        onclick={onPlace}
        disabled={noEligibleTile}
      >
        PLACE
      </button>
      <button class="btn btn-defer" onclick={onDefer}>DEFER</button>
    {/if}
  </div>
</div>

<style>
  .placement-card {
    border: 1px solid var(--info-border, #3a5a8a);
    background: var(--info-hover, rgba(40, 70, 110, 0.18));
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: var(--fs-md);
  }

  .placement-card.placing {
    border-color: var(--warn-border, #b8a05a);
    background: rgba(120, 90, 30, 0.16);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .title {
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    color: var(--text-primary);
  }

  .defer-count {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    color: #5a6878;
  }

  .facility-name {
    font-size: var(--fs-md);
    color: var(--text-primary);
  }

  .facility-meta {
    font-size: var(--fs-sm);
    color: #6a7888;
  }

  .instruction {
    font-size: var(--fs-sm);
    color: var(--text-primary);
    font-style: italic;
  }

  .instruction.warn {
    color: var(--warn, #d4a04a);
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }

  .btn {
    flex: 1;
    padding: 0.35rem 0.5rem;
    font-size: var(--fs-sm);
    letter-spacing: 0.08em;
    border: 1px solid #2a3545;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
  }

  .btn:hover:not(:disabled) {
    background: var(--info-hover, rgba(80, 110, 150, 0.2));
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .btn-place {
    border-color: var(--info-border, #3a5a8a);
  }

  .btn-defer {
    border-color: #4a5060;
    color: #8a96a8;
  }

  .btn-cancel {
    border-color: var(--warn-border, #b8a05a);
    color: var(--warn, #d4a04a);
  }
</style>
