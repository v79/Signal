<script lang="ts">
  import type { BoardSlots, BoardMemberDef, BoardRole, TurnPhase, Resources } from '../../engine/types';

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
    chiefScientist: 'Chief Scientist',
    directorOfEngineering: 'Dir. Engineering',
    headOfFinance: 'Head of Finance',
    politicalLiaison: 'Political Liaison',
    directorOfOperations: 'Dir. Operations',
    securityDirector: 'Security Director',
    signalAnalyst: 'Signal Analyst',
  };

  /** Initial letter used in the portrait placeholder for each role. */
  const ROLE_INITIALS: Record<BoardRole, string> = {
    chiefScientist: 'CS',
    directorOfEngineering: 'DE',
    headOfFinance: 'HF',
    politicalLiaison: 'PL',
    directorOfOperations: 'DO',
    securityDirector: 'SD',
    signalAnalyst: 'SA',
  };

  const DISMISS_COST = 20;

  import type { Era } from '../../engine/types';

  let {
    board,
    boardDefs,
    phase,
    playerResources,
    actionsThisTurn,
    maxActionsPerTurn,
    availableBoardDefIds,
    gracePeriodEnds,
    turn,
    era,
    onRecruit,
    onDismiss,
  }: {
    board: BoardSlots;
    boardDefs: Map<string, BoardMemberDef>;
    phase: TurnPhase;
    playerResources: Resources;
    actionsThisTurn: number;
    maxActionsPerTurn: number;
    availableBoardDefIds: string[];
    gracePeriodEnds: number;
    turn: number;
    era: Era;
    onRecruit: (defId: string) => void;
    onDismiss: (role: BoardRole) => void;
  } = $props();

  /** The next available candidate for this role, or null.
   * Skips anyone currently active on the board (already recruited).
   * AI members are only available in Era 3 (deepSpace).
   * The seed-shuffled order of availableBoardDefIds determines who appears first. */
  function candidateForRole(role: BoardRole): BoardMemberDef | null {
    const activeDefIds = new Set(
      Object.values(board)
        .filter((m): m is NonNullable<typeof m> => !!m && m.leftTurn === null)
        .map((m) => m.defId),
    );
    const defId = availableBoardDefIds.find((id) => {
      const def = boardDefs.get(id);
      if (!def || def.role !== role) return false;
      if (def.isAI && era !== 'deepSpace') return false;
      if (activeDefIds.has(id)) return false;
      return true;
    });
    return defId ? (boardDefs.get(defId) ?? null) : null;
  }

  function isOccupied(role: BoardRole): boolean {
    const m = board[role];
    return !!m && m.leftTurn === null;
  }

  function canAffordRecruit(def: BoardMemberDef): boolean {
    return (
      playerResources.funding >= def.recruitCost.funding &&
      playerResources.politicalWill >= def.recruitCost.politicalWill
    );
  }

  function canAffordDismiss(): boolean {
    return playerResources.politicalWill >= DISMISS_COST;
  }

  function hasActionRemaining(): boolean {
    return actionsThisTurn < maxActionsPerTurn;
  }

  function recruitDisabledReason(def: BoardMemberDef): string | null {
    if (phase !== 'action') return 'Not in action phase';
    if (!hasActionRemaining()) return 'No actions remaining this turn';
    if (playerResources.funding < def.recruitCost.funding)
      return `Requires ${def.recruitCost.funding}F`;
    if (playerResources.politicalWill < def.recruitCost.politicalWill)
      return `Requires ${def.recruitCost.politicalWill}W`;
    return null;
  }

  function dismissDisabledReason(): string | null {
    if (phase !== 'action') return 'Not in action phase';
    if (!canAffordDismiss()) return `Requires ${DISMISS_COST} Political Will`;
    return null;
  }

  const penaltiesActive = $derived(turn > gracePeriodEnds);

  const VACANT_PENALTY_LABELS: Partial<Record<BoardRole, string>> = {
    chiefScientist: '−10% Physics & Mathematics',
    directorOfEngineering: '−10% Engineering',
    headOfFinance: '−10% Funding income',
    politicalLiaison: '−10% Political Will income',
    directorOfOperations: '−5% all resource income',
    securityDirector: 'Security events cannot be auto-countered',
    signalAnalyst: '−10% signal decode progress',
  };
</script>

<div class="committee-panel">
  <h3 class="panel-title">COMMITTEE</h3>
  <div class="slots-grid">
    {#each ALL_ROLES as role}
      {@const member = board[role]}
      {@const active = member && member.leftTurn === null}
      {@const def = active ? boardDefs.get(member!.defId) : null}
      {@const candidate = !active ? candidateForRole(role) : null}
      {@const graceActive = !penaltiesActive}

      <div class="slot-card" class:occupied={active} class:vacant={!active}>
        <!-- Role header bar -->
        <div class="card-header">
          <span class="role-label">{ROLE_LABELS[role]}</span>
          {#if active && def}
            {@const disabledReason = dismissDisabledReason()}
            <button
              class="dismiss-btn"
              class:disabled={!!disabledReason}
              disabled={!!disabledReason || phase !== 'action'}
              title={disabledReason ?? `Dismiss — costs ${DISMISS_COST}W`}
              onclick={() => onDismiss(role)}
            >
              Dismiss
            </button>
          {:else}
            <span class="vacant-badge">VACANT</span>
          {/if}
        </div>

        <!-- Card body: portrait + info -->
        <div class="card-body">
          <!-- Portrait placeholder -->
          <div class="portrait" class:vacant-portrait={!active}>
            <span class="portrait-initials">{ROLE_INITIALS[role]}</span>
          </div>

          <!-- Member info or vacant info -->
          <div class="card-info">
            {#if active && def && member}
              <span class="member-name">{def.name}</span>
              <span class="member-age">age {member.age}</span>
              <div class="modifier-list">
                {#each def.buffs as buff}
                  <div class="modifier buff">+ {buff.description}</div>
                {/each}
                {#each def.debuffs as debuff}
                  <div class="modifier debuff">− {debuff.description}</div>
                {/each}
              </div>
            {:else}
              <!-- Vacant slot content -->
              {#if penaltiesActive}
                {#if VACANT_PENALTY_LABELS[role]}
                  <div class="penalty-line">VACANT — {VACANT_PENALTY_LABELS[role]}</div>
                {/if}
              {:else}
                <div class="grace-line">
                  Grace period — penalty begins turn {gracePeriodEnds + 1}
                </div>
              {/if}

              {#if candidate}
                {@const disabledReason = recruitDisabledReason(candidate)}
                <button
                  class="recruit-btn"
                  class:disabled={!!disabledReason}
                  disabled={!!disabledReason}
                  title={disabledReason ?? `Recruit — costs 1 action`}
                  onclick={() => onRecruit(candidate.id)}
                >
                  Recruit
                </button>
                <div class="recruit-cost">
                  1 action · {candidate.recruitCost.funding}F · {candidate.recruitCost.politicalWill}W
                </div>
              {:else}
                <div class="no-candidate">No candidate available</div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .committee-panel {
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

  .slots-grid {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #1a2a38 transparent;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.5rem;
    align-content: start;
  }

  @media (max-width: 480px) {
    .slots-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ---- Slot card ---- */

  .slot-card {
    background: #080f1a;
    border: 1px solid #0e1820;
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .slot-card.vacant {
    border-color: #0e1a22;
  }

  /* ---- Header bar ---- */

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.5rem;
    background: #1e2a3a;
    gap: 0.3rem;
  }

  .role-label {
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    color: #7ab4d8;
    text-transform: uppercase;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vacant-badge {
    font-size: 0.48rem;
    letter-spacing: 0.1em;
    background: #f59e0b;
    color: #000;
    padding: 0.1rem 0.35rem;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .dismiss-btn {
    font-size: 0.5rem;
    font-family: inherit;
    letter-spacing: 0.08em;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .dismiss-btn:hover:not(.disabled) {
    color: #ef4444;
    background: #1a0808;
  }

  .dismiss-btn.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* ---- Card body ---- */

  .card-body {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    flex: 1;
  }

  /* ---- Portrait ---- */

  .portrait {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 3px;
    background: #1a2a3a;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait.vacant-portrait {
    background: #0a1420;
    border: 1.5px dashed #475569;
  }

  .portrait-initials {
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    color: #2e4a5a;
  }

  .vacant-portrait .portrait-initials {
    color: #2a3a48;
  }

  /* ---- Info column ---- */

  .card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .member-name {
    font-size: 0.65rem;
    font-weight: 600;
    color: #7ab4d8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-age {
    font-size: 0.5rem;
    color: #2e4a5a;
    margin-top: -0.15rem;
  }

  .modifier-list {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-top: 0.15rem;
  }

  .modifier {
    font-size: 0.55rem;
    line-height: 1.35;
    padding-left: 0.2rem;
  }

  .buff {
    color: #4ade80;
    border-left: 2px solid #166534;
  }

  .debuff {
    color: #f59e0b;
    border-left: 2px solid #78350f;
  }

  /* ---- Vacant info ---- */

  .penalty-line {
    font-size: 0.55rem;
    color: #f59e0b;
    line-height: 1.35;
    padding-left: 0.2rem;
    border-left: 2px solid #78350f;
  }

  .grace-line {
    font-size: 0.52rem;
    color: #94a3b8;
    line-height: 1.35;
  }

  .no-candidate {
    font-size: 0.55rem;
    color: #2e4458;
    font-style: italic;
  }

  .recruit-btn {
    margin-top: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.58rem;
    font-family: inherit;
    letter-spacing: 0.08em;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid #1a5030;
    background: #0a2e1a;
    color: #5ad486;
    align-self: flex-start;
  }

  .recruit-btn:hover:not(.disabled) {
    background: #0f4024;
  }

  .recruit-btn.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .recruit-cost {
    font-size: 0.5rem;
    color: #2e4a5a;
    margin-top: 0.1rem;
  }
</style>
