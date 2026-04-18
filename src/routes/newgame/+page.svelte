<script lang="ts">
  import { gameStore } from '$lib/stores/game.svelte';
  import { BLOC_DEFS, NARRATIVE_OPENING } from '../../data/loader';
  import type { Era, PushFactor } from '../../engine/types';
  import NarrativeModal from '$lib/components/NarrativeModal.svelte';

  let showOpening = $state(true);

  // ---------------------------------------------------------------------------
  // Seed
  // ---------------------------------------------------------------------------

  function generateSeed(): string {
    const t = Date.now().toString(16);
    const r = Math.random().toString(16).slice(2, 10);
    return (t + r).slice(-8).toUpperCase();
  }

  let seed = $state(generateSeed());

  // ---------------------------------------------------------------------------
  // Bloc selection — use map key as selection id
  // ---------------------------------------------------------------------------

  const blocs = [...BLOC_DEFS.entries()].map(([key, def]) => ({ key, def }));
  let selectedBlocKey = $state(blocs[0].key);

  // ---------------------------------------------------------------------------
  // Push factor
  // ---------------------------------------------------------------------------

  let pushFactor = $state<PushFactor>('climateChange');
  const PUSH_FACTORS: PushFactor[] = ['climateChange', 'geopoliticalTension'];

  const PUSH_LABELS: Record<PushFactor, string> = {
    climateChange: 'CLIMATE CHANGE',
    geopoliticalTension: 'GEOPOLITICAL TENSION',
  };

  const PUSH_DESCRIPTIONS: Record<PushFactor, string> = {
    climateChange: 'Rising temperatures and ecological instability drive global urgency.',
    geopoliticalTension: 'Superpower rivalry and resource competition dominate world affairs.',
  };

  // ---------------------------------------------------------------------------
  // Resource bar helper
  // ---------------------------------------------------------------------------

  const RESOURCE_BAR_DEFS: Array<{
    label: string;
    key: 'funding' | 'materials' | 'politicalWill';
    cls: string;
  }> = [
    { label: 'FND', key: 'funding', cls: 'funding' },
    { label: 'MAT', key: 'materials', cls: 'materials' },
    { label: 'PWL', key: 'politicalWill', cls: 'will' },
  ];

  function barWidth(value: number, max = 100): string {
    return `${Math.min(100, (value / max) * 100)}%`;
  }

  // ---------------------------------------------------------------------------
  // Dev: starting era
  // ---------------------------------------------------------------------------

  let startEra = $state<Era>('earth');
  const ERAS: Era[] = ['earth', 'nearSpace', 'deepSpace'];

  const ERA_LABELS: Record<Era, string> = {
    earth: 'ERA 1 — EARTH (1970)',
    nearSpace: 'ERA 2 — NEAR SPACE (2030)',
    deepSpace: 'ERA 3 — DEEP SPACE (2060)',
  };

  // ---------------------------------------------------------------------------
  // Begin mission
  // ---------------------------------------------------------------------------

  function beginMission(): void {
    gameStore.startNewGame(seed.trim() || generateSeed(), selectedBlocKey, pushFactor, startEra);
  }
</script>

{#if showOpening}
  <NarrativeModal narrative={NARRATIVE_OPENING} onDismiss={() => (showOpening = false)} />
{/if}

<div class="newgame-layout">
  <div class="setup-card">
    <!-- Header -->
    <div class="header">
      <div class="signal-glyph">⬡</div>
      <div>
        <h1 class="title">SIGNAL</h1>
        <p class="subtitle">NEW MISSION CONFIGURATION</p>
      </div>
    </div>

    <!-- Seed -->
    <section class="section">
      <div class="section-label">SEED</div>
      <div class="seed-row">
        <input
          class="seed-input"
          type="text"
          bind:value={seed}
          maxlength="32"
          spellcheck="false"
          autocomplete="off"
          placeholder="8-char hex string"
        />
        <button
          class="btn-refresh"
          onclick={() => {
            seed = generateSeed();
          }}
          title="Generate new seed"
        >
          ↺
        </button>
      </div>
      <p class="seed-hint">Share this string to replay identical starting conditions.</p>
    </section>

    <!-- Bloc selection -->
    <section class="section">
      <div class="section-label">SELECT BLOC</div>
      <div class="bloc-grid">
        {#each blocs as { key, def }}
          <button
            class="bloc-card"
            class:selected={selectedBlocKey === key}
            onclick={() => {
              selectedBlocKey = key;
            }}
          >
            <div class="bloc-name">{def.name}</div>
            <div
              class="will-badge"
              class:democratic={def.willProfile === 'democratic'}
              class:authoritarian={def.willProfile === 'authoritarian'}
            >
              {def.willProfile.toUpperCase()}
            </div>
            <div class="victory-bias">
              → {def.victoryBias
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .toUpperCase()}
            </div>

            <div class="resource-bars">
              {#each RESOURCE_BAR_DEFS as bar}
                <div class="bar-row">
                  <span class="bar-label">{bar.label}</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill {bar.cls}"
                      style="width: {barWidth(def.startingResources[bar.key])}"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </button>
        {/each}
      </div>
    </section>

    <!-- Push factor -->
    <section class="section">
      <div class="section-label">PUSH FACTOR</div>
      <div class="push-row">
        {#each PUSH_FACTORS as pf}
          <button
            class="push-btn"
            class:active={pushFactor === pf}
            onclick={() => {
              pushFactor = pf;
            }}
          >
            <div class="push-label">{PUSH_LABELS[pf]}</div>
            <div class="push-desc">{PUSH_DESCRIPTIONS[pf]}</div>
          </button>
        {/each}
      </div>
    </section>

    <!-- Dev: era selector -->
    <section class="section dev-section">
      <div class="section-label dev-label">ERA (DEV)</div>
      <div class="era-row">
        {#each ERAS as era}
          <button
            class="era-btn"
            class:active={startEra === era}
            onclick={() => { startEra = era; }}
          >
            {ERA_LABELS[era]}
          </button>
        {/each}
      </div>
      <p class="dev-hint">Dev only — skips to the selected era with prior techs pre-discovered.</p>
    </section>

    <!-- Begin -->
    <p class="dev-hint">
      <em>Signal</em> has been built primarily with an AI agent, Claude Code.
    </p>
    <div class="begin-row">
      <button class="btn-begin" onclick={beginMission}> BEGIN MISSION &rsaquo;</button>
    </div>
  </div>
</div>

<style>
    :global(body) {
        margin: 0;
        background: #060a10;
        color: #8aacca;
        font-family: var(--ff-mono);
    }

    .newgame-layout {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2rem;
        box-sizing: border-box;
        overflow-y: auto;
        background: radial-gradient(ellipse at 15% 60%, rgba(20, 40, 80, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 20%, rgba(10, 30, 60, 0.2) 0%, transparent 50%), #060a10;
    }

    .setup-card {
        width: 100%;
        max-width: 860px;
        background: #0a0f18;
        border: 1px solid #1e2a3a;
        border-radius: 4px;
        padding: 2rem;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 1.2rem;
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #1a2535;
    }

    .signal-glyph {
        font-size: 2.5rem;
        color: #4a90c0;
        line-height: 1;
    }

    .title {
        margin: 0 0 0.2rem;
        font-size: 1.6rem;
        letter-spacing: 0.25em;
        color: #c8ddf0;
        font-weight: normal;
    }

    .subtitle {
        margin: 0;
        font-size: 0.65rem;
        letter-spacing: 0.15em;
        color: #3a5070;
    }

    .section {
        margin-bottom: 1.8rem;
    }

    .section-label {
        font-size: 0.6rem;
        letter-spacing: 0.12em;
        color: #3a5070;
        margin-bottom: 0.6rem;
        border-bottom: 1px solid #1a2535;
        padding-bottom: 0.3rem;
    }

    /* Seed */
    .seed-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .seed-input {
        flex: 1;
        background: #0d1520;
        border: 1px solid #2a3a50;
        color: #a0c8e8;
        font-family: var(--ff-mono);
        font-size: 0.9rem;
        letter-spacing: 0.1em;
        padding: 0.5rem 0.75rem;
        border-radius: 3px;
        outline: none;
        transition: border-color 0.15s;
    }

    .seed-input:focus {
        border-color: #4a80b0;
    }

    .btn-refresh {
        background: transparent;
        border: 1px solid #2a3a50;
        color: #4a7090;
        cursor: pointer;
        font-size: 1.1rem;
        padding: 0.35rem 0.6rem;
        border-radius: 3px;
        line-height: 1;
        transition: color 0.15s,
        border-color 0.15s;
    }

    .btn-refresh:hover {
        color: #8aacca;
        border-color: #4a6080;
    }

    .seed-hint {
        margin: 0.4rem 0 0;
        font-size: 0.68rem;
        color: #3a5070;
    }

    /* Bloc grid */
    .bloc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.6rem;
    }

    .bloc-card {
        background: #0d1520;
        border: 1px solid #1a2535;
        border-radius: 3px;
        padding: 0.75rem;
        cursor: pointer;
        text-align: left;
        font-family: var(--ff-mono);
        transition: border-color 0.15s,
        background 0.15s;
    }

    .bloc-card:hover {
        border-color: #3a6080;
        background: #0f1a28;
    }

    .bloc-card.selected {
        border-color: #4a90c0;
        background: #0d1a2e;
    }

    .bloc-name {
        font-size: 0.72rem;
        color: #a0c8e8;
        margin-bottom: 0.4rem;
        line-height: 1.3;
    }

    .will-badge {
        display: inline-block;
        font-size: 0.55rem;
        letter-spacing: 0.08em;
        padding: 1px 5px;
        border-radius: 2px;
        margin-bottom: 0.35rem;
    }

    .will-badge.democratic {
        background: rgba(30, 80, 50, 0.4);
        color: #50a870;
        border: 1px solid #2a6040;
    }

    .will-badge.authoritarian {
        background: rgba(80, 30, 20, 0.4);
        color: #c07050;
        border: 1px solid #6a2a1a;
    }

    .victory-bias {
        font-size: 0.58rem;
        color: #3a5a7a;
        margin-bottom: 0.6rem;
        letter-spacing: 0.04em;
    }

    .resource-bars {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .bar-row {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .bar-label {
        font-size: 0.5rem;
        color: #3a5070;
        width: 22px;
        flex-shrink: 0;
        letter-spacing: 0.04em;
    }

    .bar-track {
        flex: 1;
        height: 3px;
        background: #1a2535;
        border-radius: 2px;
        overflow: hidden;
    }

    .bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.2s;
    }

    .bar-fill.funding {
        background: #4a90c0;
    }

    .bar-fill.materials {
        background: #60a860;
    }

    .bar-fill.will {
        background: #9060c0;
    }

    /* Push factor */
    .push-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem;
    }

    .push-btn {
        background: #0d1520;
        border: 1px solid #1a2535;
        border-radius: 3px;
        padding: 0.75rem 1rem;
        cursor: pointer;
        font-family: var(--ff-mono);
        text-align: left;
        transition: border-color 0.15s,
        background 0.15s;
    }

    .push-btn:hover {
        border-color: #3a6080;
        background: #0f1a28;
    }

    .push-btn.active {
        border-color: #4a90c0;
        background: #0d1a2e;
    }

    .push-label {
        font-size: 0.72rem;
        color: #a0c8e8;
        letter-spacing: 0.06em;
        margin-bottom: 0.4rem;
    }

    .push-desc {
        font-size: 0.65rem;
        color: #4a6a8a;
        line-height: 1.5;
    }

    /* Dev era selector */
    .dev-section {
        border: 1px dashed #2a3a20;
        border-radius: 3px;
        padding: 0.75rem;
        background: rgba(20, 30, 10, 0.3);
    }

    .dev-label {
        color: #4a6a30 !important;
        border-bottom-color: #2a3a20 !important;
    }

    .era-row {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .era-btn {
        background: #0d1520;
        border: 1px solid #1a2535;
        border-radius: 3px;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        font-family: var(--ff-mono);
        font-size: 0.7rem;
        color: #4a6a4a;
        text-align: left;
        letter-spacing: 0.06em;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
    }

    .era-btn:hover {
        border-color: #3a5a30;
        color: #6a9a60;
        background: #0d1510;
    }

    .era-btn.active {
        border-color: #5a8a40;
        color: #8ab870;
        background: #0d1a0d;
    }

    .dev-hint {
        margin: 0.4rem 0 0;
        font-size: 0.62rem;
        color: #3a5030;
        font-style: italic;
    }

    /* Begin */
    .begin-row {
        display: flex;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid #1a2535;
    }

    .btn-begin {
        background: rgba(30, 70, 120, 0.2);
        border: 1px solid #2a4a6a;
        color: #6aacca;
        cursor: pointer;
        font-family: var(--ff-mono);
        font-size: 0.8rem;
        letter-spacing: 0.1em;
        padding: 0.7rem 2.5rem;
        border-radius: 3px;
        transition: background 0.15s,
        color 0.15s,
        border-color 0.15s;
    }

    .btn-begin:hover {
        background: rgba(30, 90, 150, 0.35);
        border-color: #4a80b0;
        color: #a0c8e8;
    }
</style>
