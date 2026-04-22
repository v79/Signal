<script lang="ts">
  import type { SpaceNode, FacilityInstance, FacilityDef, ProjectDef } from '../../engine/types';

  let {
    spaceNodes,
    facilities,
    facilityDefs,
    projectDefs,
    completedProjectIds,
    launchCapacity,
    launchAllocation,
    remainingCapacity,
    upgradableNodeIds,
    playerResources,
    onClose,
    onToggleSupply,
    onUpgrade,
  }: {
    spaceNodes: SpaceNode[];
    facilities: FacilityInstance[];
    facilityDefs: Map<string, FacilityDef>;
    projectDefs: Map<string, ProjectDef>;
    completedProjectIds: Record<string, number>;
    launchCapacity: number;
    launchAllocation: Record<string, boolean>;
    remainingCapacity: number;
    /** nodeId → next-tier FacilityDef (only nodes where upgrade is available) */
    upgradableNodeIds: Record<string, FacilityDef>;
    playerResources: { funding: number; materials: number; politicalWill: number };
    onClose: () => void;
    onToggleSupply: (nodeId: string) => void;
    onUpgrade: (nodeId: string) => void;
  } = $props();

  // Project IDs that appear on the Earth orbit arc, in display order.
  const EARTH_ORBIT_IDS = ['orbitalTelescopeArray', 'hubbleSpaceTelescope'];

  // Project IDs that will appear on the lunar orbit arc (none defined yet).
  const LUNAR_ORBIT_IDS: string[] = [];

  const nodeFacilities = $derived(
    spaceNodes
      .filter((n) => n.facilityId !== null)
      .map((n) => {
        const inst = facilities.find((f) => f.locationKey === n.id);
        const def = inst ? facilityDefs.get(inst.defId) : undefined;
        return { node: n, facility: inst, def };
      })
      .filter((entry) => entry.facility && entry.def),
  );

  const earthOrbitCompleted = $derived(
    EARTH_ORBIT_IDS
      .filter((id) => id in completedProjectIds)
      .map((id) => projectDefs.get(id))
      .filter((d): d is ProjectDef => d !== undefined),
  );

  const lunarOrbitCompleted = $derived(
    LUNAR_ORBIT_IDS
      .filter((id) => id in completedProjectIds)
      .map((id) => projectDefs.get(id))
      .filter((d): d is ProjectDef => d !== undefined),
  );

  function isSupplied(nodeId: string): boolean {
    return launchAllocation[nodeId] !== false;
  }

  function canToggleOn(nodeId: string, supplyCost: number): boolean {
    return isSupplied(nodeId) || remainingCapacity >= supplyCost;
  }

  // Capacity bar
  const usedCapacity = $derived(launchCapacity - remainingCapacity);
  const barPct = $derived(launchCapacity > 0 ? usedCapacity / launchCapacity : 0);
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

    <!-- Launch Capacity Bar -->
    {#if launchCapacity > 0}
      <div class="capacity-section">
        <div class="capacity-label">
          LAUNCH CAPACITY
          <span class="capacity-value">{usedCapacity}/{launchCapacity}</span>
        </div>
        <div class="capacity-bar-track">
          <div class="capacity-bar-fill" style="width: {Math.min(100, barPct * 100)}%"></div>
        </div>
      </div>
    {/if}

    <div class="list">
      <!-- Section: Facilities on Nodes -->
      <div class="section-heading">FACILITIES ON NODES</div>
      {#if nodeFacilities.length === 0}
        <div class="empty">No facilities built in Near Space yet.</div>
      {:else}
        {#each nodeFacilities as entry (entry.node.id)}
          {@const supplyCost = entry.def!.supplyCost ?? 0}
          {@const supplied = isSupplied(entry.node.id)}
          {@const upgradeDef = upgradableNodeIds[entry.node.id]}
          <div class="facility-row" class:unsupplied={!supplied}>
            <div class="row-main">
              <div class="row-left">
                <span class="node-label">{entry.node.label}</span>
                <span class="item-name">{entry.def!.name}</span>
              </div>
              {#if supplyCost > 0}
                <div class="supply-controls">
                  <span class="supply-cost">{supplyCost}u</span>
                  <button
                    class="toggle-btn"
                    class:on={supplied}
                    disabled={!supplied && !canToggleOn(entry.node.id, supplyCost)}
                    onclick={() => onToggleSupply(entry.node.id)}
                  >
                    {supplied ? 'ON' : 'OFF'}
                  </button>
                </div>
              {/if}
            </div>
            {#if upgradeDef}
              {@const upgradeAffordable =
                (upgradeDef.buildCost.funding ?? 0) <= playerResources.funding &&
                (upgradeDef.buildCost.materials ?? 0) <= playerResources.materials &&
                (upgradeDef.buildCost.politicalWill ?? 0) <= playerResources.politicalWill}
              <div class="upgrade-row">
                <button
                  class="upgrade-btn"
                  disabled={!upgradeAffordable}
                  onclick={() => onUpgrade(entry.node.id)}
                >
                  ↑ Upgrade → {upgradeDef.name}
                </button>
              </div>
            {/if}
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
    background: var(--surface-1);
    border: 1px solid #1e2d40;
    border-top: none;
    width: 260px;
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

  .capacity-section {
    padding: 0.4rem 0.6rem 0.3rem;
    border-bottom: 1px solid var(--surface-3);
    flex-shrink: 0;
  }

  .capacity-label {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    color: #4a7a9a;
    margin-bottom: 0.25rem;
  }

  .capacity-value {
    color: #8aaabb;
  }

  .capacity-bar-track {
    height: 4px;
    background: var(--border-subtle);
    border-radius: 2px;
    overflow: hidden;
  }

  .capacity-bar-fill {
    height: 100%;
    background: #4a90c0;
    border-radius: 2px;
    transition: width 0.2s;
  }

  .list {
    overflow-y: auto;
    flex: 1;
    padding: 0.3rem 0;
  }

  .section-heading {
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    color: #2a4a60;
    padding: 0.4rem 0.6rem 0.2rem;
    border-top: 1px solid var(--surface-3);
    margin-top: 0.1rem;
  }

  .section-heading:first-child {
    border-top: none;
    margin-top: 0;
  }

  .facility-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.15rem 0.6rem 0.25rem 0.9rem;
    transition: opacity 0.15s;
  }

  .facility-row.unsupplied {
    opacity: 0.55;
  }

  .row-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.4rem;
  }

  .row-left {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
  }

  .supply-controls {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.18rem 0.6rem 0.18rem 0.9rem;
  }

  .node-label {
    font-size: 0.55rem;
    color: #3a6888;
    letter-spacing: 0.06em;
    min-width: 2rem;
    flex-shrink: 0;
  }

  .item-name {
    font-size: var(--fs-sm);
    color: #8aaabb;
    min-width: 0;
  }

  .supply-cost {
    font-size: var(--fs-xs);
    color: #3a6070;
    flex-shrink: 0;
  }

  .toggle-btn {
    font-size: 0.52rem;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 2px;
    border: 1px solid #1e3048;
    background: var(--surface-2);
    color: #3a5870;
    cursor: pointer;
    font-family: var(--ff-mono);
    transition: all 0.1s;
    flex-shrink: 0;
  }

  .toggle-btn.on {
    border-color: #2a6090;
    color: #60b0e8;
    background: var(--info-hover);
  }

  .toggle-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .upgrade-row {
    display: block;
    width: 100%;
    padding-left: 2.35rem;
  }

  .upgrade-btn {
    font-size: 0.52rem;
    letter-spacing: 0.04em;
    padding: 2px 6px;
    border: 1px solid #2a5870;
    background: var(--surface-alt);
    color: #4a9090;
    cursor: pointer;
    font-family: var(--ff-mono);
    border-radius: 2px;
    transition: all 0.1s;
    white-space: nowrap;
  }

  .upgrade-btn:hover {
    color: #70d0d0;
    border-color: #4a8080;
  }

  .empty {
    font-size: var(--fs-sm);
    color: #2a3e50;
    padding: 0.25rem 0.9rem 0.35rem;
    font-style: italic;
  }
</style>
