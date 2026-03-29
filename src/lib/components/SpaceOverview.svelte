<script lang="ts">
  import type { SpaceNode, FacilityInstance, FacilityDef, ProjectDef } from '../../engine/types';

  let {
    spaceNodes,
    facilities,
    facilityDefs,
    projectDefs,
    completedProjectIds,
    onClose,
  }: {
    spaceNodes: SpaceNode[];
    facilities: FacilityInstance[];
    facilityDefs: Map<string, FacilityDef>;
    projectDefs: Map<string, ProjectDef>;
    completedProjectIds: string[];
    onClose: () => void;
  } = $props();

  // Project IDs that appear on the Earth orbit arc, in display order.
  const EARTH_ORBIT_IDS = ['orbitalTelescopeArray', 'hubbleSpaceTelescope'];

  // Project IDs that will appear on the lunar orbit arc (none defined yet).
  const LUNAR_ORBIT_IDS: string[] = [];

  const nodeFacilities = $derived(
    spaceNodes
      .filter((n) => n.facilityId !== null)
      .map((n) => ({
        node: n,
        facility: facilities.find((f) => f.id === n.facilityId),
        def: facilities.find((f) => f.id === n.facilityId)
          ? facilityDefs.get(facilities.find((f) => f.id === n.facilityId)!.defId)
          : undefined,
      }))
      .filter((entry) => entry.facility && entry.def),
  );

  const earthOrbitCompleted = $derived(
    EARTH_ORBIT_IDS
      .filter((id) => completedProjectIds.includes(id))
      .map((id) => projectDefs.get(id))
      .filter((d): d is ProjectDef => d !== undefined),
  );

  const lunarOrbitCompleted = $derived(
    LUNAR_ORBIT_IDS
      .filter((id) => completedProjectIds.includes(id))
      .map((id) => projectDefs.get(id))
      .filter((d): d is ProjectDef => d !== undefined),
  );
</script>

<div
  class="overlay"
  onclick={onClose}
  role="dialog"
  aria-modal="true"
  aria-label="Near Space overview"
  tabindex="-1"
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="panel" onclick={(e) => e.stopPropagation()}>
    <div class="panel-header">
      <span class="title">NEAR SPACE ASSETS</span>
      <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
    </div>

    <div class="list">
      <!-- Section: Facilities on Nodes -->
      <div class="section-heading">FACILITIES ON NODES</div>
      {#if nodeFacilities.length === 0}
        <div class="empty">No facilities built in Near Space yet.</div>
      {:else}
        {#each nodeFacilities as entry (entry.node.id)}
          <div class="row">
            <span class="node-label">{entry.node.label}</span>
            <span class="item-name">{entry.def!.name}</span>
          </div>
        {/each}
      {/if}

      <!-- Section: Earth Orbit -->
      <div class="section-heading">EARTH ORBIT</div>
      {#if earthOrbitCompleted.length === 0}
        <div class="empty">No Earth orbit projects complete.</div>
      {:else}
        {#each earthOrbitCompleted as def (def.id)}
          <div class="row">
            <span class="item-name">{def.name}</span>
          </div>
        {/each}
      {/if}

      <!-- Section: Lunar Orbit -->
      <div class="section-heading">LUNAR ORBIT</div>
      {#if lunarOrbitCompleted.length === 0}
        <div class="empty">No lunar orbit projects complete.</div>
      {:else}
        {#each lunarOrbitCompleted as def (def.id)}
          <div class="row">
            <span class="item-name">{def.name}</span>
          </div>
        {/each}
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
    background: #0a0e14;
    border: 1px solid #1e2d40;
    border-top: none;
    width: 220px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.6);
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .title {
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    color: #4a7a9a;
    flex: 1;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #4a6070;
    font-family: inherit;
    font-size: 0.7rem;
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

  .section-heading {
    font-size: 0.55rem;
    letter-spacing: 0.14em;
    color: #2a4a60;
    padding: 0.4rem 0.6rem 0.2rem;
    border-top: 1px solid #111820;
    margin-top: 0.1rem;
  }

  .section-heading:first-child {
    border-top: none;
    margin-top: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.18rem 0.6rem 0.18rem 0.9rem;
  }

  .node-label {
    font-size: 0.58rem;
    color: #3a6888;
    letter-spacing: 0.06em;
    min-width: 2.2rem;
    flex-shrink: 0;
  }

  .item-name {
    font-size: 0.65rem;
    color: #8aaabb;
  }

  .empty {
    font-size: 0.58rem;
    color: #2a3e50;
    padding: 0.25rem 0.9rem 0.35rem;
    font-style: italic;
  }
</style>
