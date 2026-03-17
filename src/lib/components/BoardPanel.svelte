<script lang="ts">
  import type {
    BoardSlots,
    BoardMemberDef,
    BoardRole,
    TurnPhase,
    Resources,
    CommitteeNotification,
  } from '../../engine/types';

  const ALL_ROLES: BoardRole[] = [
    'chiefScientist',
    'directorOfEngineering',
    'headOfFinance',
    'politicalLiaison',
    'directorOfOperations',
    'securityDirector',
    'signalAnalyst',
    'stationCommander',
  ];

  const ROLE_LABELS: Record<BoardRole, string> = {
    chiefScientist: 'Chief Scientist',
    directorOfEngineering: 'Dir. Engineering',
    headOfFinance: 'Head of Finance',
    politicalLiaison: 'Political Liaison',
    directorOfOperations: 'Dir. Operations',
    securityDirector: 'Security Director',
    signalAnalyst: 'Signal Analyst',
    stationCommander: 'Station Commander',
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
    stationCommander: 'SC',
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
    discoveredTechIds = [],
    committeeNotifications = [],
    onRecruit,
    onDismiss,
    onResolveNotification,
    onDismissNotification,
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
    /** Tech def IDs that have been discovered this run (for tech-gate filtering). */
    discoveredTechIds?: string[];
    /** Active committee notifications to display on member cards. */
    committeeNotifications?: CommitteeNotification[];
    onRecruit: (defId: string) => void;
    onDismiss: (role: BoardRole) => void;
    onResolveNotification?: (id: string, choiceIndex: number) => void;
    onDismissNotification?: (id: string) => void;
  } = $props();

  /** The next available candidate for this role, or null.
   * Skips anyone currently active on the board (already recruited).
   * AI members are only available in Era 3 (deepSpace).
   * Tech-gated candidates are filtered out until the required tech is discovered.
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
      if (def.techGate && !discoveredTechIds.includes(def.techGate)) return false;
      if (activeDefIds.has(id)) return false;
      return true;
    });
    return defId ? (boardDefs.get(defId) ?? null) : null;
  }

  /**
   * Return the tech gate label for the first gated candidate in the pool for
   * this role, if no ungated candidate is available. Used to display a
   * "requires X tech" message on vacant slots.
   */
  function techGateLabelForRole(role: BoardRole): string | null {
    const activeDefIds = new Set(
      Object.values(board)
        .filter((m): m is NonNullable<typeof m> => !!m && m.leftTurn === null)
        .map((m) => m.defId),
    );
    const gatedDef = availableBoardDefIds
      .map((id) => boardDefs.get(id))
      .find((def) => {
        if (!def || def.role !== role) return false;
        if (def.isAI && era !== 'deepSpace') return false;
        if (!def.techGate) return false;
        if (discoveredTechIds.includes(def.techGate)) return false;
        if (activeDefIds.has(def.id)) return false;
        return true;
      });
    return gatedDef?.techGate ?? null;
  }

  /** Active (non-dismissed) notifications for a given member defId. */
  function notificationsForMember(memberDefId: string): CommitteeNotification[] {
    return (committeeNotifications ?? []).filter(
      (n) => n.memberDefId === memberDefId && !n.dismissed,
    );
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
    stationCommander: '+10% Near Space launch costs',
  };

  const visibleRoles = $derived(
    era !== 'earth' ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'stationCommander'),
  );
</script>

<div class="committee-panel">
  <h3 class="panel-title">COMMITTEE</h3>
  <div class="slots-grid">
    {#each visibleRoles as role}
      {@const member = board[role]}
      {@const active = member && member.leftTurn === null}
      {@const def = active ? boardDefs.get(member!.defId) : null}
      {@const candidate = !active ? candidateForRole(role) : null}
      {@const memberNotifications = active && def ? notificationsForMember(def.id) : []}
      {@const hasNotifications = memberNotifications.length > 0}

      <div class="slot-card" class:occupied={active} class:vacant={!active}>
        <!-- Role header bar -->
        <div class="card-header">
          <span class="role-label">{ROLE_LABELS[role]}</span>
          {#if active && def}
            {#if hasNotifications}
              <span class="notification-badge" title="{memberNotifications.length} notification{memberNotifications.length > 1 ? 's' : ''}">
                {memberNotifications.length}
              </span>
            {/if}
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
                {@const gateLabel = techGateLabelForRole(role)}
                {#if gateLabel}
                  <div class="no-candidate tech-gated">No candidate available<br><span class="tech-gate-hint">Requires: {gateLabel}</span></div>
                {:else}
                  <div class="no-candidate">No candidate available</div>
                {/if}
              {/if}
            {/if}
          </div>
        </div>

        <!-- Inline notifications (active member only) -->
        {#if hasNotifications}
          <div class="notifications-section">
            {#each memberNotifications as notification}
              <div class="notification-item">
                <p class="notification-text">{notification.text}</p>
                {#if notification.choices && notification.choices.length > 0}
                  <div class="notification-choices">
                    {#each notification.choices as choice, i}
                      <button
                        class="choice-btn"
                        onclick={() => onResolveNotification?.(notification.id, i)}
                      >
                        {choice.label}
                      </button>
                    {/each}
                    <button
                      class="dismiss-notification-btn"
                      onclick={() => onDismissNotification?.(notification.id)}
                    >
                      Ignore
                    </button>
                  </div>
                {:else}
                  <button
                    class="dismiss-notification-btn"
                    onclick={() => onDismissNotification?.(notification.id)}
                  >
                    Dismiss
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
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

  .tech-gated {
    line-height: 1.5;
  }

  .tech-gate-hint {
    font-size: 0.5rem;
    color: #3a5a6a;
    font-style: normal;
  }

  /* ---- Notification badge on header ---- */

  .notification-badge {
    font-size: 0.48rem;
    background: #3b82f6;
    color: #fff;
    border-radius: 50%;
    width: 1.1rem;
    height: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 700;
    letter-spacing: 0;
  }

  /* ---- Inline notifications section ---- */

  .notifications-section {
    border-top: 1px solid #0e1820;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem 0.5rem;
    background: #06101a;
  }

  .notification-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .notification-text {
    font-size: 0.55rem;
    color: #7ab4d8;
    line-height: 1.45;
    margin: 0;
  }

  .notification-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.1rem;
  }

  .choice-btn {
    padding: 0.2rem 0.45rem;
    font-size: 0.52rem;
    font-family: inherit;
    letter-spacing: 0.06em;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid #1a5030;
    background: #0a2e1a;
    color: #5ad486;
  }

  .choice-btn:hover {
    background: #0f4024;
  }

  .dismiss-notification-btn {
    padding: 0.2rem 0.45rem;
    font-size: 0.52rem;
    font-family: inherit;
    letter-spacing: 0.06em;
    border-radius: 2px;
    cursor: pointer;
    border: none;
    background: none;
    color: #475569;
    align-self: flex-start;
  }

  .dismiss-notification-btn:hover {
    color: #94a3b8;
  }
</style>
