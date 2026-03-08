<script lang="ts">
  import type { OngoingAction } from '../../engine/types';
  import type { FacilityDef } from '../../engine/types';

  let {
    queue,
    facilityDefs,
  }: {
    queue: OngoingAction[];
    facilityDefs: Map<string, FacilityDef>;
  } = $props();
</script>

{#if queue.length > 0}
  <div class="panel">
    <div class="panel-header">ONGOING</div>
    {#each queue as action (action.id)}
      {@const def = facilityDefs.get(action.facilityDefId)}
      {@const progress = (action.totalTurns - action.turnsRemaining) / action.totalTurns}
      <div class="action-row">
        <span class="badge" class:build={action.type === 'construct'} class:demo={action.type === 'demolish'}>
          {action.type === 'construct' ? 'BUILD' : 'DEMO'}
        </span>
        <div class="action-body">
          <div class="action-name">{def?.name ?? action.facilityDefId}</div>
          <div class="progress-track">
            <div class="progress-fill" style="width: {Math.round(progress * 100)}%"></div>
          </div>
          <div class="turns-left">
            {action.turnsRemaining} turn{action.turnsRemaining === 1 ? '' : 's'} remaining
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .panel {
    border-top: 1px solid #1e2530;
    padding: 0.4rem 0.6rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .panel-header {
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    color: #3a5060;
    margin-bottom: 0.1rem;
  }

  .action-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .badge {
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.35rem;
    border-radius: 1px;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .badge.build {
    background: #0a2840;
    color: #4a9bd8;
    border: 1px solid #1a4870;
  }

  .badge.demo {
    background: #280a0a;
    color: #c04040;
    border: 1px solid #601010;
  }

  .action-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .action-name {
    font-size: 0.65rem;
    color: #8aaabb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-track {
    height: 3px;
    background: #0f1e28;
    border-radius: 1px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #2a6090;
    transition: width 0.3s ease;
  }

  .action-row:has(.demo) .progress-fill {
    background: #802020;
  }

  .turns-left {
    font-size: 0.58rem;
    color: #3a5060;
  }
</style>
