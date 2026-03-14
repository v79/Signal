<script lang="ts">
  import type { SignalState, SignalResponseOption } from '../../engine/types';

  let {
    signal,
    wormholeOptions = [],
    onCommitWormholeResponse,
  }: {
    signal: SignalState;
    wormholeOptions?: SignalResponseOption[];
    onCommitWormholeResponse?: (optionId: string) => void;
  } = $props();

  const isClimax = $derived(signal.decodeProgress >= 100 && !signal.responseCommitted);
</script>

{#if isClimax && wormholeOptions.length > 0}
  <div class="climax-section">
    <div class="climax-title">⬡ WORMHOLE RESPONSE REQUIRED</div>
    <p class="climax-intro">
      The signal is fully decoded. Select a response. This decision cannot be undone.
    </p>
    {#each wormholeOptions as opt}
      <button
        class="response-option"
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
  <div
    class="response-result"
    class:success={signal.wormholeActivated}
    class:failure={!signal.wormholeActivated}
  >
    {signal.wormholeActivated ? '⬡ WORMHOLE ACTIVATED' : '⬡ RESPONSE INCORRECT'}
  </div>
{/if}

<style>
  .climax-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.6rem;
    border-top: 1px solid #1a2030;
    background: #060c18;
    flex-shrink: 0;
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
    padding: 0.4rem 0.6rem;
    border-top: 1px solid #1a2030;
    text-align: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .response-result.success {
    color: #4ad480;
    background: #0a2818;
  }

  .response-result.failure {
    color: #d46a4a;
    background: #1e0e08;
  }
</style>
