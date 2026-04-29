<script lang="ts">
  import type { TurnPhase } from '../../engine/types';
  import NarrativeModal from './NarrativeModal.svelte';
  import { NARRATIVE_GAME_HELP } from '../../data/loader';

  let showHelp = $state(false);

  let {
    phase,
    actionsThisTurn,
    maxActionsPerTurn,
    onAdvance,
  }: {
    phase: TurnPhase;
    actionsThisTurn: number;
    maxActionsPerTurn: number;
    onAdvance: () => void;
  } = $props();

  const actionsRemaining = $derived(maxActionsPerTurn - actionsThisTurn);

  const label = $derived(phase === 'action' ? 'END TURN ⟳' : phase.toUpperCase());

  const canAdvance = $derived(phase === 'action');

  const phaseDesc = $derived(
    phase === 'event'
      ? 'New events arriving.'
      : phase === 'draw'
        ? 'Drawing cards…'
        : phase === 'action'
          ? 'Play or bank cards, then end your turn.'
          : 'Processing…',
  );
</script>

{#if showHelp}
  <NarrativeModal narrative={NARRATIVE_GAME_HELP} onDismiss={() => (showHelp = false)} />
{/if}

<div class="phase-controls">
  <div class="top-row">
    <span class="phase-desc">{phaseDesc}</span>
    <button class="help-btn" onclick={() => (showHelp = true)} title="Help">?</button>
  </div>

  <div class="bottom-row">
    {#if phase === 'action'}
      <div class="action-counter" class:at-zero={actionsRemaining <= 0} class:at-one={actionsRemaining === 1}>
        <span class="count">{actionsRemaining}</span>
        <span class="label">ACTION{actionsRemaining !== 1 ? 'S' : ''} LEFT</span>
      </div>
    {:else}
      <div></div>
    {/if}

    <button
      class="advance-btn"
      class:end-turn={canAdvance}
      disabled={!canAdvance}
      onclick={onAdvance}
    >
      {label}
    </button>
  </div>
</div>

<style>
  .phase-controls {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
    background: var(--surface-0);
    border-top: 1px solid var(--border-panel);
    flex-shrink: 0;
    margin-top: auto;
    gap: 0.5rem;
  }

  .top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .phase-desc {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    letter-spacing: 0.04em;
    font-style: italic;
    line-height: 1.4;
    flex: 1;
  }

  .help-btn {
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: transparent;
    border: 1px solid #3a2020;
    color: #6a4040;
    font-family: var(--ff-mono);
    font-size: var(--fs-md);
    font-weight: bold;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .help-btn:hover {
    background: #1a0a0a;
    border-color: #804040;
    color: #c07070;
  }

  .bottom-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .action-counter {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .action-counter .count {
    font-size: 1.4rem;
    font-weight: 700;
    font-family: var(--ff-mono);
    color: #4a8ab4;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .action-counter .label {
    font-size: var(--fs-xxs);
    letter-spacing: 0.14em;
    color: #2a5070;
    text-transform: uppercase;
  }

  .action-counter.at-one .count { color: var(--warn); }
  .action-counter.at-one .label { color: #7a6020; }

  .action-counter.at-zero .count { color: #c84a4a; }
  .action-counter.at-zero .label { color: #702828; }

  .advance-btn {
    padding: 0.45rem 1.1rem;
    font-size: var(--fs-base);
    font-family: inherit;
    letter-spacing: 0.14em;
    font-weight: 700;
    background: #0d1e30;
    color: #2a5070;
    border: 1px solid #1a3050;
    border-radius: var(--radius-sm);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
  }

  .advance-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .advance-btn.end-turn {
    background: #0a2e1a;
    color: #5ad486;
    border-color: #1a5030;
  }

  .advance-btn.end-turn:hover:not(:disabled) {
    background: #0f4024;
    color: #90f0aa;
    border-color: #2a7040;
    box-shadow: 0 0 8px #1a5030;
  }
</style>
