<script lang="ts">
  import { gameStore } from '$lib/stores/game.svelte';
  import type { VictoryCondition, LossCondition } from '../../engine/types';

  // Summary is only reachable after a game ends, so state is always non-null here.
  const outcome = $derived(gameStore.state!.outcome);
  const state   = $derived(gameStore.state!);

  // ---------------------------------------------------------------------------
  // Condition copy
  // ---------------------------------------------------------------------------

  const VICTORY_TITLES: Record<VictoryCondition, string> = {
    wormhole:               'WORMHOLE CONTACT',
    ecologicalRestoration:  'ECOLOGICAL RESTORATION',
    economicHegemony:       'ECONOMIC HEGEMONY',
    terraforming:           'LUNAR PRESENCE',
  };

  const VICTORY_TEXT: Record<VictoryCondition, string> = {
    wormhole:
      'The resonance pathway opened. Humanity answered the signal correctly and stands at the threshold of first contact. A new era begins.',
    ecologicalRestoration:
      'Through careful stewardship and deliberate restraint, the Earth\'s ecosystems were brought back from the edge. Humanity found a way forward without sacrificing its home.',
    economicHegemony:
      'Through superior resource acquisition and strategic dominance, the programme secured control over the critical infrastructure of a transitioning world.',
    terraforming:
      'Permanent installations on the Lunar Surface mark the moment humanity became a multi-world species. The first step of an infinite journey.',
  };

  const LOSS_TITLES: Record<LossCondition, string> = {
    climateCollapse:          'CLIMATE COLLAPSE',
    signalMisinterpretation:  'SIGNAL MISINTERPRETATION',
    politicalCollapse:        'POLITICAL COLLAPSE',
    resourceExhaustion:       'RESOURCE EXHAUSTION',
  };

  const LOSS_TEXT: Record<LossCondition, string> = {
    climateCollapse:
      'Climate pressure exceeded critical thresholds. The cascading feedback loops overwhelmed the programme\'s ability to respond. Operations ceased.',
    signalMisinterpretation:
      'The wormhole response was incorrect. The signal locked closed. Whatever awaited on the other side, humanity will not reach it on this path.',
    politicalCollapse:
      'Political will collapsed entirely. Without public support and institutional backing, the programme lost all authority to act. It disbanded quietly.',
    resourceExhaustion:
      'All resource pools depleted simultaneously. The infrastructure of the programme could not sustain operations. It fell silent.',
  };

  const isVictory = $derived(outcome?.type === 'victory');
  const title = $derived(
    outcome
      ? isVictory
        ? VICTORY_TITLES[outcome.condition as VictoryCondition]
        : LOSS_TITLES[outcome.condition as LossCondition]
      : 'GAME OVER',
  );
  const body = $derived(
    outcome
      ? isVictory
        ? VICTORY_TEXT[outcome.condition as VictoryCondition]
        : LOSS_TEXT[outcome.condition as LossCondition]
      : '',
  );

  const FIELD_LABELS: Record<string, string> = {
    physics:      'Physics',
    mathematics:  'Mathematics',
    engineering:  'Engineering',
    biochemistry: 'Biochemistry',
    computing:    'Computing',
    socialScience:'Social Sci.',
  };
</script>

<div class="summary-layout">
  <div class="summary-card">
    <!-- Outcome banner -->
    <div class="banner" class:victory={isVictory} class:loss={!isVictory}>
      <span class="banner-glyph">{isVictory ? '⬡' : '✕'}</span>
      <span class="banner-label">{isVictory ? 'VICTORY' : 'MISSION FAILED'}</span>
    </div>

    <h1 class="condition-title">{title}</h1>
    <p class="condition-body">{body}</p>

    <!-- Abandoned Earth moral outcome -->
    {#if outcome?.moralOutcome === 'abandonedEarth'}
      <div class="moral-warning">
        <span class="moral-glyph">⚠</span>
        <div>
          <strong>ABANDONED EARTH</strong>
          <p>Victory was achieved, but the Earth was left behind. Earth welfare fell below critical levels as attention turned to the stars. History will weigh this cost.</p>
        </div>
      </div>
    {/if}

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-block">
        <div class="stat-section-label">MISSION RECORD</div>
        <div class="stat-row"><span>Turn</span><span>{outcome?.turn ?? state.turn}</span></div>
        <div class="stat-row"><span>Year</span><span>{state.year}</span></div>
        <div class="stat-row"><span>Era</span><span class="era-badge">{state.era.toUpperCase().replace('NEARSPACE', 'NEAR SPACE').replace('DEEPSPACE', 'DEEP SPACE')}</span></div>
        <div class="stat-row"><span>Climate Pressure</span><span class:danger={state.climatePressure >= 80}>{Math.round(state.climatePressure)}%</span></div>
        <div class="stat-row"><span>Earth Welfare</span><span class:danger={state.earthWelfareScore < 40}>{Math.round(state.earthWelfareScore)}%</span></div>
      </div>

      <div class="stat-block">
        <div class="stat-section-label">FINAL RESOURCES</div>
        <div class="stat-row"><span>Funding</span><span>{Math.round(state.player.resources.funding)}</span></div>
        <div class="stat-row"><span>Materials</span><span>{Math.round(state.player.resources.materials)}</span></div>
        <div class="stat-row"><span>Political Will</span><span>{Math.round(state.player.resources.politicalWill)}</span></div>
        <div class="stat-row"><span>Will</span><span>{Math.round(state.player.will)}</span></div>
      </div>

      <div class="stat-block">
        <div class="stat-section-label">RESEARCH FIELDS</div>
        {#each Object.entries(state.player.fields) as [field, pts]}
          <div class="stat-row">
            <span>{FIELD_LABELS[field] ?? field}</span>
            <span>{Math.round(pts)}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn-play-again" onclick={() => gameStore.resetGame()}>
        PLAY AGAIN
      </button>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #060a10;
    color: #8aacca;
    font-family: monospace;
  }

  .summary-layout {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(20, 40, 80, 0.3) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(10, 30, 60, 0.2) 0%, transparent 50%),
      #060a10;
  }

  .summary-card {
    width: 100%;
    max-width: 700px;
    background: #0a0f18;
    border: 1px solid #1e2a3a;
    border-radius: 4px;
    padding: 2rem;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    margin-bottom: 1.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    font-weight: bold;
  }
  .banner.victory {
    background: rgba(30, 80, 50, 0.5);
    border: 1px solid #2a6040;
    color: #50c880;
  }
  .banner.loss {
    background: rgba(80, 20, 20, 0.5);
    border: 1px solid #6a2020;
    color: #c85050;
  }
  .banner-glyph {
    font-size: 1.1rem;
  }

  .condition-title {
    margin: 0 0 0.75rem;
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    color: #c8ddf0;
    font-weight: normal;
  }

  .condition-body {
    margin: 0 0 1.5rem;
    color: #6a8aaa;
    font-size: 0.82rem;
    line-height: 1.65;
  }

  .moral-warning {
    display: flex;
    gap: 0.75rem;
    background: rgba(80, 50, 10, 0.4);
    border: 1px solid #5a3a10;
    border-radius: 3px;
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.78rem;
  }
  .moral-glyph {
    font-size: 1.2rem;
    color: #c89040;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }
  .moral-warning strong {
    display: block;
    color: #c89040;
    letter-spacing: 0.08em;
    margin-bottom: 0.3rem;
    font-size: 0.7rem;
  }
  .moral-warning p {
    margin: 0;
    color: #8a7050;
    line-height: 1.5;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-block {
    background: #0d1520;
    border: 1px solid #1a2535;
    border-radius: 3px;
    padding: 0.75rem;
  }

  .stat-section-label {
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: #3a5070;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #1a2535;
    padding-bottom: 0.4rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    padding: 0.2rem 0;
    color: #6a8aaa;
  }
  .stat-row span:last-child {
    color: #a0c0d8;
  }
  .stat-row span.danger {
    color: #c85050;
  }

  .era-badge {
    font-size: 0.6rem;
    letter-spacing: 0.05em;
    color: #6aacca !important;
  }

  .actions {
    display: flex;
    justify-content: center;
  }

  .btn-play-again {
    background: transparent;
    border: 1px solid #2a4a6a;
    color: #6aacca;
    cursor: pointer;
    font-family: monospace;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    padding: 0.6rem 2rem;
    border-radius: 3px;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn-play-again:hover {
    background: rgba(30, 70, 120, 0.3);
    border-color: #4a80b0;
    color: #a0c8e8;
  }
</style>
