<script lang="ts">
  import { untrack } from 'svelte';
  import type { EventInstance, EventDef, Resources } from '../../engine/types';

  let {
    events,
    eventDefs,
    currentTurn,
    onMitigate,
    onAccept,
    onDefer,
  }: {
    events: EventInstance[];
    eventDefs: Map<string, EventDef>;
    currentTurn: number;
    onMitigate: (eventId: string) => void;
    onAccept: (eventId: string) => void;
    onDefer?: (eventId: string) => void;
  } = $props();

  const activeEvents = $derived(events.filter((e) => !e.resolved));

  // Events kept briefly after resolution so they can animate out
  let leavingEvents = $state<EventInstance[]>([]);

  // Non-reactive: cache event data and previous active set
  const dataCache = new Map<string, EventInstance>();
  let prevActiveIds = new Set<string>();

  $effect(() => {
    const current = activeEvents;
    const currentIds = new Set(current.map((e) => e.id));

    // Keep cache fresh so we have data when events leave
    for (const e of current) dataCache.set(e.id, e);

    // Detect events that just left the active list
    const currentLeavingIds = new Set(untrack(() => leavingEvents).map((e) => e.id));
    for (const id of prevActiveIds) {
      if (!currentIds.has(id) && !currentLeavingIds.has(id)) {
        const data = dataCache.get(id);
        if (data) {
          untrack(() => {
            leavingEvents = [...leavingEvents, data];
          });
          setTimeout(() => {
            leavingEvents = leavingEvents.filter((e) => e.id !== id);
          }, 420);
        }
      }
    }

    prevActiveIds = new Set(currentIds);
  });

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
      if (r.funding != null) parts.push(`${r.funding > 0 ? '+' : ''}${r.funding} Fund`);
      if (r.materials != null) parts.push(`${r.materials > 0 ? '+' : ''}${r.materials} Mat`);
      if (r.politicalWill != null)
        parts.push(`${r.politicalWill > 0 ? '+' : ''}${r.politicalWill} Will`);
    }
    return parts.join(' · ');
  }

  function formatCost(cost: Partial<Resources>): string {
    const parts: string[] = [];
    if (cost.funding != null) parts.push(`${cost.funding} Fund`);
    if (cost.materials != null) parts.push(`${cost.materials} Mat`);
    if (cost.politicalWill != null) parts.push(`${cost.politicalWill} Will`);
    return parts.join(', ');
  }

  function counterTagLabel(def: EventDef): string {
    return (def.tags.find((t) => t !== 'crisis') ?? def.tags[0] ?? '?').toUpperCase();
  }

  const leavingIds = $derived(new Set(leavingEvents.map((e) => e.id)));
</script>

<aside class="event-zone">
  <div class="panel-title">EVENTS</div>

  {#if activeEvents.length === 0 && leavingEvents.length === 0}
    <div class="empty">No active events.</div>
  {/if}

  {#each [...activeEvents, ...leavingEvents] as event (event.id)}
    {@const def = eventDefs.get(event.defId)}
    {@const isLeaving = leavingIds.has(event.id)}
    {@const isNew = !isLeaving && event.arrivedTurn === currentTurn}
    {@const isProposal = def?.tags.includes('proposal') ?? false}
    {#if def}
      <div
        class="event-card {isProposal ? 'proposal' : urgencyClass(event.countdownRemaining)}"
        class:leaving={isLeaving}
      >
        <div class="event-header">
          <span class="event-name">{def.name}</span>
          {#if !isProposal}
            <span class="countdown {urgencyClass(event.countdownRemaining)}">
              ⏱ {event.countdownRemaining}
            </span>
          {:else}
            <span class="proposal-badge">PROPOSAL</span>
          {/if}
        </div>

        {#if isNew}
          <div class="event-tags">
            {#each def.tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>

          <p class="event-desc">{def.description}</p>
          <p class="event-flavour">{def.flavourText}</p>
        {/if}

        <div class="effect-row negative">
          {formatEffect(def.negativeEffect)}
        </div>

        {#if def.positiveEffect}
          <div class="effect-row positive">
            Accept: {formatEffect(def.positiveEffect)}
          </div>
        {/if}

        {#if !isLeaving}
          <div class="event-actions">
            {#if isProposal}
              <button class="btn btn-authorise" onclick={() => onAccept(event.id)}>
                AUTHORISE<br />
                <span class="btn-cost">(-50F · -30W)</span>
              </button>
              <button class="btn btn-defer" onclick={() => onDefer?.(event.id)}>
                DEFER
              </button>
            {:else if def.responseTier === 'partialMitigation' && def.mitigationCost}
              <button class="btn btn-mitigate" onclick={() => onMitigate(event.id)}>
                MITIGATE<br />
                <span class="btn-cost">({formatCost(def.mitigationCost)})</span>
              </button>
            {:else if def.responseTier === 'noCounter' && def.positiveEffect}
              {@const acceptCost = Object.entries(def.positiveEffect.resources ?? {}).filter(([, v]) => (v as number) < 0)}
              <button class="btn btn-accept" onclick={() => onAccept(event.id)}>
                ACCEPT
                {#if acceptCost.length > 0}
                  <br /><span class="btn-cost">({acceptCost.map(([k, v]) => `${v} ${k === 'funding' ? 'F' : k === 'materials' ? 'Mat' : 'W'}`).join(' · ')})</span>
                {/if}
              </button>
            {:else if def.responseTier === 'fullCounter'}
              <span class="counter-hint">Counter with a <strong>{counterTagLabel(def)}</strong> card.</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</aside>

<style>
  .event-zone {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 4px 0.6rem 0.6rem;
    background: var(--surface-1);
    border-right: 1px solid var(--border-panel);
    overflow-y: auto;
    min-width: 0;
  }

  .panel-title {
    font-size: var(--fs-base);
    letter-spacing: 0.2em;
    color: #5a6878;
    border-bottom: 1px solid var(--border-panel);
    padding-bottom: 0.3rem;
    margin-bottom: 0.2rem;
  }

  .empty {
    font-size: var(--fs-md);
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
    font-size: var(--fs-md);
  }

  .event-card.urgent {
    border-color: var(--danger-border);
  }
  .event-card.warning {
    border-color: var(--warn-border);
  }
  .event-card.normal {
    border-color: #2a3545;
  }
  .event-card.proposal {
    border-color: var(--info-border);
    background: var(--info-hover);
  }

  @keyframes slide-out-left {
    to {
      transform: translateX(-120%);
      opacity: 0;
      max-height: 0;
      padding: 0;
      margin: 0;
      border-width: 0;
      gap: 0;
    }
  }

  .event-card.leaving {
    animation: slide-out-left 380ms ease-in forwards;
    pointer-events: none;
    overflow: hidden;
  }

  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .event-name {
    color: var(--text-primary);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
  }

  .countdown {
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .countdown.urgent {
    color: var(--danger);
  }
  .countdown.warning {
    color: var(--warn);
  }
  .countdown.normal {
    color: #5a6878;
  }

  .event-tags {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  .tag {
    font-size: var(--fs-sm);
    letter-spacing: 0.08em;
    color: #4a6a8a;
    border: 1px solid var(--info-border);
    padding: 0 0.3rem;
  }

  .event-desc {
    color: #8a9aaa;
    line-height: 1.4;
  }

  .event-flavour {
    color: #7a8e9e;
    font-style: italic;
    font-size: 0.67rem;
    line-height: 1.4;
  }

  .effect-row {
    font-size: 0.68rem;
    padding: 0.2rem 0.4rem;
  }

  .effect-row.negative {
    color: var(--danger);
    background: var(--danger-hover);
  }

  .effect-row.positive {
    color: var(--ok);
    background: var(--ok-hover);
  }

  .event-actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.2rem;
  }

  .btn {
    font-family: inherit;
    font-size: var(--fs-sm);
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
    color: var(--warn);
    border-color: var(--warn-border);
  }
  .btn-mitigate:hover {
    background: var(--warn-hover);
  }

  .btn-accept {
    color: var(--ok);
    border-color: var(--ok-border);
  }
  .btn-accept:hover {
    background: var(--ok-hover);
  }

  .btn-authorise {
    color: var(--info);
    border-color: var(--info-border);
  }
  .btn-authorise:hover {
    background: var(--info-hover);
  }

  .btn-defer {
    color: #8a8a9a;
    border-color: #3a3a5a;
  }
  .btn-defer:hover {
    background: #101018;
  }

  .proposal-badge {
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    color: #4a7aaa;
    border: 1px solid var(--info-border);
    padding: 0.1rem 0.35rem;
  }

  .btn-cost {
    font-size: var(--fs-xs);
    color: #c88030;
    letter-spacing: 0;
  }

  .counter-hint {
    color: var(--text-dim);
    font-style: italic;
    font-size: var(--fs-base);
    align-self: center;
  }
</style>
