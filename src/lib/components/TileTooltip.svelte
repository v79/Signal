<script lang="ts">
  import type {
    MapTile,
    FacilityInstance,
    FacilityDef,
    FieldPoints,
    Resources,
  } from '../../engine/types';
  import { FIELD_ABBR } from '../fieldColours';
  import { getFacilitiesOnTile, type HqBonus } from '../../engine/facilities';

  let {
    tile,
    facilities,
    facilityDefs,
    hqBonus,
    x,
    y,
    containerWidth,
    containerHeight,
  }: {
    tile: MapTile | null;
    facilities: FacilityInstance[];
    facilityDefs: Map<string, FacilityDef>;
    hqBonus: HqBonus;
    x: number;
    y: number;
    containerWidth: number;
    containerHeight: number;
  } = $props();

  const TOOLTIP_W = 200;
  const TOOLTIP_H = 320; // safe maximum for a fully-occupied 3-slot tile
  const OFFSET_X = 16;
  const OFFSET_Y = 8;

  const left = $derived(Math.min(x + OFFSET_X, containerWidth - TOOLTIP_W - 4));
  const top = $derived(Math.max(0, Math.min(y + OFFSET_Y, containerHeight - TOOLTIP_H - 4)));

  /** Unique facility instances on this tile (deduplicates multi-slot entries). */
  const tileInstances = $derived(
    tile ? getFacilitiesOnTile(tile, facilities) : [],
  );

  const freeSlotCount = $derived(
    tile ? tile.facilitySlots.filter((s) => s === null).length : 3,
  );

  /** True when the HQ facility is on this tile. */
  const tileHasHq = $derived(tileInstances.some((inst) => inst.defId === 'hq'));

  /**
   * Aggregate field output across all facilities on the tile (base only, no adjacency here).
   * Scaled by condition × productivity per facility. HQ bonus added when tile has the HQ.
   */
  const aggFields = $derived.by<Partial<FieldPoints>>(() => {
    if (!tile) return {};
    const out: Partial<FieldPoints> = {};
    for (const inst of tileInstances) {
      const def = facilityDefs.get(inst.defId);
      if (!def) continue;
      const scale = inst.condition * tile.productivity;
      for (const [k, v] of Object.entries(def.fieldOutput) as [keyof FieldPoints, number][]) {
        if (v) out[k] = Math.round(((out[k] ?? 0) + v * scale) * 10) / 10;
      }
    }
    if (tileHasHq) {
      for (const [k, v] of Object.entries(hqBonus.fields) as [keyof FieldPoints, number][]) {
        if (v) out[k] = Math.round(((out[k] ?? 0) + v) * 10) / 10;
      }
    }
    return out;
  });

  /**
   * Aggregate net resource output (income - upkeep) across all facilities on the tile.
   * HQ bonus added when tile has the HQ.
   */
  const aggResources = $derived.by<Partial<Resources>>(() => {
    if (!tile) return {};
    const out: Partial<Resources> = {};
    for (const inst of tileInstances) {
      const def = facilityDefs.get(inst.defId);
      if (!def) continue;
      const scale = inst.condition * tile.productivity;
      for (const [k, v] of Object.entries(def.resourceOutput) as [keyof Resources, number][]) {
        if (v) out[k] = Math.round(((out[k] ?? 0) + v * scale) * 10) / 10;
      }
      for (const [k, v] of Object.entries(def.upkeepCost) as [keyof Resources, number][]) {
        if (v) out[k] = (out[k] ?? 0) - v;
      }
    }
    if (tileHasHq) {
      for (const [k, v] of Object.entries(hqBonus.resources) as [keyof Resources, number][]) {
        if (v) out[k] = Math.round(((out[k] ?? 0) + v) * 10) / 10;
      }
    }
    return out;
  });

  const tileLabel: Record<string, string> = {
    urban: 'Urban',
    industrial: 'Industrial',
    coastal: 'Coastal',
    highland: 'Highland',
    forested: 'Forested',
    arid: 'Arid',
    agricultural: 'Agricultural',
  };

  function formatFields(f: Partial<FieldPoints>): string[] {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(f)) {
      if (v && v !== 0) lines.push(`${v > 0 ? '+' : ''}${v} ${FIELD_ABBR[k] ?? k}`);
    }
    return lines;
  }

  function formatResources(r: Partial<Resources>): string[] {
    const lines: string[] = [];
    const labels: Record<string, string> = {
      funding: 'Fund',
      materials: 'Mat',
      politicalWill: 'Will',
    };
    for (const [k, v] of Object.entries(r)) {
      if (v && v !== 0) lines.push(`${v > 0 ? '+' : ''}${v} ${labels[k] ?? k}`);
    }
    return lines;
  }

  function conditionLabel(c: number): string {
    if (c >= 0.9) return 'Good';
    if (c >= 0.6) return 'Fair';
    if (c >= 0.3) return 'Poor';
    return 'Critical';
  }
</script>

{#if tile}
  <div class="tooltip" style="left: {left}px; top: {top}px;">
    <div class="tile-type">{tileLabel[tile.type] ?? tile.type} tile · ({tile.coord.q},{tile.coord.r})</div>
    {#if tileInstances.length > 0}
      {#each tileInstances as inst}
        {@const def = facilityDefs.get(inst.defId)}
        {#if def}
          <div class="facility-name">{def.name}</div>
          {#if def.climateImpact}
            <div class="stat-line climate" class:climate-positive={def.climateImpact > 0}>
              {def.climateImpact > 0 ? '+' : ''}{def.climateImpact} climate/turn
            </div>
          {/if}
          {#if inst.condition < 1}
            <div class="stat-line warn">Condition: {conditionLabel(inst.condition)} ({Math.round(inst.condition * 100)}%)</div>
          {/if}
        {/if}
      {/each}
      <div class="divider"></div>
      {#each formatFields(aggFields) as line}
        <div class="stat-line field">{line}/turn</div>
      {/each}
      {#each formatResources(aggResources) as line}
        <div class="stat-line resource" class:negative={line.startsWith('-')}>{line}/turn</div>
      {/each}
      {#if tile.productivity < 1}
        <div class="stat-line warn">Productivity: {Math.round(tile.productivity * 100)}%</div>
      {/if}
    {:else if freeSlotCount > 0}
      <div class="empty-hint">Empty — click to build</div>
    {/if}
    {#if tile.destroyedStatus}
      <div class="stat-line warn">{{ flooded: 'Submerged', dustbowl: 'Dust bowl', irradiated: 'Irradiated' }[tile.destroyedStatus] ?? tile.destroyedStatus}</div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: absolute;
    pointer-events: none;
    background: #0a1018;
    border: 1px solid #1e3050;
    padding: 0.45rem 0.6rem;
    min-width: 10rem;
    max-width: 14rem;
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    line-height: 1.55;
    z-index: 20;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .tile-type {
    color: #4a6880;
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.15rem;
  }

  .facility-name {
    color: #a8c8e8;
    font-size: 0.7rem;
    margin-bottom: 0.1rem;
  }

  .divider {
    border-top: 1px solid #1a2a3a;
    margin: 0.25rem 0;
  }

  .stat-line {
    color: #6a8898;
  }

  .stat-line.field {
    color: #5a9878;
  }

  .stat-line.resource {
    color: #98a850;
  }

  .stat-line.resource.negative {
    color: #986050;
  }

  .stat-line.warn {
    color: #987840;
  }

  .stat-line.climate {
    color: #4a9b7a; /* green = mitigation */
  }

  .stat-line.climate.climate-positive {
    color: #9b6a4a; /* amber = pollution */
  }

  .empty-hint {
    color: #3a5060;
    font-style: italic;
  }
</style>
