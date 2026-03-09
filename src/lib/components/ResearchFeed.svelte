<script lang="ts">
  import type {
    FieldPoints,
    SignalState,
    SignalResponseOption,
    TechState,
    TechDef,
    CardDef,
    FacilityDef,
  } from '../../engine/types';
  import TechTreeModal from './TechTreeModal.svelte';

  let {
    fields,
    signal,
    techs = [],
    techDefs = new Map(),
    cardDefs = new Map(),
    facilityDefs = new Map(),
    wormholeOptions = [],
    onCommitWormholeResponse,
  }: {
    fields: FieldPoints;
    signal: SignalState;
    techs?: TechState[];
    techDefs?: Map<string, TechDef>;
    cardDefs?: Map<string, CardDef>;
    facilityDefs?: Map<string, FacilityDef>;
    wormholeOptions?: SignalResponseOption[];
    onCommitWormholeResponse?: (optionId: string) => void;
  } = $props();

  let showTechTree = $state(false);

  const isClimax = $derived(signal.decodeProgress >= 100 && !signal.responseCommitted);

  interface FieldMeta {
    key: keyof FieldPoints;
    label: string;
    color: string;
  }

  const FIELD_META: FieldMeta[] = [
    { key: 'physics', label: 'Physics', color: '#6ab0d8' },
    { key: 'mathematics', label: 'Mathematics', color: '#a07ad8' },
    { key: 'engineering', label: 'Engineering', color: '#c8a040' },
    { key: 'biochemistry', label: 'Biochemistry', color: '#4ab88a' },
    { key: 'computing', label: 'Computing', color: '#d86a6a' },
    { key: 'socialScience', label: 'Social Sci.', color: '#d8a86a' },
  ];

  // Scale field bars: 200 pts = full bar for visual purposes
  const FIELD_SCALE = 200;

  function fieldPct(val: number): number {
    return Math.min(100, (val / FIELD_SCALE) * 100);
  }

</script>

{#if showTechTree}
  <TechTreeModal
    {techs}
    {techDefs}
    {fields}
    {signal}
    {cardDefs}
    {facilityDefs}
    onClose={() => {
      showTechTree = false;
    }}
  />
{/if}

<aside class="research-feed">
  <div class="panel-title-row">
    <span class="panel-title">RESEARCH FIELDS</span>
    <button
      class="tree-btn"
      onclick={() => {
        showTechTree = true;
      }}>TECH TREE</button
    >
  </div>

  <div class="fields-list">
    {#each FIELD_META as meta}
      {@const val = fields[meta.key]}
      <div class="field-row">
        <span class="field-name">{meta.label}</span>
        <div class="field-bar-track">
          <div
            class="field-bar-fill"
            style="width: {fieldPct(val)}%; background: {meta.color}"
          ></div>
        </div>
        <span class="field-num" style="color: {meta.color}">{val}</span>
      </div>
    {/each}
  </div>

  {#if isClimax && wormholeOptions.length > 0}
    <div class="section-divider"></div>
    <div class="climax-section">
      <div class="climax-title">⬡ WORMHOLE RESPONSE REQUIRED</div>
      <p class="climax-intro">
        The signal is fully decoded. Select a response. This decision cannot be undone.
      </p>
      {#each wormholeOptions as opt}
        <button
          class="response-option"
          class:hint-high={opt.confidenceHint === 'high'}
          class:hint-medium={opt.confidenceHint === 'medium'}
          class:hint-low={opt.confidenceHint === 'low'}
          onclick={() => onCommitWormholeResponse?.(opt.id)}
        >
          <span class="opt-label">{opt.label}</span>
          {#if opt.confidenceHint}
            <span class="opt-hint hint-{opt.confidenceHint}"
              >{opt.confidenceHint.toUpperCase()}</span
            >
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if signal.responseCommitted}
    <div class="section-divider"></div>
    <div
      class="response-result"
      class:success={signal.wormholeActivated}
      class:failure={!signal.wormholeActivated}
    >
      {signal.wormholeActivated ? '⬡ WORMHOLE ACTIVATED' : '⬡ RESPONSE INCORRECT'}
    </div>
  {/if}

</aside>

<style>
  .research-feed {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    background: #0c1018;
    border-left: 1px solid #1e2530;
    overflow-y: auto;
    min-width: 0;
  }

  .panel-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #1e2530;
    padding-bottom: 0.3rem;
    margin-bottom: 0.2rem;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: #5a6878;
  }

  .tree-btn {
    font-family: monospace;
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    color: #3a6070;
    background: none;
    border: 1px solid #1a3040;
    border-radius: 2px;
    padding: 0.1rem 0.4rem;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
    flex-shrink: 0;
  }

  .tree-btn:hover {
    color: #6aaabb;
    border-color: #2a5060;
  }

  .section-divider {
    height: 1px;
    background: #1a2030;
    margin: 0.3rem 0;
    flex-shrink: 0;
  }

  .fields-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.68rem;
  }

  .field-name {
    color: #8a9aaa;
    width: 6rem;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .field-bar-track {
    flex: 1;
    height: 5px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
    min-width: 0;
  }

  .field-bar-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  .field-num {
    width: 2.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    flex-shrink: 0;
  }

  .climax-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid #2a4a6a;
    border-radius: 3px;
    background: #060c18;
  }

  .climax-title {
    font-size: 0.62rem;
    letter-spacing: 0.15em;
    color: #6ab0d8;
    font-weight: 600;
  }

  .climax-intro {
    font-size: 0.6rem;
    color: #5a7080;
    margin: 0;
    line-height: 1.4;
  }

  .response-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0.5rem;
    background: #0a1828;
    border: 1px solid #1a3050;
    border-radius: 2px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition:
      background 0.15s,
      border-color 0.15s;
    gap: 0.5rem;
  }

  .response-option:hover {
    background: #0f2038;
    border-color: #2a5080;
  }

  .opt-label {
    font-size: 0.62rem;
    color: #8ab8d8;
    flex: 1;
    line-height: 1.3;
  }

  .opt-hint {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .hint-high {
    color: #4ad480;
    background: #0a2818;
  }
  .hint-medium {
    color: #d4a840;
    background: #1e1408;
  }
  .hint-low {
    color: #d46a4a;
    background: #1e0e08;
  }

  .response-result {
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    padding: 0.4rem 0.5rem;
    border-radius: 2px;
    text-align: center;
    font-weight: 600;
  }

  .response-result.success {
    color: #4ad480;
    background: #0a2818;
    border: 1px solid #1a5030;
  }

  .response-result.failure {
    color: #d46a4a;
    background: #1e0e08;
    border: 1px solid #501808;
  }
</style>
