<script lang="ts">
  import type { FacilityDef, MapTile, Resources } from '../../engine/types';

  let {
    tile,
    facilityDefs,
    playerResources,
    discoveredTechIds,
    techNames,
    onBuild,
    onDemolish,
    onClose,
  }: {
    tile: MapTile;
    facilityDefs: Map<string, FacilityDef>;
    playerResources: Resources;
    /** Set of tech def IDs the player has discovered. */
    discoveredTechIds: ReadonlySet<string>;
    /** Maps tech def ID → display name for locked-facility labels. */
    techNames: ReadonlyMap<string, string>;
    onBuild: (defId: string) => void;
    onDemolish: () => void;
    onClose: () => void;
  } = $props();

  function isTechUnlocked(def: FacilityDef): boolean {
    return def.requiredTechId == null || discoveredTechIds.has(def.requiredTechId);
  }

  // Facilities whose tile type matches — split into unlocked and locked.
  const tileEligible = $derived(
    [...facilityDefs.values()].filter(def =>
      def.allowedTileTypes.length === 0 ||
      def.allowedTileTypes.includes(tile.type),
    ),
  );

  const eligible = $derived(tileEligible.filter(isTechUnlocked));
  const locked   = $derived(tileEligible.filter(def => !isTechUnlocked(def)));

  function canAfford(cost: Partial<Resources>): boolean {
    return (
      (cost.funding       == null || playerResources.funding       >= cost.funding)       &&
      (cost.materials     == null || playerResources.materials     >= cost.materials)     &&
      (cost.politicalWill == null || playerResources.politicalWill >= cost.politicalWill)
    );
  }

  function formatCost(cost: Partial<Resources>): string {
    const p: string[] = [];
    if (cost.funding       != null) p.push(`${cost.funding}F`);
    if (cost.materials     != null) p.push(`${cost.materials}M`);
    if (cost.politicalWill != null) p.push(`${cost.politicalWill}W`);
    return p.join(' · ');
  }

  function formatOutput(def: FacilityDef): string[] {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(def.fieldOutput)) {
      if (v) lines.push(`+${v} ${k.slice(0, 4).toUpperCase()}`);
    }
    for (const [k, v] of Object.entries(def.resourceOutput)) {
      if (v) {
        const label = k === 'funding' ? 'Fund' : k === 'materials' ? 'Mat' : 'Will';
        lines.push(`+${v} ${label}/turn`);
      }
    }
    if (def.depletes) lines.push('Depletes over time');
    return lines;
  }

  const tileLabel: Record<string, string> = {
    urban: 'Urban', industrial: 'Industrial', coastal: 'Coastal',
    highland: 'Highland', forested: 'Forested', arid: 'Arid', agricultural: 'Agricultural',
  };

  /** The facility def currently on this tile, if any. */
  const occupyingDef = $derived(
    tile.facilityId != null
      ? [...facilityDefs.values()].find(d => tile.facilityId?.startsWith(d.id)) ?? null
      : null,
  );
</script>

<div class="picker-backdrop" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="none" tabindex="-1">
  <div
    class="picker"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    tabindex="-1"
    aria-label="Facility Picker"
  >
    <div class="picker-header">
      <span class="picker-title">BUILD FACILITY</span>
      <span class="tile-type">{tileLabel[tile.type] ?? tile.type} · ({tile.coord.q},{tile.coord.r})</span>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    {#if occupyingDef}
      <!-- Occupied tile: show facility info and optional demolish -->
      <div class="occupied-panel">
        <div class="occupied-header">
          <span class="occupied-name">{occupyingDef.name}</span>
          <span class="occupied-badge">BUILT</span>
        </div>
        <span class="facility-desc">{occupyingDef.description}</span>
        <div class="facility-outputs" style="margin-top: 0.4rem;">
          {#each formatOutput(occupyingDef) as line}
            <span class="output-line">{line}</span>
          {/each}
        </div>
        <div class="upkeep">Upkeep: {formatCost(occupyingDef.upkeepCost) || 'Free'}</div>
        <div class="demolish-row">
          {#if occupyingDef.canDelete}
            <button class="demolish-btn" onclick={onDemolish}>
              DEMOLISH
            </button>
          {:else}
            <span class="no-demolish">Cannot be demolished</span>
          {/if}
        </div>
      </div>
    {:else if eligible.length === 0 && locked.length === 0}
      <div class="no-facilities">No facilities available for this tile type.</div>
    {:else}
      <div class="facility-list">
        {#each eligible as def}
          {@const affordable = canAfford(def.buildCost)}
          <div class="facility-row" class:unaffordable={!affordable}>
            <div class="facility-info">
              <span class="facility-name">{def.name}</span>
              <span class="facility-desc">{def.description}</span>
              <div class="facility-outputs">
                {#each formatOutput(def) as line}
                  <span class="output-line">{line}</span>
                {/each}
              </div>
              <div class="upkeep">
                Upkeep: {formatCost(def.upkeepCost) || 'Free'}
              </div>
            </div>
            <div class="facility-action">
              <div class="build-cost" class:cant-afford={!affordable}>
                {formatCost(def.buildCost) || 'Free'}
              </div>
              <button
                class="build-btn"
                disabled={!affordable}
                onclick={() => onBuild(def.id)}
              >
                {affordable ? 'BUILD' : 'AFFORD?'}
              </button>
            </div>
          </div>
        {/each}

        {#each locked as def}
          <div class="facility-row locked-row">
            <div class="facility-info">
              <span class="facility-name locked-name">{def.name}</span>
              <span class="facility-desc">{def.description}</span>
            </div>
            <div class="facility-action">
              <div class="locked-label">
                REQUIRES<br>{techNames.get(def.requiredTechId!) ?? def.requiredTechId}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .picker-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .picker {
    background: #0d1520;
    border: 1px solid #2a4060;
    min-width: 22rem;
    max-width: 28rem;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
  }

  .picker-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid #1e2a3a;
    background: #0a1018;
  }

  .picker-title {
    color: #6aaad8;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
  }

  .tile-type {
    color: #5a6878;
    font-size: 0.65rem;
    flex: 1;
  }

  .close-btn {
    font-family: inherit;
    font-size: 0.7rem;
    background: transparent;
    border: none;
    color: #4a5868;
    cursor: pointer;
    padding: 0 0.2rem;
  }
  .close-btn:hover { color: #c8d0d8; }

  .no-facilities {
    padding: 1rem;
    color: #3a4858;
    font-style: italic;
  }

  .facility-list {
    display: flex;
    flex-direction: column;
    max-height: 22rem;
    overflow-y: auto;
  }

  .facility-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid #141e2a;
    align-items: flex-start;
  }

  .facility-row:hover { background: #101825; }
  .facility-row.unaffordable { opacity: 0.55; }

  .facility-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .facility-name {
    color: #c8d0d8;
    font-size: 0.78rem;
  }

  .facility-desc {
    color: #5a6a7a;
    font-size: 0.65rem;
    line-height: 1.4;
  }

  .facility-outputs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .output-line {
    font-size: 0.62rem;
    color: #4a9b7a;
    border: 1px solid #1a4030;
    padding: 0 0.3rem;
  }

  .upkeep {
    font-size: 0.6rem;
    color: #5a4a2a;
  }

  .facility-action {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .build-cost {
    font-size: 0.7rem;
    color: #c8d050;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .build-cost.cant-afford { color: #9b4a4a; }

  .build-btn {
    font-family: inherit;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.7rem;
    border: 1px solid #2a6050;
    background: transparent;
    color: #4a9b7a;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .build-btn:hover:not(:disabled) { background: #0a2018; }
  .build-btn:disabled {
    color: #2a3848;
    border-color: #1a2535;
    cursor: not-allowed;
  }

  .locked-row {
    opacity: 0.4;
  }

  .locked-name {
    color: #4a5868;
  }

  .locked-label {
    font-size: 0.58rem;
    color: #5a4a2a;
    text-align: right;
    line-height: 1.5;
    letter-spacing: 0.05em;
  }

  .occupied-panel {
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .occupied-header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .occupied-name {
    color: #c8d0d8;
    font-size: 0.82rem;
  }

  .occupied-badge {
    font-size: 0.58rem;
    color: #4a9b7a;
    border: 1px solid #1a4030;
    padding: 0 0.3rem;
    letter-spacing: 0.1em;
  }

  .demolish-row {
    margin-top: 0.6rem;
    display: flex;
    justify-content: flex-end;
  }

  .demolish-btn {
    font-family: inherit;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.7rem;
    border: 1px solid #602020;
    background: transparent;
    color: #c04040;
    cursor: pointer;
    transition: background 0.15s;
  }
  .demolish-btn:hover { background: #200808; }

  .no-demolish {
    font-size: 0.6rem;
    color: #3a4858;
    font-style: italic;
  }
</style>
