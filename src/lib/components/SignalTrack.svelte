<script lang="ts">
  import type { SignalState } from '../../engine/types';
  import Tooltip from './Tooltip.svelte';

  let { signal }: { signal: SignalState } = $props();

  function signalLabel(s: SignalState): string {
    if (s.decodeProgress >= 100) return 'DECODED';
    if (s.eraStrength === 'urgent') return 'URGENT';
    if (s.eraStrength === 'structured') return 'STRUCTURED';
    return 'FAINT';
  }

  function signalColor(s: SignalState): string {
    if (s.decodeProgress >= 100) return '#4a9b7a';
    if (s.eraStrength === 'urgent') return '#c84a4a';
    if (s.eraStrength === 'structured') return '#c8a040';
    return '#4a6878';
  }
</script>

<div class="signal-track-panel">
  <span class="panel-title">SIGNAL</span>
  <div class="signal-row">
    <Tooltip
      text="Progress decoding the alien signal. Unlocks new techs and events as it advances."
      direction="below"
    >
      <span class="signal-label" style="color: {signalColor(signal)}">{signalLabel(signal)}</span>
    </Tooltip>
    <div class="signal-track">
      <div
        class="signal-fill"
        style="width: {signal.decodeProgress}%; background: {signalColor(signal)}"
      ></div>
    </div>
    <span class="signal-pct" style="color: {signalColor(signal)}"
      >{signal.decodeProgress.toFixed(0)}%</span
    >
  </div>
  <div class="divider"></div>
</div>

<style>
  .signal-track-panel {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.6rem 0.6rem 0;
    background: #0c1018;
    border-left: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: #5a6878;
  }

  .signal-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
  }

  .signal-label {
    width: 5.5rem;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    flex-shrink: 0;
  }

  .signal-track {
    flex: 1;
    height: 6px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
  }

  .signal-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  .signal-pct {
    width: 2.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    flex-shrink: 0;
  }

  .divider {
    height: 1px;
    background: #1a2030;
    margin-top: 0.2rem;
  }
</style>
