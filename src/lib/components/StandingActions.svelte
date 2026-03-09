<script lang="ts">
  import type { StandingActionDef, StandingActionRestriction, Resources } from '../../engine/types';

  let {
    actions,
    restrictions,
    turn,
    phase,
    playerResources,
    onAction,
  }: {
    actions: StandingActionDef[];
    restrictions: StandingActionRestriction[];
    turn: number;
    phase: string;
    playerResources: Resources;
    onAction: (actionId: string) => void;
  } = $props();

  function isRestricted(actionId: string): boolean {
    return restrictions.some((r) => r.actionId === actionId && r.expiresAfterTurn >= turn);
  }

  function canAfford(cost: Partial<Resources>): boolean {
    return (
      (cost.funding == null || playerResources.funding >= cost.funding) &&
      (cost.materials == null || playerResources.materials >= cost.materials) &&
      (cost.politicalWill == null || playerResources.politicalWill >= cost.politicalWill)
    );
  }

  function isDisabled(action: StandingActionDef): boolean {
    return phase !== 'action' || isRestricted(action.id) || !canAfford(action.cost);
  }

  function formatCost(cost: Partial<Resources>): string {
    const parts: string[] = [];
    if (cost.funding != null) parts.push(`${cost.funding}F`);
    if (cost.materials != null) parts.push(`${cost.materials}M`);
    if (cost.politicalWill != null) parts.push(`${cost.politicalWill}W`);
    return parts.join(' ');
  }

  function restrictionReason(action: StandingActionDef): string {
    if (phase !== 'action') return 'Not your action phase.';
    if (isRestricted(action.id)) return 'Restricted by active event.';
    if (!canAfford(action.cost)) return 'Insufficient resources.';
    return '';
  }
</script>

<div class="standing-actions">
  <div class="panel-title">STANDING ACTIONS</div>
  <div class="actions-row">
    {#each actions as action}
      {@const disabled = isDisabled(action)}
      {@const restricted = isRestricted(action.id)}
      <button
        class="action-btn"
        class:disabled
        class:restricted
        {disabled}
        onclick={() => onAction(action.id)}
        title="{action.description}{disabled ? '\n' + restrictionReason(action) : ''}"
      >
        <span class="action-name">{action.name}</span>
        <span class="action-cost">{formatCost(action.cost)}</span>
        {#if restricted}
          <span class="lock-icon">⊘</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .standing-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid #1e2530;
    border-right: 1px solid #1e2530;
    background: #0a0e15;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: #3a4858;
  }

  .actions-row {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .action-btn {
    position: relative;
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    padding: 0.35rem 0.65rem 0.25rem;
    border: 1px solid #2a4060;
    background: #0d1a28;
    color: #6aaad8;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
    min-width: 4.5rem;
  }

  .action-btn:hover:not(.disabled) {
    background: #152035;
    border-color: #4a8ab4;
  }

  .action-btn.disabled {
    color: #2a3848;
    border-color: #1a2535;
    cursor: not-allowed;
    background: #080c12;
  }

  .action-btn.restricted {
    color: #4a3020;
    border-color: #3a2010;
    background: #0c0805;
  }

  .action-name {
    font-size: 0.7rem;
  }

  .action-cost {
    font-size: 0.58rem;
    color: #4a6888;
  }

  .action-btn.disabled .action-cost {
    color: #2a3040;
  }

  .action-btn.restricted .action-cost {
    color: #3a2818;
  }

  .lock-icon {
    position: absolute;
    top: 0.15rem;
    right: 0.2rem;
    font-size: 0.55rem;
    color: #7a3a1a;
  }
</style>
