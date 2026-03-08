<script lang="ts">
  import type { Resources, FieldPoints, Era, TurnPhase } from '../../engine/types';
  import SaveControls from './SaveControls.svelte';

  let {
    resources,
    fields,
    turn,
    year,
    era,
    phase,
    climatePressure,
    will,
    seed,
    onExport,
    onImport,
  }: {
    resources: Resources;
    fields: FieldPoints;
    turn: number;
    year: number;
    era: Era;
    phase: TurnPhase;
    climatePressure: number;
    will: number;
    seed: string;
    onExport: () => void;
    onImport: (file: File) => Promise<void>;
  } = $props();

  const ERA_LABELS: Record<Era, string> = {
    earth: 'EARTH',
    nearSpace: 'NEAR SPACE',
    deepSpace: 'DEEP SPACE',
  };

  const PHASE_LABELS: Record<TurnPhase, string> = {
    event:  'EVENT',
    draw:   'DRAW',
    action: 'ACTION',
    bank:   'BANK',
    world:  'WORLD',
  };

  const FIELD_LABELS: Record<keyof FieldPoints, string> = {
    physics:      'PHY',
    mathematics:  'MATH',
    engineering:  'ENG',
    biochemistry: 'BIO',
    computing:    'COMP',
    socialScience:'SOC',
  };

  const FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof FieldPoints)[];

  function climateColor(p: number): string {
    if (p < 30) return '#4a9b7a';
    if (p < 60) return '#c8a040';
    return '#9b4a4a';
  }

  function willColor(w: number): string {
    if (w >= 60) return '#4a9b7a';
    if (w >= 35) return '#c8a040';
    return '#9b4a4a';
  }
</script>

<header class="hud">
  <div class="hud-left">
    <span class="logo">SIGNAL</span>
    <span class="divider">│</span>
    <span class="label">TURN</span><span class="value">{turn}</span>
    <span class="label">YEAR</span><span class="value">{year}</span>
    <span class="era-badge">{ERA_LABELS[era]}</span>
    <span class="phase-badge">{PHASE_LABELS[phase]}</span>
    <span class="divider">│</span>
    <SaveControls {seed} {turn} {onExport} {onImport} />
  </div>

  <div class="hud-center">
    <span class="label">CLIMATE</span>
    <div class="bar-track climate-track">
      <div
        class="bar-fill"
        style="width: {climatePressure}%; background: {climateColor(climatePressure)}"
      ></div>
    </div>
    <span class="value" style="color: {climateColor(climatePressure)}">{climatePressure.toFixed(0)}%</span>

    <span class="label" style="margin-left: 1rem">WILL</span>
    <div class="bar-track will-track">
      <div
        class="bar-fill"
        style="width: {will}%; background: {willColor(will)}"
      ></div>
    </div>
    <span class="value" style="color: {willColor(will)}">{will}</span>
  </div>

  <div class="hud-right">
    <div class="resource">
      <span class="res-label">FUND</span>
      <span class="res-value fund">{resources.funding}</span>
    </div>
    <div class="resource">
      <span class="res-label">MAT</span>
      <span class="res-value mat">{resources.materials}</span>
    </div>
    <div class="resource">
      <span class="res-label">WILL</span>
      <span class="res-value will">{resources.politicalWill}</span>
    </div>
    <span class="divider">│</span>
    {#each FIELD_KEYS as key}
      <div class="field-mini" title={key}>
        <span class="field-label">{FIELD_LABELS[key]}</span>
        <span class="field-value">{fields[key]}</span>
      </div>
    {/each}
  </div>
</header>

<style>
  .hud {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 1rem;
    background: #0d1018;
    border-bottom: 1px solid #1e2530;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    white-space: nowrap;
    overflow: hidden;
    flex-shrink: 0;
  }

  .hud-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .hud-center {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
  }

  .hud-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .logo {
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.25em;
    color: #4a8ab4;
  }

  .divider {
    color: #2a3040;
  }

  .label {
    color: #5a6878;
    font-size: 0.7rem;
  }

  .value {
    color: #c8d0d8;
    font-variant-numeric: tabular-nums;
  }

  .era-badge {
    padding: 0.1rem 0.4rem;
    border: 1px solid #2a4a6a;
    color: #4a8ab4;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
  }

  .phase-badge {
    padding: 0.1rem 0.4rem;
    background: #1a2535;
    color: #c8a040;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
  }

  .bar-track {
    height: 6px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
  }

  .climate-track { width: 80px; }
  .will-track    { width: 60px; }

  .bar-fill {
    height: 100%;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .resource {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .res-label {
    color: #6a7888;
    font-size: 0.68rem;
  }

  .res-value {
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
  }

  .fund { color: #c8d050; }
  .mat  { color: #6ab0d8; }
  .will { color: #b07ad0; }

  .field-mini {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .field-label {
    color: #6a7888;
    font-size: 0.65rem;
  }

  .field-value {
    color: #4a9b7a;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
</style>
