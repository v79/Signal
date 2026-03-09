<script lang="ts">
  import type {
    MapTile,
    FacilityInstance,
    FacilityDef,
    FieldPoints,
    Resources,
  } from '../../engine/types';

  let {
    tile,
    facilities,
    facilityDefs,
    x,
    y,
    containerWidth,
    containerHeight,
  }: {
    tile: MapTile | null;
    facilities: FacilityInstance[];
    facilityDefs: Map<string, FacilityDef>;
    x: number;
    y: number;
    containerWidth: number;
    containerHeight: number;
  } = $props();

  const TOOLTIP_W = 200;
  const TOOLTIP_H = 130; // approximate, used for clamping
  const OFFSET_X = 16;
  const OFFSET_Y = 8;

  const left = $derived(Math.min(x + OFFSET_X, containerWidth - TOOLTIP_W - 4));
  const top = $derived(Math.min(y + OFFSET_Y, containerHeight - TOOLTIP_H - 4));

  const facility = $derived(
    tile?.facilityId != null ? (facilities.find((f) => f.id === tile.facilityId) ?? null) : null,
  );

  const def = $derived(facility ? (facilityDefs.get(facility.defId) ?? null) : null);

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
    const labels: Record<string, string> = {
      physics: 'PHY',
      mathematics: 'MATH',
      engineering: 'ENG',
      biochemistry: 'BIO',
      computing: 'COMP',
      socialScience: 'SOC',
    };
    for (const [k, v] of Object.entries(f)) {
      if (v && v !== 0) lines.push(`${v > 0 ? '+' : ''}${v} ${labels[k] ?? k}`);
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

  // Net resource output = resourceOutput - upkeep
  const netResources = $derived<Partial<Resources>>(() => {
    if (!def) return {};
    const out: Partial<Resources> = { ...def.resourceOutput };
    for (const [k, v] of Object.entries(def.upkeepCost) as [keyof Resources, number][]) {
      out[k] = (out[k] ?? 0) - v;
    }
    return out;
  });
</script>

{#if tile}
  <div class="tooltip" style="left: {left}px; top: {top}px;">
    <div class="tile-type">{tileLabel[tile.type] ?? tile.type} tile</div>
    {#if def}
      <div class="facility-name">{def.name}</div>
      <div class="divider"></div>
      {#each formatFields(def.fieldOutput) as line}
        <div class="stat-line field">{line}/turn</div>
      {/each}
      {#each formatResources(netResources) as line}
        <div class="stat-line resource" class:negative={line.startsWith('-')}>{line}/turn</div>
      {/each}
      {#if tile.productivity < 1}
        <div class="stat-line warn">Productivity: {Math.round(tile.productivity * 100)}%</div>
      {/if}
    {:else}
      <div class="empty-hint">Empty — click to build</div>
    {/if}
    {#if tile.destroyedStatus}
      <div class="stat-line warn">{tile.destroyedStatus}</div>
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

  .empty-hint {
    color: #3a5060;
    font-style: italic;
  }
</style>
