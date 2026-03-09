<script lang="ts">
  import type { CardInstance, CardDef, FieldPoints } from '../../engine/types';
  import { BANK_LIMIT } from '../../engine/cards';

  let {
    cards,
    cardDefs,
    phase,
    activeEventTags,
    actionsThisTurn,
    maxActionsPerTurn,
    onPlay,
    onBank,
    onUnbank,
  }: {
    cards: CardInstance[];
    cardDefs: Map<string, CardDef>;
    phase: string;
    activeEventTags: string[];
    actionsThisTurn: number;
    maxActionsPerTurn: number;
    onPlay: (cardId: string) => void;
    onBank: (cardId: string) => void;
    onUnbank: (cardId: string) => void;
  } = $props();

  const handCards = $derived(cards.filter((c) => c.zone === 'hand'));
  const bankedCards = $derived(cards.filter((c) => c.zone === 'bank'));
  const bankFull = $derived(bankedCards.length >= BANK_LIMIT);
  const inAction = $derived(phase === 'action');
  const atActionCap = $derived(actionsThisTurn >= maxActionsPerTurn);
  const canPlay = $derived(inAction && !atActionCap);

  function canCounter(def: CardDef): boolean {
    return (
      !!def.counterEffect && activeEventTags.includes(def.counterEffect.countersEventTag)
    );
  }

  function formatEffect(def: CardDef): string[] {
    const lines: string[] = [];
    if (def.effect.resources) {
      const r = def.effect.resources;
      if (r.funding != null) lines.push(`${r.funding > 0 ? '+' : ''}${r.funding} Funding`);
      if (r.materials != null) lines.push(`${r.materials > 0 ? '+' : ''}${r.materials} Materials`);
      if (r.politicalWill != null)
        lines.push(`${r.politicalWill > 0 ? '+' : ''}${r.politicalWill} Will`);
    }
    if (def.effect.fields) {
      const f = def.effect.fields;
      for (const [k, v] of Object.entries(f) as [keyof FieldPoints, number][]) {
        if (v != null) lines.push(`+${v} ${fieldLabel(k)}`);
      }
    }
    if (def.effect.signalProgress) {
      lines.push(`+${def.effect.signalProgress} Signal`);
    }
    return lines;
  }

  function fieldLabel(k: keyof FieldPoints): string {
    const labels: Record<keyof FieldPoints, string> = {
      physics: 'PHY',
      mathematics: 'MATH',
      engineering: 'ENG',
      biochemistry: 'BIO',
      computing: 'COMP',
      socialScience: 'SOC',
    };
    return labels[k];
  }

  function effectColor(line: string): string {
    if (line.startsWith('-')) return '#c84a4a';
    if (line.startsWith('+')) return '#4a9b7a';
    return '#8a9aaa';
  }
</script>

<div class="card-hand">
  <!-- Banked cards -->
  {#if bankedCards.length > 0}
    <div class="bank-section">
      <span class="zone-label">BANK ({bankedCards.length}/{BANK_LIMIT})</span>
      <div class="card-row">
        {#each bankedCards as card (card.id)}
          {@const def = cardDefs.get(card.defId)}
          {#if def}
            <div class="card banked">
              <div class="card-header">
                <span class="card-name">{def.name}</span>
                {#if def.counterEffect}
                  <span class="counter-tag" title="Counters: {def.counterEffect.countersEventTag}"
                    >⚡</span
                  >
                {/if}
              </div>
              <div class="card-effects">
                {#each formatEffect(def) as line}
                  <span class="effect-line" style="color: {effectColor(line)}">{line}</span>
                {/each}
              </div>
              <div class="card-flavour">{def.flavourText}</div>
              {#if def.counterEffect}
                <div class="counter-info">Counter: {def.counterEffect.countersEventTag}</div>
              {/if}
              <div class="card-actions">
                <button
                  class="btn btn-unbank"
                  onclick={() => onUnbank(card.id)}
                  title="Return to discard pile"
                >
                  UNBANK
                </button>
              </div>
              {#if card.bankedSinceTurn != null}
                <div class="bank-since">Banked T{card.bankedSinceTurn} · −1 Will/turn</div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Hand cards -->
  <div class="hand-section">
    <div class="hand-header">
      <span class="zone-label">HAND ({handCards.length})</span>
      {#if inAction}
        <span class="action-counter" class:at-cap={atActionCap}>
          ACTIONS {actionsThisTurn}/{maxActionsPerTurn}
        </span>
      {:else}
        <span class="phase-hint">Cards available during Action phase.</span>
      {/if}
    </div>
    <div class="card-row">
      {#each handCards as card (card.id)}
        {@const def = cardDefs.get(card.defId)}
        {#if def}
          {@const isCounter = canCounter(def)}
          <div class="card hand" class:can-counter={isCounter}>
            {#if isCounter}
              <div class="counter-badge">COUNTER AVAILABLE</div>
            {/if}
            <div class="card-header">
              <span class="card-name">{def.name}</span>
              {#if def.counterEffect}
                <span class="counter-tag" title="Counters: {def.counterEffect.countersEventTag}"
                  >⚡</span
                >
              {/if}
            </div>
            <div class="card-effects">
              {#each formatEffect(def) as line}
                <span class="effect-line" style="color: {effectColor(line)}">{line}</span>
              {/each}
            </div>
            <div class="card-flavour">{def.flavourText}</div>
            {#if def.counterEffect}
              <div class="counter-info">Counter: {def.counterEffect.countersEventTag}</div>
            {/if}
            <div class="card-actions">
              <button
                class="btn btn-play"
                class:disabled={!canPlay}
                disabled={!canPlay}
                onclick={() => onPlay(card.id)}
                title={atActionCap ? 'Action limit reached this turn' : !inAction ? 'Not the action phase' : ''}
              >
                PLAY
              </button>
              <button
                class="btn btn-bank"
                class:disabled={!inAction || bankFull}
                disabled={!inAction || bankFull}
                onclick={() => onBank(card.id)}
                title={bankFull ? 'Bank is full' : 'Hold for next turn (costs 1 Will/turn)'}
              >
                BANK
              </button>
            </div>
          </div>
        {/if}
      {/each}

      {#if handCards.length === 0}
        <div class="empty-hand">No cards in hand.</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .card-hand {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid #1e2530;
    background: #090d14;
    overflow-x: auto;
    flex-shrink: 0;
  }

  .zone-label {
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: #3a4858;
    display: block;
    margin-bottom: 0.3rem;
  }

  .bank-section {
    flex-shrink: 0;
  }
  .hand-section {
    flex-shrink: 0;
  }

  .hand-header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 0.3rem;
  }

  .hand-header .zone-label {
    margin-bottom: 0;
  }

  .action-counter {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: #4a8ab4;
  }

  .action-counter.at-cap {
    color: #c84a4a;
  }

  .phase-hint {
    font-size: 0.6rem;
    color: #2a3848;
    font-style: italic;
  }

  .card-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: nowrap;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.55rem 0.65rem;
    border: 1px solid;
    width: 11rem;
    flex-shrink: 0;
    font-size: 0.7rem;
    position: relative;
  }

  .card.hand {
    border-color: #2a4060;
    background: #0d1a28;
  }
  .card.banked {
    border-color: #4a3a10;
    background: #181008;
  }

  .card.can-counter {
    border-color: #7a6a10;
    background: #111008;
  }

  .counter-badge {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    color: #c8a040;
    background: #1a1400;
    border: 1px solid #5a4a10;
    padding: 0.1rem 0.3rem;
    text-align: center;
    margin-bottom: 0.1rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .card-name {
    color: #c8d0d8;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .counter-tag {
    font-size: 0.65rem;
    color: #c8a040;
    cursor: help;
  }

  .card-effects {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .effect-line {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .card-flavour {
    color: #3a4858;
    font-size: 0.62rem;
    font-style: italic;
    line-height: 1.35;
    flex: 1;
  }

  .counter-info {
    font-size: 0.6rem;
    color: #8a6a20;
    border-top: 1px solid #3a2a08;
    padding-top: 0.2rem;
  }

  .bank-since {
    font-size: 0.58rem;
    color: #6a5020;
  }

  .card-actions {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.1rem;
  }

  .btn {
    font-family: inherit;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    padding: 0.25rem 0.4rem;
    border: 1px solid;
    background: transparent;
    cursor: pointer;
    flex: 1;
    transition: background 0.15s ease;
  }

  .btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .btn-play {
    color: #4a9b7a;
    border-color: #2a6050;
  }
  .btn-play:not(.disabled):hover {
    background: #0a2018;
  }

  .btn-bank {
    color: #c8a040;
    border-color: #7a5a1a;
  }
  .btn-bank:not(.disabled):hover {
    background: #2a1a05;
  }

  .btn-unbank {
    color: #8a6878;
    border-color: #4a3848;
    width: 100%;
  }
  .btn-unbank:hover {
    background: #1a1018;
  }

  .empty-hand {
    color: #2a3848;
    font-size: 0.7rem;
    font-style: italic;
    padding: 0.5rem;
    align-self: center;
  }
</style>
