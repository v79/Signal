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
  <button
    class="advance-btn end-turn"
    disabled={!canAdvance}
    onclick={onAdvance}
  >
    {label}
  </button>
  <div class="phase-desc">{phaseDesc}</div>
  {#if phase === 'action'}
    <div class="action-counter" class:at-zero={actionsRemaining <= 0} class:at-one={actionsRemaining === 1}>
      {actionsRemaining} ACTION{actionsRemaining !== 1 ? 'S' : ''} LEFT
    </div>
  {/if}
  <button class="help-btn" onclick={() => (showHelp = true)} title="Help">?</button>
</div>

<style>
  .phase-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    background: #070b12;
    border-left: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .advance-btn {
    padding: 0.4rem 1rem;
    font-size: 0.7rem;
    font-family: inherit;
    letter-spacing: 0.1em;
    font-weight: 600;
    background: #0d2a40;
    color: #5ab4e0;
    border: 1px solid #1e4060;
    border-radius: 2px;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s;
  }

  .advance-btn:hover:not(:disabled) {
    background: #143550;
    color: #8ed4f8;
    border-color: #2a6090;
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
  }

  .advance-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .phase-desc {
    font-size: 0.6rem;
    color: #3a4858;
    letter-spacing: 0.05em;
    font-style: italic;
  }

  .action-counter {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: #4a8ab4;
  }

  .action-counter.at-one {
    color: #c8a040;
  }

  .action-counter.at-zero {
    color: #c84a4a;
  }

  .help-btn {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: #6a1a1a;
    border: 1px solid #a03030;
    color: #f0a0a0;
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: bold;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    margin-top: 0.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }

  .help-btn:hover {
    background: #8a2020;
    border-color: #c04040;
  }
</style>
