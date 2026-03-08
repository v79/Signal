<script lang="ts">
  import type { TurnPhase } from '../../engine/types';

  let {
    phase,
    onAdvance,
  }: {
    phase: TurnPhase;
    onAdvance: () => void;
  } = $props();

  const label = $derived(
    phase === 'action' ? 'END ACTION →' :
    phase === 'bank'   ? 'END TURN ⟳'  :
                         phase.toUpperCase(),
  );

  const canAdvance = $derived(phase === 'action' || phase === 'bank');
</script>

<div class="phase-controls">
  <button
    class="advance-btn"
    class:end-turn={phase === 'bank'}
    disabled={!canAdvance}
    onclick={onAdvance}
  >
    {label}
  </button>
</div>

<style>
  .phase-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    transition: background 0.15s, color 0.15s, border-color 0.15s;
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
</style>
