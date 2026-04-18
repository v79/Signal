<script lang="ts">
  import type { FacilityDef, FacilityInstance, MapTile, Resources, TileActionDef } from '../../engine/types';
  import { findContiguousFreeStart } from '../../engine/facilities';

  let {
    tile,
    facilityDefs,
    tileActionDefs,
    playerResources,
    discoveredTechIds,
    techNames,
    builtDefIds,
    facilityInstances,
    actionsThisTurn,
    maxActionsPerTurn,
    onBuild,
    onDemolish,
    onTileAction,
    onClose,
  }: {
    tile: MapTile;
    facilityDefs: Map<string, FacilityDef>;
    tileActionDefs: Map<string, TileActionDef>;
    playerResources: Resources;
    discoveredTechIds: ReadonlySet<string>;
    techNames: ReadonlyMap<string, string>;
    builtDefIds: ReadonlySet<string>;
    facilityInstances: FacilityInstance[];
    actionsThisTurn: number;
    maxActionsPerTurn: number;
    onBuild: (defId: string) => void;
    onDemolish: (slotIndex: number) => void;
    onTileAction: (tileActionDefId: string) => void;
    onClose: () => void;
  } = $props();

  /** Which slot's BUILD list is expanded (null = none). */
  let activeSlot = $state<number | null>(null);

  const atActionCap = $derived(actionsThisTurn >= maxActionsPerTurn);

  function isTechUnlocked(def: FacilityDef): boolean {
    return def.requiredTechId == null || discoveredTechIds.has(def.requiredTechId);
  }

  function isUniqueBlocked(def: FacilityDef): boolean {
    return def.unique === true && builtDefIds.has(def.id);
  }

  function isDuplicateOnTile(def: FacilityDef): boolean {
    return facilityInstances.some((f) => f.defId === def.id);
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

  function formatOutput(def: FacilityDef): { text: string; climate?: boolean; pollution?: boolean }[] {
    const lines: { text: string; climate?: boolean; pollution?: boolean }[] = [];
    for (const [k, v] of Object.entries(def.fieldOutput)) {
      if (v) lines.push({ text: `+${v} ${k.slice(0, 4).toUpperCase()}` });
    }
    for (const [k, v] of Object.entries(def.resourceOutput)) {
      if (v) {
        const label = k === 'funding' ? 'Fund' : k === 'materials' ? 'Mat' : 'Will';
        lines.push({ text: `+${v} ${label}/turn` });
      }
    }
    if (def.climateImpact) {
      const sign = def.climateImpact > 0 ? '+' : '';
      lines.push({ text: `${sign}${def.climateImpact} climate/turn`, climate: true, pollution: def.climateImpact > 0 });
    }
    if (def.depletes) lines.push({ text: 'Depletes over time' });
    return lines;
  }

  function conditionLabel(c: number): string {
    if (c >= 0.9) return 'Good';
    if (c >= 0.6) return 'Fair';
    if (c >= 0.3) return 'Poor';
    return 'Critical';
  }

  const tileLabel: Record<string, string> = {
    urban: 'Urban', industrial: 'Industrial', coastal: 'Coastal',
    highland: 'Highland', forested: 'Forested', arid: 'Arid', agricultural: 'Agricultural',
  };

  const SLOT_LABELS = ['SLOT 0', 'SLOT 1', 'SLOT 2'];
  const DESTROYED_LABELS: Record<string, string> = {
    flooded: 'SUBMERGED', dustbowl: 'DUST BOWL', irradiated: 'IRRADIATED',
  };
  const DESTROYED_DESC: Record<string, string> = {
    flooded: 'This coastal zone has been permanently submerged by rising sea levels. No construction is possible.',
    dustbowl: 'Sustained drought has rendered this tile uninhabitable.',
    irradiated: 'Contamination has made this tile unsafe. No construction is permitted.',
  };

  const isPending = $derived(tile.pendingActionId != null);

  /** Per-slot data: instance + def, and whether this is the primary (lowest) slot. */
  const slotData = $derived(
    tile.facilitySlots.map((instanceId, idx) => {
      const instance = instanceId ? (facilityInstances.find((f) => f.id === instanceId) ?? null) : null;
      const def = instance ? (facilityDefs.get(instance.defId) ?? null) : null;
      const isPrimary = instance ? tile.facilitySlots.indexOf(instanceId) === idx : false;
      return { idx, instanceId, instance, def, isPrimary };
    }),
  );

  /** Facility defs available to build anywhere on this tile (used for the build list). */
  const buildableForTile = $derived(
    [...facilityDefs.values()].filter((def) => {
      if (def.id === 'hq') return false;
      if (def.era !== 'earth') return false;
      if (def.allowedTileTypes.length > 0 && !def.allowedTileTypes.includes(tile.type)) return false;
      if (!isTechUnlocked(def)) return false;
      if (isUniqueBlocked(def)) return false;
      if (isDuplicateOnTile(def)) return false;
      return findContiguousFreeStart(tile.facilitySlots, def.slotCost ?? 1) !== null;
    }),
  );

  const lockedForTile = $derived(
    [...facilityDefs.values()].filter((def) => {
      if (def.id === 'hq') return false;
      if (def.era !== 'earth') return false;
      if (def.allowedTileTypes.length > 0 && !def.allowedTileTypes.includes(tile.type)) return false;
      return !isTechUnlocked(def);
    }),
  );

  const freeSlotCount = $derived(tile.facilitySlots.filter((s) => s === null).length);

  /** Tile actions applicable to this tile. */
  const applicableTileActions = $derived(
    [...tileActionDefs.values()].filter((ta) => {
      // `appliesTo` is a tile-type constraint; `appliesToDestroyed` is a destroyed-status requirement.
      // When both are set, BOTH must match (e.g. cleanIndustrialSite: industrial AND irradiated).
      // When only `appliesTo` is set, action applies to healthy tiles of those types.
      // When only `appliesToDestroyed` is set, action applies to any tile with matching status.
      const typeMatch = ta.appliesTo.length === 0 || ta.appliesTo.includes(tile.type);
      const requiresDestroyed = ta.appliesToDestroyed.length > 0;
      const matchesDestroyed = requiresDestroyed && tile.destroyedStatus != null && ta.appliesToDestroyed.includes(tile.destroyedStatus);
      const matchesHealthy = !requiresDestroyed && tile.destroyedStatus == null;
      if (!typeMatch || (!matchesDestroyed && !matchesHealthy)) return false;
      // Skip sea wall if already protected
      if (ta.seaWallProtection && tile.seaWallProtected) return false;
      return true;
    }),
  );

  const availableTileActions = $derived(
    applicableTileActions.filter(
      (ta) => ta.requiredTechId == null || discoveredTechIds.has(ta.requiredTechId),
    ),
  );

  const lockedTileActions = $derived(
    applicableTileActions.filter(
      (ta) => ta.requiredTechId != null && !discoveredTechIds.has(ta.requiredTechId),
    ),
  );

  function formatTileActionCost(cost: Partial<Resources>): string {
    const p: string[] = [];
    if (cost.funding != null) p.push(`${cost.funding}F`);
    if (cost.materials != null) p.push(`${cost.materials}M`);
    if (cost.politicalWill != null) p.push(`${cost.politicalWill}W`);
    return p.join(' · ');
  }
</script>

<div
  class="picker-backdrop"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  role="none"
  tabindex="-1"
>
  <div
    class="picker"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    tabindex="-1"
    aria-label="Facility Picker"
  >
    <div class="picker-header">
      <span class="picker-title">TILE</span>
      <span class="tile-type">{tileLabel[tile.type] ?? tile.type} · ({tile.coord.q},{tile.coord.r})</span>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    {#if tile.destroyedStatus}
      <div class="destroyed-panel">
        <span class="destroyed-badge">{DESTROYED_LABELS[tile.destroyedStatus] ?? tile.destroyedStatus}</span>
        <span class="destroyed-desc">{DESTROYED_DESC[tile.destroyedStatus] ?? 'This tile has been destroyed.'}</span>
      </div>
    {:else if isPending}
      <div class="pending-panel">
        <span class="pending-label">Construction in progress…</span>
        <span class="pending-hint">End your turn to advance work.</span>
      </div>
    {:else}
      <!-- 3-slot panels -->
      <div class="slots-section">
        {#each slotData as slot}
          <div class="slot-row" class:slot-secondary={slot.instance && !slot.isPrimary}>
            <span class="slot-label">{SLOT_LABELS[slot.idx]}</span>
            {#if slot.instance && slot.def}
              {#if slot.isPrimary}
                <div class="slot-occupied">
                  <span class="slot-fac-name">{slot.def.name}</span>
                  {#if slot.instance.condition < 1 && slot.def.id !== 'hq'}
                    <span class="condition-badge" style="color: {slot.instance.condition >= 0.6 ? '#c8a040' : '#9b4a4a'}">
                      {conditionLabel(slot.instance.condition)}
                    </span>
                  {/if}
                  {#if slot.def.canDelete}
                    <button class="demolish-btn" onclick={() => onDemolish(slot.idx)}>DECOMMISSION</button>
                  {:else}
                    <span class="no-demolish">Permanent</span>
                  {/if}
                </div>
              {:else}
                <div class="slot-secondary-label">↑ {slot.def.name} (multi-slot)</div>
              {/if}
            {:else}
              <div class="slot-empty">
                <span class="empty-label">empty</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Build section: only shown when there are free slots -->
      {#if freeSlotCount > 0}
        <div class="build-section">
          <div class="build-section-header">
            <span class="build-section-title">BUILD FACILITY</span>
            <span class="build-section-hint">{freeSlotCount} slot{freeSlotCount > 1 ? 's' : ''} free</span>
            {#if activeSlot !== null}
              <button class="close-build-btn" onclick={() => activeSlot = null}>✕</button>
            {/if}
          </div>

          {#if activeSlot === null}
            <button class="open-build-btn" disabled={atActionCap} onclick={() => activeSlot = 0}>
              {atActionCap ? 'NO ACTIONS REMAINING' : '+ SELECT FACILITY TO BUILD'}
            </button>
          {:else}
            <div class="facility-list">
              {#each buildableForTile as def}
                {@const affordable = canAfford(def.buildCost)}
                <div class="facility-row" class:unaffordable={!affordable}>
                  <div class="facility-info">
                    <span class="facility-name">{def.name}</span>
                    <span class="facility-desc">{def.description}</span>
                    <div class="facility-outputs">
                      {#each formatOutput(def) as line}
                        <span class="output-line" class:climate-line={line.climate} class:pollution-line={line.pollution}>{line.text}</span>
                      {/each}
                    </div>
                    <div class="upkeep">Upkeep: {formatCost(def.upkeepCost) || 'Free'}</div>
                    <div class="build-time">
                      {def.slotCost && def.slotCost > 1 ? `${def.slotCost} slots · ` : ''}Build: {def.buildTime === 0 ? 'Instant' : def.buildTime === 1 ? '1 turn' : `${def.buildTime} turns`}
                    </div>
                  </div>
                  <div class="facility-action">
                    <div class="build-cost" class:cant-afford={!affordable}>{formatCost(def.buildCost) || 'Free'}</div>
                    <button class="build-btn" disabled={!affordable} onclick={() => { onBuild(def.id); activeSlot = null; }}>
                      {affordable ? 'BUILD' : 'AFFORD?'}
                    </button>
                  </div>
                </div>
              {/each}

              {#each lockedForTile as def}
                <div class="facility-row locked-row">
                  <div class="facility-info">
                    <span class="facility-name locked-name">{def.name}</span>
                    <span class="facility-desc">{def.description}</span>
                  </div>
                  <div class="facility-action">
                    <div class="locked-label">REQUIRES<br />{techNames.get(def.requiredTechId!) ?? def.requiredTechId}</div>
                  </div>
                </div>
              {/each}

              {#if buildableForTile.length === 0 && lockedForTile.length === 0}
                <div class="no-facilities">No facilities available for this tile type.</div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tile actions section: terrain modification -->
      {#if applicableTileActions.length > 0}
        <div class="tile-action-section">
          <div class="build-section-header">
            <span class="tile-action-title">TERRAIN ACTIONS</span>
          </div>
          <div class="facility-list">
            {#each availableTileActions as ta}
              {@const affordable = canAfford(ta.buildCost)}
              <div class="facility-row" class:unaffordable={!affordable}>
                <div class="facility-info">
                  <span class="facility-name">{ta.name}</span>
                  <span class="facility-desc">{ta.description}</span>
                  {#if ta.climateEffect !== 0}
                    <div class="facility-outputs">
                      <span class="output-line" class:climate-line={true} class:pollution-line={ta.climateEffect > 0}>
                        {ta.climateEffect > 0 ? '+' : ''}{ta.climateEffect} climate
                      </span>
                    </div>
                  {/if}
                  <div class="build-time">
                    {ta.buildTime === 1 ? '1 turn' : `${ta.buildTime} turns`}
                  </div>
                </div>
                <div class="facility-action">
                  <div class="build-cost" class:cant-afford={!affordable}>{formatTileActionCost(ta.buildCost) || 'Free'}</div>
                  <button
                    class="build-btn"
                    disabled={!affordable || atActionCap}
                    onclick={() => onTileAction(ta.id)}
                  >
                    {affordable ? 'ENACT' : 'AFFORD?'}
                  </button>
                </div>
              </div>
            {/each}
            {#each lockedTileActions as ta}
              <div class="facility-row locked-row">
                <div class="facility-info">
                  <span class="facility-name locked-name">{ta.name}</span>
                  <span class="facility-desc">{ta.description}</span>
                </div>
                <div class="facility-action">
                  <div class="locked-label">REQUIRES<br />{techNames.get(ta.requiredTechId!) ?? ta.requiredTechId}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
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
    border: 1px solid var(--border-active);
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
    color: #6aaad8;
    font-size: var(--fs-md);
    letter-spacing: var(--ls-wider);
  }

  .tile-type {
    color: var(--text-dim);
    font-size: var(--fs-base);
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

  /* Slot panels */
  .slots-section {
    border-bottom: 1px solid var(--border-subtle);
  }

  .slot-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.8rem;
    border-bottom: 1px solid #101820;
    min-height: 2.2rem;
  }
  .slot-row.slot-secondary {
    opacity: 0.6;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    min-height: 1.4rem;
  }

  .slot-label {
    color: #3a5878;
    font-size: var(--fs-sm);
    letter-spacing: var(--ls-wide);
    min-width: 3.2rem;
    flex-shrink: 0;
  }

  .slot-occupied {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .slot-fac-name {
    color: var(--text-primary);
    font-size: var(--fs-md);
    flex: 1;
  }

  .condition-badge {
    font-size: var(--fs-sm);
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .demolish-btn {
    font-family: inherit;
    font-size: var(--fs-sm);
    letter-spacing: 0.08em;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--danger-border);
    background: transparent;
    color: var(--danger);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .demolish-btn:hover { background: var(--danger-hover); }

  .no-demolish {
    font-size: var(--fs-sm);
    color: #3a4858;
    font-style: italic;
    flex-shrink: 0;
  }

  .slot-empty {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .empty-label {
    color: #2a3848;
    font-style: italic;
    font-size: var(--fs-base);
  }

  .slot-secondary-label {
    flex: 1;
    color: var(--text-muted);
    font-size: var(--fs-sm);
    font-style: italic;
  }

  /* Build section */
  .build-section {
    padding: 0;
  }

  .build-section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.8rem;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-subtle);
  }

  .build-section-title {
    color: var(--ok);
    font-size: var(--fs-base);
    letter-spacing: 0.12em;
    flex: 1;
  }

  .build-section-hint {
    color: var(--text-muted);
    font-size: var(--fs-sm);
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
    max-height: 20rem;
    overflow-y: auto;
  }

  .facility-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid #101820;
    align-items: flex-start;
  }
  .facility-row:hover { background: #101825; }
  .facility-row.unaffordable { opacity: 0.55; }

  .facility-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .facility-name { color: var(--text-primary); font-size: var(--fs-md); }
  .facility-desc { color: #5a6a7a; font-size: var(--fs-sm); line-height: 1.4; }

  .facility-outputs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .output-line {
    font-size: var(--fs-sm);
    color: var(--ok);
    border: 1px solid var(--ok-border);
    padding: 0 0.25rem;
  }
  .output-line.climate-line { color: var(--ok); border-color: var(--ok-border); }
  .output-line.climate-line.pollution-line { color: #9b6a4a; border-color: #4a2a10; }

  .upkeep { font-size: var(--fs-sm); color: #5a4a2a; }
  .build-time { font-size: var(--fs-sm); color: #4a5a6a; }

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
    letter-spacing: var(--ls-wide);
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

  .no-facilities { padding: 0.8rem; color: var(--text-muted); font-style: italic; }

  .tile-action-section {
    padding: 0;
    border-top: 1px solid var(--border-subtle);
  }

  .tile-action-title {
    color: #7a7acd;
    font-size: var(--fs-base);
    letter-spacing: 0.12em;
    flex: 1;
  }

  .destroyed-panel {
    padding: 0.9rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .destroyed-badge {
    font-size: var(--fs-md);
    letter-spacing: 0.14em;
    color: #9b4a4a;
    border: 1px solid #4a1a1a;
    padding: 0.15rem 0.5rem;
    align-self: flex-start;
  }
  .destroyed-desc { color: #5a4040; font-size: var(--fs-base); line-height: 1.5; font-style: italic; }

  .pending-panel {
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .pending-label { color: var(--warn); font-size: var(--fs-md); letter-spacing: 0.05em; }
  .pending-hint { color: #4a5868; font-size: var(--fs-sm); font-style: italic; }
</style>
