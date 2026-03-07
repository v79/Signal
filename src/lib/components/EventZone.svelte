<script lang="ts">
  import type { EventInstance, EventDef, Resources } from '../../engine/types';

  let {
    events,
    eventDefs,
    onMitigate,
    onAccept,
    onDecline,
  }: {
    events: EventInstance[];
    eventDefs: Map<string, EventDef>;
    onMitigate: (eventId: string) => void;
    onAccept:   (eventId: string) => void;
    onDecline:  (eventId: string) => void;
  } = $props();

  const activeEvents = $derived(events.filter(e => !e.resolved));

  function urgencyClass(countdown: number): string {
    if (countdown <= 1) return 'urgent';
    if (countdown <= 2) return 'warning';
    return 'normal';
  }

  function formatEffect(effect: EventDef['negativeEffect'] | null): string {
    if (!effect) return '';
    const parts: string[] = [];
    if (effect.resources) {
      const r = effect.resources;
      if (r.funding       != null) parts.push(`${r.funding > 0 ? '+' : ''}${r.funding} Fund`);
      if (r.materials     != null) parts.push(`${r.materials > 0 ? '+' : ''}${r.materials} Mat`);
      if (r.politicalWill != null) parts.push(`${r.politicalWill > 0 ? '+' : ''}${r.politicalWill} Will`);
    }
    if (effect.restrictActions?.length) {
      parts.push(`Restricts: ${effect.restrictActions.join(', ')}`);
    }
    return parts.join(' · ');
  }

  function formatCost(cost: Partial<Resources>): string {
    const parts: string[] = [];
    if (cost.funding       != null) parts.push(`${cost.funding} Fund`);
    if (cost.materials     != null) parts.push(`${cost.materials} Mat`);
    if (cost.politicalWill != null) parts.push(`${cost.politicalWill} Will`);
    return parts.join(', ');
  }
</script>

<aside class="event-zone">
  <div class="panel-title">EVENTS</div>

  {#if activeEvents.length === 0}
    <div class="empty">No active events.</div>
  {/if}

  {#each activeEvents as event (event.id)}
    {@const def = eventDefs.get(event.defId)}
    {#if def}
      <div class="event-card {urgencyClass(event.countdownRemaining)}">
        <div class="event-header">
          <span class="event-name">{def.name}</span>
          <span class="countdown {urgencyClass(event.countdownRemaining)}">
            ⏱ {event.countdownRemaining}
          </span>
        </div>

        <div class="event-tags">
          {#each def.tags as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>

        <p class="event-desc">{def.description}</p>
        <p class="event-flavour">{def.flavourText}</p>

        <div class="effect-row negative">
          {formatEffect(def.negativeEffect)}
        </div>

        {#if def.positiveEffect}
          <div class="effect-row positive">
            Accept: {formatEffect(def.positiveEffect)}
          </div>
        {/if}

        <div class="event-actions">
          {#if def.responseTier === 'partialMitigation' && def.mitigationCost}
            <button
              class="btn btn-mitigate"
              onclick={() => onMitigate(event.id)}
            >
              MITIGATE<br/>
              <span class="btn-cost">({formatCost(def.mitigationCost)})</span>
            </button>
            <button class="btn btn-ignore" onclick={() => onDecline(event.id)}>
              IGNORE
            </button>
          {:else if def.responseTier === 'noCounter' && def.positiveEffect}
            <button class="btn btn-accept" onclick={() => onAccept(event.id)}>
              ACCEPT
            </button>
            <button class="btn btn-ignore" onclick={() => onDecline(event.id)}>
              DECLINE
            </button>
          {:else if def.responseTier === 'noCounter'}
            <button class="btn btn-ignore" onclick={() => onDecline(event.id)}>
              ACKNOWLEDGE
            </button>
          {:else}
            <!-- fullCounter: card-based countering handled in CardHand -->
            <span class="counter-hint">Counter with a matching card.</span>
            <button class="btn btn-ignore" onclick={() => onDecline(event.id)}>
              IGNORE
            </button>
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</aside>

<style>
  .event-zone {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem;
    background: #0c1018;
    border-right: 1px solid #1e2530;
    overflow-y: auto;
    min-width: 0;
  }

  .panel-title {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: #5a6878;
    border-bottom: 1px solid #1e2530;
    padding-bottom: 0.3rem;
    margin-bottom: 0.2rem;
  }

  .empty {
    font-size: 0.7rem;
    color: #3a4050;
    font-style: italic;
    padding: 0.5rem 0;
  }

  .event-card {
    border: 1px solid #2a3545;
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.72rem;
  }

  .event-card.urgent  { border-color: #7a2a2a; }
  .event-card.warning { border-color: #7a5a1a; }
  .event-card.normal  { border-color: #2a3545; }

  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .event-name {
    color: #c8d0d8;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
  }

  .countdown {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .countdown.urgent  { color: #c84a4a; }
  .countdown.warning { color: #c8a040; }
  .countdown.normal  { color: #5a6878; }

  .event-tags {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    color: #4a6a8a;
    border: 1px solid #2a4060;
    padding: 0 0.3rem;
  }

  .event-desc {
    color: #8a9aaa;
    line-height: 1.4;
  }

  .event-flavour {
    color: #4a5868;
    font-style: italic;
    font-size: 0.65rem;
    line-height: 1.4;
  }

  .effect-row {
    font-size: 0.68rem;
    padding: 0.2rem 0.4rem;
  }

  .effect-row.negative {
    color: #c84a4a;
    background: #1a0a0a;
  }

  .effect-row.positive {
    color: #4a9b7a;
    background: #0a1a0f;
  }

  .event-actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.2rem;
  }

  .btn {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.5rem;
    border: 1px solid;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: center;
    line-height: 1.3;
  }

  .btn-mitigate {
    color: #c8a040;
    border-color: #7a5a1a;
  }
  .btn-mitigate:hover { background: #2a1a05; }

  .btn-accept {
    color: #4a9b7a;
    border-color: #2a6050;
  }
  .btn-accept:hover { background: #0a2018; }

  .btn-ignore {
    color: #5a6878;
    border-color: #2a3545;
  }
  .btn-ignore:hover { background: #15202a; }

  .btn-cost {
    font-size: 0.58rem;
    color: #c88030;
    letter-spacing: 0;
  }

  .counter-hint {
    color: #4a6080;
    font-style: italic;
    font-size: 0.65rem;
    align-self: center;
  }
</style>
