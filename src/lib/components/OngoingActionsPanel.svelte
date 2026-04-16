<script lang="ts">
  import type { OngoingAction, ProjectDef, ProjectInstance } from '../../engine/types';
  import type { FacilityDef } from '../../engine/types';

  let {
    queue,
    facilityDefs,
    availableProjects = [],
    activeProjects = [],
    projectDefs = new Map(),
    completedProjectIds = [],
    actionsRemaining = 0,
    onInitiateProject,
  }: {
    queue: OngoingAction[];
    facilityDefs: Map<string, FacilityDef>;
    availableProjects?: ProjectDef[];
    activeProjects?: ProjectInstance[];
    projectDefs?: Map<string, ProjectDef>;
    completedProjectIds?: string[];
    actionsRemaining?: number;
    onInitiateProject?: (defId: string) => void;
  } = $props();

  // ---------------------------------------------------------------------------
  // Group logic — generic, driven by groupId on ProjectDef
  // ---------------------------------------------------------------------------

  type GroupEntry = { groupId: string; groupName: string; defs: ProjectDef[] };

  /**
   * Build an ordered list of visible project groups. A group is visible when
   * at least one of its members is active, available, or completed.
   * Defs within each group are sorted by their appearance order in projectDefs.
   */
  const visibleGroups = $derived((): GroupEntry[] => {
    const activeDefIds = new Set(activeProjects.map((p) => p.defId));
    const completedSet = new Set(completedProjectIds);
    const availableSet = new Set(availableProjects.map((d) => d.id));

    const groupMap = new Map<string, GroupEntry>();
    for (const def of projectDefs.values()) {
      if (!def.groupId) continue;
      if (!groupMap.has(def.groupId)) {
        groupMap.set(def.groupId, {
          groupId: def.groupId,
          groupName: def.groupName ?? def.groupId,
          defs: [],
        });
      }
      groupMap.get(def.groupId)!.defs.push(def);
    }

    return [...groupMap.values()].filter(({ defs }) => {
      // Hide groups where every stage is already complete — they move to the PROJECTS tab
      if (defs.every((d) => completedSet.has(d.id))) return false;
      return defs.some(
        (d) => activeDefIds.has(d.id) || completedSet.has(d.id) || availableSet.has(d.id),
      );
    });
  });

  /** Available projects that don't belong to any group. */
  const ungroupedAvailable = $derived(availableProjects.filter((d) => !d.groupId));

  /** Active projects that don't belong to any group. */
  const ungroupedActive = $derived(activeProjects.filter((p) => !projectDefs.get(p.defId)?.groupId));

  function groupMemberStatus(
    defId: string,
  ): 'completed' | 'active' | 'available' | 'locked' {
    if (completedProjectIds.includes(defId)) return 'completed';
    if (activeProjects.some((p) => p.defId === defId)) return 'active';
    if (availableProjects.some((d) => d.id === defId)) return 'available';
    return 'locked';
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  let expandedProjectId = $state<string | null>(null);

  function toggleExpand(id: string) {
    expandedProjectId = expandedProjectId === id ? null : id;
  }

  function rewardSummary(def: ProjectDef): string {
    const parts: string[] = [];
    if (def.reward.signalProgress) parts.push(`+${def.reward.signalProgress} signal`);
    if (def.reward.resources?.funding) parts.push(`+${def.reward.resources.funding}F`);
    if (def.reward.resources?.materials) parts.push(`+${def.reward.resources.materials}M`);
    if (def.reward.resources?.politicalWill) parts.push(`+${def.reward.resources.politicalWill}W`);
    if (def.reward.unlocksCards?.length) parts.push(`${def.reward.unlocksCards.length} card(s)`);
    return parts.join(', ');
  }

  function costSummary(def: ProjectDef): string {
    const parts: string[] = [];
    if (def.cost.funding) parts.push(`${def.cost.funding}F`);
    if (def.cost.materials) parts.push(`${def.cost.materials}M`);
    if (def.cost.politicalWill) parts.push(`${def.cost.politicalWill}W`);
    return parts.join(' · ');
  }

  function upkeepSummary(def: ProjectDef): string {
    const parts: string[] = [];
    if (def.upkeepCost.funding) parts.push(`${def.upkeepCost.funding}F`);
    if (def.upkeepCost.materials) parts.push(`${def.upkeepCost.materials}M`);
    return parts.length ? `${parts.join(' · ')}/turn` : '';
  }

  const hasAnything = $derived(
    queue.length > 0 ||
      activeProjects.length > 0 ||
      availableProjects.length > 0 ||
      visibleGroups().length > 0,
  );
</script>

{#if hasAnything}
  <div class="panel">

    <!-- Construction queue -->
    {#if queue.length > 0}
      <div class="section-header">ONGOING</div>
      {#each queue as action (action.id)}
        {@const def = facilityDefs.get(action.facilityDefId)}
        {@const progress = (action.totalTurns - action.turnsRemaining) / action.totalTurns}
        <div class="action-row">
          <span
            class="badge"
            class:build={action.type === 'construct'}
            class:demo={action.type === 'demolish'}
          >
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
    {/if}

    <!-- Active projects (ungrouped only — grouped ones shown in their group section) -->
    {#if ungroupedActive.length > 0}
      <div class="section-header">PROJECTS IN PROGRESS</div>
      {#each ungroupedActive as proj (proj.id)}
        {@const def = projectDefs.get(proj.defId)}
        {@const progress = proj.turnsElapsed / proj.effectiveDuration}
        {@const remaining = proj.effectiveDuration - proj.turnsElapsed}
        <div class="action-row">
          <span class="badge project">PROJ</span>
          <div class="action-body">
            <div class="action-name">{def?.name ?? proj.defId}</div>
            <div class="progress-track">
              <div class="progress-fill project-fill" style="width: {Math.round(progress * 100)}%"></div>
            </div>
            <div class="turns-left">
              {remaining} turn{remaining === 1 ? '' : 's'} remaining
              {#if def && upkeepSummary(def)}
                · upkeep {upkeepSummary(def)}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}

    <!-- Project groups (e.g. Orbital Station Programme) -->
    {#each visibleGroups() as group (group.groupId)}
      <div class="section-header">{group.groupName}</div>
      {#each group.defs as def (def.id)}
        {@const status = groupMemberStatus(def.id)}
        {@const activeInst = activeProjects.find((p) => p.defId === def.id)}
        <div
          class="stage-row"
          class:stage-completed={status === 'completed'}
          class:stage-active={status === 'active'}
          class:stage-locked={status === 'locked'}
        >
          <div class="stage-header">
            <span class="stage-name">{def.name}</span>
            {#if status === 'completed'}
              <span class="stage-badge done">✓</span>
            {:else if status === 'active'}
              <span class="stage-badge active">IN PROGRESS</span>
            {:else if status === 'available'}
              <span class="stage-badge available">READY</span>
            {:else}
              <span class="stage-badge locked">LOCKED</span>
            {/if}
          </div>
          {#if status === 'active' && activeInst}
            {@const progress = activeInst.turnsElapsed / activeInst.effectiveDuration}
            {@const remaining = activeInst.effectiveDuration - activeInst.turnsElapsed}
            <div class="progress-track">
              <div class="progress-fill project-fill" style="width: {Math.round(progress * 100)}%"></div>
            </div>
            <div class="turns-left">{remaining} turn{remaining === 1 ? '' : 's'} remaining</div>
          {:else if status === 'available'}
            <div class="stage-cost">{costSummary(def)}</div>
            <button
              class="initiate-btn"
              disabled={actionsRemaining <= 0}
              title={actionsRemaining <= 0 ? 'No actions remaining this turn' : `Initiate: ${costSummary(def)}`}
              onclick={() => onInitiateProject?.(def.id)}
            >
              BEGIN · {costSummary(def)}
            </button>
          {/if}
        </div>
      {/each}
    {/each}

    <!-- Available projects (ungrouped) -->
    {#if ungroupedAvailable.length > 0}
      <div class="section-header">AVAILABLE PROJECTS</div>
      {#each ungroupedAvailable as def (def.id)}
        <div class="project-card" class:expanded={expandedProjectId === def.id}>
          <button class="project-header" onclick={() => toggleExpand(def.id)}>
            <span class="project-name">{def.name}</span>
            <span class="project-cost">{costSummary(def)}</span>
            <span class="expand-arrow" class:open={expandedProjectId === def.id}>▸</span>
          </button>
          {#if expandedProjectId === def.id}
            <div class="project-details">
              <div class="project-desc">{def.description}</div>
              <div class="project-meta">
                <span>Duration: {def.baseDuration} turn{def.baseDuration === 1 ? '' : 's'}</span>
                {#if upkeepSummary(def)}
                  <span>Upkeep: {upkeepSummary(def)}</span>
                {/if}
                {#if rewardSummary(def)}
                  <span class="reward-line">Reward: {rewardSummary(def)}</span>
                {/if}
              </div>
              <button
                class="initiate-btn"
                disabled={actionsRemaining <= 0}
                title={actionsRemaining <= 0 ? 'No actions remaining this turn' : `Initiate: ${costSummary(def)}`}
                onclick={() => onInitiateProject?.(def.id)}
              >
                INITIATE · {costSummary(def)}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}

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

  .section-header {
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    color: #3a5060;
    margin-top: 0.2rem;
    margin-bottom: 0.1rem;
  }

  .section-header:first-child {
    margin-top: 0;
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

  .badge.project {
    background: #0a2818;
    color: #4ab870;
    border: 1px solid #1a6030;
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

  .project-fill {
    background: #2a7050;
  }

  .action-row:has(.demo) .progress-fill {
    background: #802020;
  }

  .turns-left {
    font-size: 0.58rem;
    color: #3a5060;
  }

  /* Project group (stage tracker) */
  .stage-row {
    border: 1px solid #1a3050;
    border-radius: 2px;
    padding: 0.3rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: #080f18;
  }

  .stage-row.stage-completed {
    border-color: #1a4030;
    opacity: 0.7;
  }

  .stage-row.stage-active {
    border-color: #2a5080;
  }

  .stage-row.stage-locked {
    opacity: 0.45;
  }

  .stage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stage-name {
    font-size: 0.63rem;
    color: #8aaabb;
  }

  .stage-badge {
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.3rem;
    border-radius: 1px;
  }

  .stage-badge.done {
    color: #4ab870;
    background: #0a1a10;
    border: 1px solid #1a5030;
  }

  .stage-badge.active {
    color: #4a9bd8;
    background: #081828;
    border: 1px solid #2a5080;
  }

  .stage-badge.available {
    color: #8a8a4a;
    background: #181808;
    border: 1px solid #504010;
  }

  .stage-badge.locked {
    color: #3a4050;
    background: #080c10;
    border: 1px solid #1a2030;
  }

  .stage-cost {
    font-size: 0.58rem;
    color: #4a7060;
  }

  /* Available project cards */
  .project-card {
    border: 1px solid #1a2830;
    border-radius: 2px;
    overflow: hidden;
  }

  .project-card.expanded {
    border-color: #1a4030;
  }

  .project-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.4rem;
    background: #0a1820;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .project-header:hover {
    background: #0f2030;
  }

  .project-name {
    flex: 1;
    font-size: 0.65rem;
    color: #8aaabb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-cost {
    font-size: 0.6rem;
    color: #4a8070;
    flex-shrink: 0;
  }

  .expand-arrow {
    font-size: 0.55rem;
    color: #3a5060;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .expand-arrow.open {
    transform: rotate(90deg);
  }

  .project-details {
    padding: 0.35rem 0.5rem 0.4rem;
    background: #080f18;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .project-desc {
    font-size: 0.6rem;
    color: #607080;
    line-height: 1.4;
  }

  .project-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .project-meta span {
    font-size: 0.58rem;
    color: #3a5060;
  }

  .reward-line {
    color: #3a7050 !important;
  }

  .initiate-btn {
    align-self: flex-start;
    margin-top: 0.1rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    background: #0a2818;
    color: #4ab870;
    border: 1px solid #1a5030;
    border-radius: 1px;
    cursor: pointer;
  }

  .initiate-btn:hover:not(:disabled) {
    background: #0f3820;
    border-color: #2a7050;
  }

  .initiate-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
