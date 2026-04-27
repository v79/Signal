<script lang="ts">
  import type { ProjectDef, ProjectReward, OngoingProjectReward, ProjectType, ResearchField } from '../../engine/types';
  import { turnToYear } from '../../engine/projects';

  let {
    completedProjectIds,
    projectDefs,
  }: {
    completedProjectIds: Record<string, number>;
    projectDefs: Map<string, ProjectDef>;
  } = $props();

  // ---------------------------------------------------------------------------
  // Build display entries — one per single-stage project or per completed group
  // ---------------------------------------------------------------------------

  type DisplayEntry = {
    id: string;
    name: string;
    description: string;
    type: ProjectType;
    oneOffReward: ProjectReward;
    ongoingReward?: OngoingProjectReward;
    era: string;
    completedYear: number;
  };

  const TYPE_GLYPH: Record<ProjectType, string> = {
    scientific: '!',
    landmark: '=',
    contract: '¤',
  };

  const entries = $derived((): DisplayEntry[] => {
    const result: DisplayEntry[] = [];
    const seenGroups = new Set<string>();

    for (const def of projectDefs.values()) {
      if (def.groupId) {
        if (seenGroups.has(def.groupId)) continue;
        seenGroups.add(def.groupId);

        const stageDefs = [...projectDefs.values()].filter((d) => d.groupId === def.groupId);
        const allComplete = stageDefs.every((d) => d.id in completedProjectIds);
        if (!allComplete) continue;

        // Aggregate one-off rewards across all stages
        const combined: ProjectReward = {};
        const combinedOngoing: OngoingProjectReward = {};
        for (const stage of stageDefs) {
          const r = stage.oneOffReward;
          if (r?.signalProgress) combined.signalProgress = (combined.signalProgress ?? 0) + r.signalProgress;
          if (r?.resources) {
            if (!combined.resources) combined.resources = {};
            for (const [k, v] of Object.entries(r.resources)) {
              const key = k as keyof typeof combined.resources;
              combined.resources[key] = (combined.resources[key] ?? 0) + (v ?? 0);
            }
          }
          if (r?.fields) {
            if (!combined.fields) combined.fields = {};
            for (const [k, v] of Object.entries(r.fields)) {
              const key = k as ResearchField;
              (combined.fields as Record<string, number>)[key] =
                ((combined.fields as Record<string, number>)[key] ?? 0) + (v ?? 0);
            }
          }
          if (r?.unlocksCards?.length) {
            if (!combined.unlocksCards) combined.unlocksCards = [];
            combined.unlocksCards.push(...r.unlocksCards);
          }
          const o = stage.ongoingReward;
          if (o?.fields) {
            if (!combinedOngoing.fields) combinedOngoing.fields = {};
            for (const [k, v] of Object.entries(o.fields)) {
              const key = k as ResearchField;
              (combinedOngoing.fields as Record<string, number>)[key] =
                ((combinedOngoing.fields as Record<string, number>)[key] ?? 0) + (v ?? 0);
            }
          }
          if (o?.resources) {
            if (!combinedOngoing.resources) combinedOngoing.resources = {};
            for (const [k, v] of Object.entries(o.resources)) {
              const key = k as keyof typeof combinedOngoing.resources;
              combinedOngoing.resources[key] = (combinedOngoing.resources[key] ?? 0) + (v ?? 0);
            }
          }
        }

        const latestTurn = Math.max(...stageDefs.map((d) => completedProjectIds[d.id] ?? 0));
        result.push({
          id: def.groupId,
          name: def.groupName ?? def.groupId,
          description: stageDefs[stageDefs.length - 1].description,
          type: def.type,
          oneOffReward: combined,
          ongoingReward: Object.keys(combinedOngoing).length > 0 ? combinedOngoing : undefined,
          era: def.era,
          completedYear: turnToYear(latestTurn),
        });
      } else {
        if (!(def.id in completedProjectIds)) continue;
        result.push({
          id: def.id,
          name: def.name,
          description: def.description,
          type: def.type,
          oneOffReward: def.oneOffReward ?? {},
          ongoingReward: def.ongoingReward,
          era: def.era,
          completedYear: turnToYear(completedProjectIds[def.id] ?? 0),
        });
      }
    }

    return result;
  });

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  const FIELD_LABELS: Record<string, string> = {
    physics: 'PHY',
    mathematics: 'MAT',
    engineering: 'ENG',
    biochemistry: 'BIO',
    computing: 'COM',
    socialScience: 'SOC',
  };

  const ERA_LABELS: Record<string, string> = {
    earth: 'ERA 1',
    nearSpace: 'ERA 2',
    deepSpace: 'ERA 3',
  };
</script>

<div class="panel-header">COMPLETED PROJECTS</div>
<div class="panel">
  {#if entries().length === 0}
    <div class="empty-state">No projects completed yet.</div>
  {:else}
    <div class="grid">
      {#each entries() as entry (entry.id)}
        <div class="project-card">
          <div class="card-top">
            <div class="image-placeholder">
              <span class="image-glyph" title={entry.type}>{TYPE_GLYPH[entry.type]}</span>
            </div>
            <div class="card-info">
              <div class="project-name">{entry.name}</div>
              <div class="era-badge">{ERA_LABELS[entry.era] ?? entry.era} · {entry.completedYear}</div>
            </div>
          </div>
          <div class="reward-row">
            {#if entry.oneOffReward.signalProgress}
              <span class="chip signal">+{entry.oneOffReward.signalProgress} SIG</span>
            {/if}
            {#if entry.oneOffReward.resources?.funding}
              <span class="chip funding">+{entry.oneOffReward.resources.funding}F</span>
            {/if}
            {#if entry.oneOffReward.resources?.materials}
              <span class="chip materials">+{entry.oneOffReward.resources.materials}M</span>
            {/if}
            {#if entry.oneOffReward.resources?.politicalWill}
              <span class="chip will">+{entry.oneOffReward.resources.politicalWill}W</span>
            {/if}
            {#if entry.oneOffReward.fields}
              {#each Object.entries(entry.oneOffReward.fields) as [field, pts]}
                {#if pts}
                  <span class="chip field">{FIELD_LABELS[field] ?? field} +{pts}</span>
                {/if}
              {/each}
            {/if}
            {#if entry.oneOffReward.unlocksCards?.length}
              <span class="chip card">{entry.oneOffReward.unlocksCards.length} card{entry.oneOffReward.unlocksCards.length === 1 ? '' : 's'}</span>
            {/if}
            {#if entry.ongoingReward?.fields}
              {#each Object.entries(entry.ongoingReward.fields) as [field, pts]}
                {#if pts}
                  <span class="chip ongoing">{FIELD_LABELS[field] ?? field} +{pts}/t</span>
                {/if}
              {/each}
            {/if}
            {#if entry.ongoingReward?.resources?.funding}
              <span class="chip ongoing">+{entry.ongoingReward.resources.funding}F/t</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel-header {
    font-size: var(--fs-sm);
    letter-spacing: var(--ls-wider);
    color: var(--text-dim);
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--border-panel);
    flex-shrink: 0;
  }

  .panel {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    min-height: 0;
  }

  .empty-state {
    font-size: var(--fs-base);
    color: #3a5070;
    text-align: center;
    padding: 2rem 0;
    letter-spacing: 0.06em;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .project-card {
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-top {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .image-placeholder {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: var(--surface-2);
    border: 1px solid #1e2f42;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-glyph {
    font-size: 1.2rem;
    color: #2a4a6a;
  }

  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .project-name {
    font-size: var(--fs-base);
    color: #a0c8e8;
    line-height: 1.3;
  }

  .era-badge {
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    color: #2a5070;
  }

  .reward-row {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .chip {
    font-size: 0.52rem;
    letter-spacing: 0.06em;
    padding: 1px 4px;
    border-radius: 1px;
  }

  .chip.signal {
    background: #0a1a2a;
    color: #4a9bd8;
    border: 1px solid #1a4060;
  }

  .chip.funding {
    background: #0a1822;
    color: #4a9bd8;
    border: 1px solid #1a3a50;
  }

  .chip.materials {
    background: #0a1a0f;
    color: #4ab870;
    border: 1px solid #1a4a20;
  }

  .chip.will {
    background: #180a2a;
    color: #9060d0;
    border: 1px solid #3a1a60;
  }

  .chip.field {
    background: #1a1208;
    color: #c09040;
    border: 1px solid #4a3010;
  }

  .chip.card {
    background: #1a0a18;
    color: #b060a0;
    border: 1px solid #4a1a40;
  }

  .chip.ongoing {
    background: #0a1a12;
    color: #50c878;
    border: 1px solid #1a4a28;
  }
</style>
