<script lang="ts">
  import type { SpaceNode, FacilityDef, FacilityInstance, OngoingAction, Resources } from '../../engine/types';
  import { getChainRoot, isLunarChainTaken } from '../../engine/facilities';

  let {
    node,
    facilityDefs,
    facilityInstances,
    spaceNodes,
    playerResources,
    discoveredTechIds,
    techNames,
    constructionQueue,
    launchCapacity,
    remainingCapacity,
    launchAllocation,
    upgradeDef,
    actionsThisTurn,
    maxActionsPerTurn,
    onBuild,
    onUpgrade,
    onClose,
  }: {
    node: SpaceNode;
    facilityDefs: Map<string, FacilityDef>;
    facilityInstances: FacilityInstance[];
    spaceNodes: SpaceNode[];
    playerResources: Resources;
    discoveredTechIds: ReadonlySet<string>;
    techNames: ReadonlyMap<string, string>;
    constructionQueue: OngoingAction[];
    launchCapacity: number;
    remainingCapacity: number;
    launchAllocation: Record<string, boolean>;
    /** Next-tier facility def, if upgrade is available and tech is discovered. */
    upgradeDef: FacilityDef | undefined;
    actionsThisTurn: number;
    maxActionsPerTurn: number;
    onBuild: (defId: string) => void;
    onUpgrade: () => void;
    onClose: () => void;
  } = $props();

  const NODE_TYPE_LABELS: Record<string, string> = {
    lowEarthOrbit: 'Low Earth Orbit',
    cislunarPoint: 'Cislunar Point',
    trojanPoint: 'Trojan Point',
    lunarSurface: 'Lunar Surface',
  };

  const atActionCap = $derived(actionsThisTurn >= maxActionsPerTurn);
  const isSupplied = $derived(launchAllocation[node.id] !== false);

  /** The facility currently on this node, if any. */
  const currentInstance = $derived(
    facilityInstances.find((f) => f.locationKey === node.id) ?? null,
  );
  const currentDef = $derived(
    currentInstance ? (facilityDefs.get(currentInstance.defId) ?? null) : null,
  );

  /** Construction queue entry targeting this node, if any. */
  const pendingAction = $derived(
    constructionQueue.find((a) => a.spaceNodeId === node.id) ?? null,
  );

  /** The def being built (pending), if any. */
  const pendingDef = $derived(
    pendingAction ? (facilityDefs.get(pendingAction.facilityDefId) ?? null) : null,
  );

  /** Facility defs buildable on this node type — split into available, taken-elsewhere, and locked. */
  const buildableDefs = $derived(
    [...facilityDefs.values()].filter((def) => {
      if (!def.allowedNodeTypes?.includes(node.type)) return false;
      // Only root-of-chain facilities (no upgradesFrom) appear as initial builds
      if (def.upgradesFrom) return false;
      return true;
    }),
  );

  const availableDefs = $derived(
    buildableDefs.filter(
      (def) =>
        (def.requiredTechId == null || discoveredTechIds.has(def.requiredTechId)) &&
        !isLunarChainTaken(def.id, node.id, spaceNodes, facilityDefs, constructionQueue),
    ),
  );

  /** Chains already committed to another lunar site (built or under construction). */
  const takenDefs = $derived(
    node.type === 'lunarSurface'
      ? buildableDefs.filter(
          (def) =>
            (def.requiredTechId == null || discoveredTechIds.has(def.requiredTechId)) &&
            isLunarChainTaken(def.id, node.id, spaceNodes, facilityDefs, constructionQueue),
        )
      : [],
  );

  const lockedDefs = $derived(
    buildableDefs.filter(
      (def) =>
        def.requiredTechId != null &&
        !discoveredTechIds.has(def.requiredTechId) &&
        !isLunarChainTaken(def.id, node.id, spaceNodes, facilityDefs, constructionQueue),
    ),
  );

  /** For a taken chain, find the label of the site that has it. */
  function takenAtLabel(def: FacilityDef): string {
    const root = getChainRoot(def.id, facilityDefs);
    // Check built
    for (const n of spaceNodes) {
      if (n.type !== 'lunarSurface' || n.id === node.id || !n.facilityId) continue;
      if (getChainRoot(n.facilityId, facilityDefs) === root) return n.label;
    }
    // Check queue
    const lunarIds = new Set(spaceNodes.filter((n) => n.type === 'lunarSurface').map((n) => n.id));
    for (const action of constructionQueue) {
      if (!action.spaceNodeId || action.spaceNodeId === node.id) continue;
      if (!lunarIds.has(action.spaceNodeId)) continue;
      if (getChainRoot(action.facilityDefId, facilityDefs) === root) {
        return spaceNodes.find((n) => n.id === action.spaceNodeId)?.label ?? action.spaceNodeId;
      }
    }
    return 'another site';
  }

  function canAfford(cost: Partial<Resources>): boolean {
    return (
      (cost.funding == null || playerResources.funding >= cost.funding) &&
      (cost.materials == null || playerResources.materials >= cost.materials) &&
      (cost.politicalWill == null || playerResources.politicalWill >= cost.politicalWill)
    );
  }

  function formatCost(cost: Partial<Resources>): string {
    const p: string[] = [];
    if (cost.funding != null) p.push(`${cost.funding}F`);
    if (cost.materials != null) p.push(`${cost.materials}M`);
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

  function conditionLabel(c: number): string {
    if (c >= 0.9) return 'Good';
    if (c >= 0.6) return 'Fair';
    if (c >= 0.3) return 'Poor';
    return 'Critical';
  }

  let showBuildList = $state(false);
</script>

<div
  class="picker-backdrop"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  role="none"
  tabindex="-1"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="picker"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    tabindex="-1"
    aria-label="Space Node"
  >
    <!-- Header -->
    <div class="picker-header">
      <span class="picker-title">NODE</span>
      <span class="node-label">{node.label}</span>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    <!-- Node meta -->
    <div class="node-meta">
      <span class="node-type">{NODE_TYPE_LABELS[node.type] ?? node.type}</span>
      <span class="launch-cost">Launch cost: {node.launchCost}M</span>
      <span class="capacity-info">Capacity: {launchCapacity - remainingCapacity}/{launchCapacity}</span>
    </div>

    <!-- Current state -->
    {#if pendingAction && pendingDef}
      <!-- Under construction -->
      <div class="state-panel construction-panel">
        <span class="state-badge construction-badge">UNDER CONSTRUCTION</span>
        <span class="state-name">{pendingDef.name}</span>
        <span class="state-turns">{pendingAction.turnsRemaining} turn{pendingAction.turnsRemaining !== 1 ? 's' : ''} remaining</span>
      </div>
    {:else if currentInstance && currentDef}
      <!-- Occupied -->
      <div class="state-panel occupied-panel">
        <div class="occupied-header">
          <span class="state-badge" class:occupied-badge={isSupplied} class:unsupplied-badge={!isSupplied}>{isSupplied ? 'ACTIVE' : 'UNSUPPLIED'}</span>
          <span class="state-name">{currentDef.name}</span>
          {#if currentInstance.condition < 1}
            <span
              class="condition-badge"
              style="color: {currentInstance.condition >= 0.6 ? '#c8a040' : '#9b4a4a'}"
            >
              {conditionLabel(currentInstance.condition)}
            </span>
          {/if}
        </div>
        <div class="facility-outputs">
          {#each formatOutput(currentDef) as line}
            <span class="output-chip">{line}</span>
          {/each}
        </div>
        <div class="upkeep-line">Upkeep: {formatCost(currentDef.upkeepCost) || 'Free'}</div>
        {#if currentDef.supplyCost && currentDef.supplyCost > 0}
          <div class="supply-line">Supply: {currentDef.supplyCost} launch unit{currentDef.supplyCost !== 1 ? 's' : ''}</div>
        {/if}

        {#if upgradeDef}
          {@const upgradeAffordable = canAfford(upgradeDef.buildCost)}
          <div class="upgrade-row">
            <button
              class="upgrade-btn"
              disabled={atActionCap || !upgradeAffordable}
              onclick={onUpgrade}
            >
              ↑ Upgrade → {upgradeDef.name}
              {#if !upgradeAffordable}
                <span class="upgrade-cost cant-afford">({formatCost(upgradeDef.buildCost)})</span>
              {:else}
                <span class="upgrade-cost">({formatCost(upgradeDef.buildCost)})</span>
              {/if}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Vacant -->
      <div class="state-panel vacant-panel">
        <span class="state-badge vacant-badge">VACANT</span>
        <span class="vacant-hint">No facility constructed.</span>
      </div>
    {/if}

    <!-- Build section: only shown when node is truly empty (not under construction, not occupied) -->
    {#if !pendingAction && !currentInstance}
      <div class="build-section">
        <div class="build-header">
          <span class="build-title">BUILD FACILITY</span>
          {#if showBuildList}
            <button class="close-build-btn" onclick={() => showBuildList = false}>✕</button>
          {/if}
        </div>

        {#if !showBuildList}
          <button
            class="open-build-btn"
            disabled={atActionCap}
            onclick={() => showBuildList = true}
          >
            {atActionCap ? 'NO ACTIONS REMAINING' : '+ SELECT FACILITY TO BUILD'}
          </button>
        {:else}
          <div class="facility-list">
            {#each availableDefs as def}
              {@const affordable = canAfford(def.buildCost)}
              {@const supplyCost = def.supplyCost ?? 0}
              {@const disabled = !affordable || atActionCap}
              <div class="facility-row" class:unaffordable={disabled}>
                <div class="facility-info">
                  <span class="facility-name">{def.name}</span>
                  <span class="facility-desc">{def.description}</span>
                  <div class="facility-outputs">
                    {#each formatOutput(def) as line}
                      <span class="output-chip">{line}</span>
                    {/each}
                  </div>
                  <div class="facility-meta">
                    <span class="upkeep">Upkeep: {formatCost(def.upkeepCost) || 'Free'}</span>
                    {#if supplyCost > 0}
                      <span class="supply-meta" class:over-capacity={supplyCost > remainingCapacity}>
                        {supplyCost}u supply{supplyCost > remainingCapacity ? ' — will start unsupplied' : ''}
                      </span>
                    {/if}
                    <span class="build-time">{def.buildTime === 1 ? '1 turn' : `${def.buildTime} turns`}</span>
                  </div>
                </div>
                <div class="facility-action">
                  <div class="build-cost" class:cant-afford={!affordable}>
                    {formatCost(def.buildCost) || 'Free'}
                  </div>
                  <button
                    class="build-btn"
                    {disabled}
                    onclick={() => { onBuild(def.id); showBuildList = false; }}
                  >
                    {affordable ? 'BUILD' : 'AFFORD?'}
                  </button>
                </div>
              </div>
            {/each}

            {#each takenDefs as def}
              <div class="facility-row locked-row">
                <div class="facility-info">
                  <span class="facility-name locked-name">{def.name}</span>
                  <span class="facility-desc">{def.description}</span>
                </div>
                <div class="facility-action">
                  <div class="locked-label taken-label">
                    BUILT AT<br />{takenAtLabel(def)}
                  </div>
                </div>
              </div>
            {/each}

            {#each lockedDefs as def}
              <div class="facility-row locked-row">
                <div class="facility-info">
                  <span class="facility-name locked-name">{def.name}</span>
                  <span class="facility-desc">{def.description}</span>
                </div>
                <div class="facility-action">
                  <div class="locked-label">
                    REQUIRES<br />{techNames.get(def.requiredTechId!) ?? def.requiredTechId}
                  </div>
                </div>
              </div>
            {/each}

            {#if availableDefs.length === 0 && takenDefs.length === 0 && lockedDefs.length === 0}
              <div class="no-facilities">No facilities available for this node type.</div>
            {/if}
          </div>
        {/if}
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
    background: var(--surface-2);
    border: 1px solid #1e3a5a;
    min-width: 22rem;
    max-width: 28rem;
    font-size: var(--fs-md);
    letter-spacing: 0.04em;
    max-height: 90vh;
    overflow-y: auto;
  }

  .picker-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-1);
    position: sticky;
    top: 0;
  }

  .picker-title {
    color: #4a90c0;
    font-size: var(--fs-md);
    letter-spacing: var(--ls-wider);
  }

  .node-label {
    color: #8ab8d8;
    font-size: var(--fs-md);
    flex: 1;
  }

  .close-btn {
    font-family: inherit;
    font-size: var(--fs-md);
    background: transparent;
    border: none;
    color: #4a5868;
    cursor: pointer;
    padding: 0 0.2rem;
  }
  .close-btn:hover { color: var(--text-primary); }

  .node-meta {
    display: flex;
    gap: 1rem;
    padding: 0.4rem 0.8rem;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-1);
  }

  .node-type {
    color: #3a6888;
    font-size: var(--fs-sm);
    letter-spacing: 0.08em;
  }

  .launch-cost {
    color: #3a5a7a;
    font-size: var(--fs-sm);
  }

  .capacity-info {
    color: #3a5a7a;
    font-size: var(--fs-sm);
    margin-left: auto;
  }

  /* State panels */
  .state-panel {
    padding: 0.7rem 0.8rem;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .state-badge {
    font-size: var(--fs-xs);
    letter-spacing: 0.18em;
    padding: 0.1rem 0.35rem;
    align-self: flex-start;
    border: 1px solid;
  }

  .construction-badge {
    color: var(--warn);
    border-color: #6a5020;
  }

  .occupied-badge {
    color: #4a90c0;
    border-color: #1e4060;
  }

  .unsupplied-badge {
    color: #c07040;
    border-color: #603820;
  }

  .vacant-badge {
    color: var(--text-muted);
    border-color: #1e2a38;
  }

  .occupied-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .state-name {
    color: var(--text-primary);
    font-size: var(--fs-md);
  }

  .state-turns {
    color: var(--warn);
    font-size: var(--fs-base);
  }

  .condition-badge {
    font-size: var(--fs-sm);
    letter-spacing: 0.06em;
  }

  .facility-outputs {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .output-chip {
    font-size: var(--fs-sm);
    color: var(--ok);
    border: 1px solid var(--ok-border);
    padding: 0 0.22rem;
  }

  .upkeep-line, .supply-line {
    font-size: var(--fs-sm);
    color: #5a4a2a;
  }

  .supply-line {
    color: #3a6888;
  }

  .vacant-hint {
    color: #2a3848;
    font-size: var(--fs-base);
    font-style: italic;
  }

  .upgrade-row {
    margin-top: 0.3rem;
  }

  .upgrade-btn {
    font-family: inherit;
    font-size: var(--fs-sm);
    letter-spacing: 0.06em;
    padding: 0.28rem 0.7rem;
    border: 1px solid #2a5870;
    background: var(--surface-alt);
    color: #4a9090;
    cursor: pointer;
    transition: all 0.1s;
  }
  .upgrade-btn:hover:not(:disabled) {
    color: #70d0d0;
    border-color: #4a8080;
  }
  .upgrade-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .upgrade-cost {
    font-size: var(--fs-xs);
    color: var(--funding);
    opacity: 0.75;
  }
  .upgrade-cost.cant-afford {
    color: #9b4a4a;
    opacity: 1;
  }

  /* Build section */
  .build-section {
    padding: 0;
  }

  .build-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.8rem;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-subtle);
  }

  .build-title {
    color: var(--ok);
    font-size: var(--fs-base);
    letter-spacing: 0.12em;
    flex: 1;
  }

  .close-build-btn {
    font-family: inherit;
    font-size: var(--fs-base);
    background: transparent;
    border: none;
    color: #4a5868;
    cursor: pointer;
    padding: 0 0.2rem;
  }
  .close-build-btn:hover { color: var(--text-primary); }

  .open-build-btn {
    font-family: inherit;
    font-size: var(--fs-base);
    letter-spacing: 0.06em;
    width: 100%;
    padding: 0.6rem;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    background: #0d1825;
    color: var(--ok);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .open-build-btn:hover:not(:disabled) { background: var(--ok-hover); }
  .open-build-btn:disabled { color: #3a4858; cursor: not-allowed; }

  .facility-list {
    display: flex;
    flex-direction: column;
    max-height: 22rem;
    overflow-y: auto;
  }

  .facility-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--surface-3);
    align-items: flex-start;
  }
  .facility-row:hover { background: var(--surface-2); }
  .facility-row.unaffordable { opacity: 0.55; }

  .facility-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .facility-name { color: var(--text-primary); font-size: var(--fs-md); }
  .facility-desc { color: #5a6a7a; font-size: var(--fs-sm); line-height: 1.4; }

  .facility-meta {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .upkeep { font-size: var(--fs-xs); color: #5a4a2a; }
  .supply-meta { font-size: var(--fs-xs); color: #3a6888; }
  .supply-meta.over-capacity { color: var(--warn); }
  .build-time { font-size: var(--fs-xs); color: #4a5a6a; }

  .capacity-warning {
    font-size: var(--fs-xs);
    color: #9b4a4a;
    letter-spacing: 0.04em;
  }

  .facility-action {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .build-cost {
    font-size: var(--fs-base);
    color: var(--funding);
    text-align: right;
  }
  .build-cost.cant-afford { color: #9b4a4a; }

  .build-btn {
    font-family: inherit;
    font-size: var(--fs-sm);
    letter-spacing: 0.1em;
    padding: 0.28rem 0.65rem;
    border: 1px solid var(--ok-border);
    background: transparent;
    color: var(--ok);
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .build-btn:hover:not(:disabled) { background: var(--ok-hover); }
  .build-btn:disabled { color: #2a3848; border-color: var(--border-subtle); cursor: not-allowed; }

  .locked-row { opacity: 0.4; }
  .locked-name { color: #4a5868; }
  .locked-label {
    font-size: var(--fs-xs);
    color: #5a4a2a;
    text-align: right;
    line-height: 1.5;
    letter-spacing: 0.04em;
  }

  .taken-label {
    color: #4a5a6a;
  }

  .no-facilities { padding: 0.8rem; color: var(--text-muted); font-style: italic; }
</style>
