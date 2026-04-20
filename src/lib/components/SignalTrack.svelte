<script lang="ts">
  import type { Era, SignalState, TechState } from '../../engine/types';
  import { SIGNAL_CAPS } from '../../engine/signal';
  import Tooltip from './Tooltip.svelte';

  let {
    signal,
    era,
    techs,
  }: {
    signal: SignalState;
    era: Era;
    techs: TechState[];
  } = $props();

  const discoveredTechIds = $derived(
    new Set(techs.filter((t) => t.stage === 'discovered').map((t) => t.defId)),
  );

  const era1GateCleared = $derived(discoveredTechIds.has(SIGNAL_CAPS.era1Gate));
  const era2GateCleared = $derived(discoveredTechIds.has(SIGNAL_CAPS.era2Gate));

  // Paused: in nearSpace+ but no relay facility built yet.
  // We don't have facility instances here, but we can derive pause state from era + gate:
  // If era is nearSpace and signal hasn't moved past where it should be ticking, we approximate.
  // Better: import isSignalPaused — but we need facilities. Instead expose a derived paused prop
  // from whether the relay station exists. We do this by checking techs: if deepSpaceRelayNetwork
  // is not discovered we know they can't have built one.
  const relayTechDiscovered = $derived(discoveredTechIds.has('deepSpaceRelayNetwork'));
  // If relay tech isn't discovered, they can't have the facility → definitely paused in nearSpace.
  // If relay tech IS discovered, we can't know from techs alone whether they built it.
  // We show "paused" indicator only when we're certain (relay tech not yet discovered in nearSpace).
  const definitelyPaused = $derived(era !== 'earth' && !relayTechDiscovered);

  function signalLabel(s: SignalState): string {
    if (s.decodeProgress >= 100) return 'DECODED';
    if (definitelyPaused) return 'NO RELAY';
    if (s.eraStrength === 'urgent') return 'URGENT';
    if (s.eraStrength === 'structured') return 'STRUCTURED';
    return 'FAINT';
  }

  function signalColor(s: SignalState): string {
    if (s.decodeProgress >= 100) return '#4a9b7a';
    if (definitelyPaused) return '#5a4a6a';
    if (s.eraStrength === 'urgent') return '#c84a4a';
    if (s.eraStrength === 'structured') return '#c8a040';
    return '#4a6878';
  }

  const tooltipText = $derived(
    definitelyPaused
      ? 'Signal relay contact lost. Research Deep Space Relay Network and build a Signal Relay Station in cislunar space to resume decoding the alien signal.'
      : !era1GateCleared
        ? 'Our progress in decoding the signal has stalled; we need better tools and technologies to advance further.'
        : !era2GateCleared
          ? 'The signal is clearly interstellar in origin. But we will need to progress deeper into the solar system to make sense of it.'
          : 'Progress decoding the alien signal. Unlocks new techs and events as it advances.',
  );
</script>

<div class="signal-track-panel">
  <span class="panel-title">SIGNAL</span>
  <Tooltip text={tooltipText} direction="below">
    <div class="signal-row">
      <span class="signal-label" style="color: {signalColor(signal)}">{signalLabel(signal)}</span>
      <div class="signal-track">
        <div
          class="signal-fill"
          class:paused={definitelyPaused}
          style="width: {signal.decodeProgress}%; background: {signalColor(signal)}"
        ></div>
        {#if !era1GateCleared}
          <div class="cap-marker" style="left: 33%"></div>
        {/if}
        {#if era1GateCleared && !era2GateCleared}
          <div class="cap-marker" style="left: 66%"></div>
        {/if}
      </div>
      <span class="signal-pct" style="color: {signalColor(signal)}"
      >{signal.decodeProgress.toFixed(0)}%</span>
    </div>
  </Tooltip>
  <div class="divider"></div>
</div>

<style>
    .signal-track-panel {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.6rem 0.6rem 0;
        background: var(--surface-1);
        border-left: 1px solid var(--border-panel);
        flex-shrink: 0;
    }

    .panel-title {
        font-size: var(--fs-base);
        letter-spacing: 0.2em;
        color: var(--text-dim);
        width: 5.5rem;
        padding: 0;
    }

    .signal-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: var(--fs-md);
    }

    .signal-label {
        width: 5.5rem;
        font-size: var(--fs-base);
        letter-spacing: var(--ls-wide);
        flex-shrink: 0;
    }

    .signal-track {
        flex: 1;
        height: 6px;
        background: var(--surface-3);
        border-radius: var(--radius-sm);
        overflow: visible;
        position: relative;
    }

    .signal-fill {
        height: 100%;
        border-radius: var(--radius-sm);
        transition: width 0.4s ease;
    }

    .signal-fill.paused {
        opacity: 0.5;
    }

    .cap-marker {
        position: absolute;
        top: -3px;
        width: 2px;
        height: 12px;
        background: #8a5a2a;
        border-radius: 1px;
        transform: translateX(-50%);
        cursor: default;
    }

    .signal-pct {
        width: 3rem;
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-size: var(--fs-base);
        flex-shrink: 0;
    }

    .divider {
        /*height: 1px;*/
        background: var(--surface-3);
        margin-top: 0.2rem;
    }
</style>
