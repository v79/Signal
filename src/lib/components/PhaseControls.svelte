<script lang="ts">
  import type { TurnPhase } from '../../engine/types';

  let {
    phase,
    onAdvance,
  }: {
    phase: TurnPhase;
    onAdvance: () => void;
  } = $props();

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

<div class="phase-controls">
  <button
    class="advance-btn end-turn"
    disabled={!canAdvance}
    onclick={onAdvance}
  >
    {label}
  </button>
  <div class="phase-desc">{phaseDesc}</div>
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
</style>
