<script lang="ts">
  import type { BoardSlots, BoardMemberDef, BoardRole, TurnPhase } from '../../engine/types';

  const ALL_ROLES: BoardRole[] = [
    'chiefScientist',
    'directorOfEngineering',
    'headOfFinance',
    'politicalLiaison',
    'directorOfOperations',
    'securityDirector',
    'signalAnalyst',
  ];

  const ROLE_LABELS: Record<BoardRole, string> = {
    chiefScientist:        'Chief Scientist',
    directorOfEngineering: 'Dir. Engineering',
    headOfFinance:         'Head of Finance',
    politicalLiaison:      'Political Liaison',
    directorOfOperations:  'Dir. Operations',
    securityDirector:      'Security Director',
    signalAnalyst:         'Signal Analyst',
  };

  let {
    board,
    boardDefs,
    phase,
    onRecruit,
    onDismiss,
  }: {
    board: BoardSlots;
    boardDefs: Map<string, BoardMemberDef>;
    phase: TurnPhase;
    onRecruit: (defId: string) => void;
    onDismiss: (role: BoardRole) => void;
  } = $props();

  /** Members available to recruit for a given role (slot must be vacant). */
  function availableForRole(role: BoardRole): BoardMemberDef[] {
    return [...boardDefs.values()].filter(d => d.role === role);
  }

  /** True if the role slot holds an active (non-departed) member. */
  function isOccupied(role: BoardRole): boolean {
    const m = board[role];
    return !!m && m.leftTurn === null;
  }

  let expandedRole = $state<BoardRole | null>(null);

  function toggleExpand(role: BoardRole) {
    expandedRole = expandedRole === role ? null : role;
  }
</script>

<div class="board-panel">
  <h3 class="panel-title">BOARD</h3>
  <div class="slots">
    {#each ALL_ROLES as role}
      {@const member = board[role]}
      {@const active = member && member.leftTurn === null}
      {@const def = active ? boardDefs.get(member!.defId) : null}

      <div class="slot" class:occupied={active} class:vacant={!active}>
        <button class="slot-header" onclick={() => toggleExpand(role)} aria-expanded={expandedRole === role}>
          <span class="role-label">{ROLE_LABELS[role]}</span>
          {#if active && member}
            <span class="member-name">{def?.name ?? member.defId}</span>
            <span class="age">age {member.age}</span>
          {:else}
            <span class="vacant-label">VACANT</span>
          {/if}
          <span class="chevron" class:open={expandedRole === role}>›</span>
        </button>

        {#if expandedRole === role}
          <div class="slot-detail">
            {#if active && def}
              <!-- Active member details -->
              <div class="modifier-list">
                {#each def.buffs as buff}
                  <div class="modifier buff">+ {buff.description}</div>
                {/each}
                {#each def.debuffs as debuff}
                  <div class="modifier debuff">− {debuff.description}</div>
                {/each}
              </div>
              {#if phase === 'action' || phase === 'bank'}
                <button class="action-btn dismiss-btn" onclick={() => onDismiss(role)}>
                  Dismiss
                </button>
              {/if}
            {:else}
              <!-- Vacant slot — show recruit options -->
              {@const candidates = availableForRole(role)}
              {#if candidates.length === 0}
                <p class="no-candidates">No candidates available.</p>
              {:else}
                {#each candidates as candidate}
                  <div class="candidate">
                    <span class="candidate-name">{candidate.name}</span>
                    <div class="modifier-list">
                      {#each candidate.buffs as buff}
                        <div class="modifier buff">+ {buff.description}</div>
                      {/each}
                      {#each candidate.debuffs as debuff}
                        <div class="modifier debuff">− {debuff.description}</div>
                      {/each}
                    </div>
                    {#if phase === 'action' || phase === 'bank'}
                      <button class="action-btn recruit-btn" onclick={() => onRecruit(candidate.id)}>
                        Recruit <span class="cost">15F · 10W</span>
                      </button>
                    {/if}
                  </div>
                {/each}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .board-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #06090f;
    border-left: 1px solid #1a2530;
  }

  .panel-title {
    font-size: 0.58rem;
    letter-spacing: 0.2em;
    color: #3a5268;
    padding: 0.5rem 0.75rem 0.3rem;
    border-bottom: 1px solid #111a24;
    margin: 0;
    flex-shrink: 0;
  }

  .slots {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #1a2a38 transparent;
  }

  .slot {
    border-bottom: 1px solid #0e1820;
  }

  .slot-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }

  .slot-header:hover {
    background: #080e18;
  }

  .role-label {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    color: #2e4458;
    min-width: 7rem;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  .member-name {
    font-size: 0.65rem;
    color: #7ab4d8;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .age {
    font-size: 0.55rem;
    color: #2e4a5a;
    flex-shrink: 0;
  }

  .vacant-label {
    font-size: 0.55rem;
    color: #1e3040;
    letter-spacing: 0.1em;
    flex: 1;
  }

  .chevron {
    font-size: 0.8rem;
    color: #2e4458;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .slot-detail {
    padding: 0.4rem 0.75rem 0.6rem;
    background: #04070d;
  }

  .modifier-list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-bottom: 0.5rem;
  }

  .modifier {
    font-size: 0.6rem;
    line-height: 1.4;
    padding-left: 0.25rem;
  }
  .buff   { color: #4a9a6a; border-left: 2px solid #1a5030; }
  .debuff { color: #9a5a4a; border-left: 2px solid #502020; }

  .no-candidates {
    font-size: 0.6rem;
    color: #2e4458;
    margin: 0;
  }

  .candidate {
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #0e1820;
  }
  .candidate:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .candidate-name {
    display: block;
    font-size: 0.65rem;
    color: #5a8aaa;
    margin-bottom: 0.25rem;
  }

  .action-btn {
    margin-top: 0.4rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.6rem;
    font-family: inherit;
    letter-spacing: 0.08em;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid;
  }

  .recruit-btn {
    background: #0a2e1a;
    color: #5ad486;
    border-color: #1a5030;
  }
  .recruit-btn:hover {
    background: #0f4024;
  }

  .dismiss-btn {
    background: #200a0a;
    color: #c06060;
    border-color: #4a1010;
  }
  .dismiss-btn:hover {
    background: #300e0e;
  }

  .cost {
    opacity: 0.6;
    font-size: 0.55rem;
  }
</style>
