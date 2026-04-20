<script lang="ts">
  import type { FacilityInstance, FacilityDef, MapTile } from '../../engine/types';

  let {
    facilities,
    facilityDefs,
    earthTiles,
    onClose,
  }: {
    facilities: FacilityInstance[];
    facilityDefs: Map<string, FacilityDef>;
    earthTiles: MapTile[];
    onClose: () => void;
  } = $props();

  const tileMap = $derived(new Map(earthTiles.map((t) => [`${t.coord.q},${t.coord.r}`, t])));

  // Group facilities by defId, sorted by name
  const grouped = $derived.by(() => {
    const groups = new Map<string, { def: FacilityDef; instances: FacilityInstance[] }>();
    for (const inst of facilities) {
      const def = facilityDefs.get(inst.defId);
      if (!def) continue;
      if (!groups.has(inst.defId)) {
        groups.set(inst.defId, { def, instances: [] });
      }
      groups.get(inst.defId)!.instances.push(inst);
    }
    return [...groups.values()].sort((a, b) => a.def.name.localeCompare(b.def.name));
  });

  function conditionLabel(condition: number): string {
    if (condition >= 0.9) return 'GOOD';
    if (condition >= 0.6) return 'FAIR';
    if (condition >= 0.3) return 'POOR';
    return 'CRITICAL';
  }

  function conditionColor(condition: number): string {
    if (condition >= 0.9) return '#4a9b7a';
    if (condition >= 0.6) return '#c8a040';
    if (condition >= 0.3) return '#d07020';
    return '#9b4a4a';
  }

  function tileLabel(locationKey: string): string {
    const tile = tileMap.get(locationKey);
    if (!tile) return locationKey;
    return tile.type.charAt(0).toUpperCase() + tile.type.slice(1);
  }
</script>

<div
  class="overlay"
  onclick={onClose}
  role="dialog"
  aria-modal="true"
  aria-label="Facility overview"
  tabindex="-1"
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel" onclick={(e) => e.stopPropagation()}>
    <div class="panel-header">
      <span class="title">FACILITIES</span>
      <span class="count">{facilities.length} TOTAL</span>
      <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
    </div>
    <div class="list">
      {#each grouped as group (group.def.id)}
        <div class="group">
          <div class="group-header">
            <span class="group-name">{group.def.name}</span>
            <span class="group-count">×{group.instances.length}</span>
          </div>
          {#each group.instances as inst (inst.id)}
            <div class="inst-row">
              <span class="tile-type">{tileLabel(inst.locationKey)} · ({inst.locationKey})</span>
              {#if inst.condition < 1}
                <span class="condition" style="color: {conditionColor(inst.condition)}">
                  {conditionLabel(inst.condition)}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
      {#if facilities.length === 0}
        <div class="empty">No facilities built yet.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .panel {
    background: var(--surface-1);
    border: 1px solid #1e2d40;
    border-top: none;
    width: 220px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-panel);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--border-panel);
    flex-shrink: 0;
  }

  .title {
    font-size: var(--fs-sm);
    letter-spacing: 0.14em;
    color: #4a7a9a;
    flex: 1;
  }

  .count {
    font-size: var(--fs-xs);
    color: #3a5060;
    letter-spacing: 0.08em;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #4a6070;
    font-family: inherit;
    font-size: var(--fs-md);
    cursor: pointer;
    padding: 0 0.1rem;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover {
    color: #8aaabb;
  }

  .list {
    overflow-y: auto;
    flex: 1;
    padding: 0.3rem 0;
  }

  .group {
    padding: 0.25rem 0.6rem;
    border-bottom: 1px solid var(--surface-3);
  }

  .group-header {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    margin-bottom: 0.15rem;
  }

  .group-name {
    font-size: var(--fs-base);
    color: #8aaabb;
    flex: 1;
  }

  .group-count {
    font-size: var(--fs-sm);
    color: #3a5868;
    font-variant-numeric: tabular-nums;
  }

  .inst-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-left: 0.4rem;
    margin-bottom: 0.1rem;
  }

  .tile-type {
    font-size: var(--fs-sm);
    color: #4a6070;
    letter-spacing: 0.06em;
  }

  .condition {
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
  }

  .empty {
    font-size: var(--fs-sm);
    color: #3a5060;
    text-align: center;
    padding: 1rem;
  }
</style>
