<script lang="ts">
  import type { ProjectDef, ProjectReward, ResearchField } from '../../engine/types';
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
    reward: ProjectReward;
    era: string;
    completedYear: number;
  };

  const entries = $derived((): DisplayEntry[] => {
    const result: DisplayEntry[] = [];
    const seenGroups = new Set<string>();

    for (const def of projectDefs.values()) {
      if (def.groupId) {
        if (seenGroups.has(def.groupId)) continue;
        seenGroups.add(def.groupId);

        // Collect all stages in this group
        const stageDefs = [...projectDefs.values()].filter((d) => d.groupId === def.groupId);
        const allComplete = stageDefs.every((d) => d.id in completedProjectIds);
        if (!allComplete) continue;

        // Aggregate rewards across all stages
        const combined: ProjectReward = {};
        for (const stage of stageDefs) {
          if (stage.reward.signalProgress) {
            combined.signalProgress = (combined.signalProgress ?? 0) + stage.reward.signalProgress;
          }
          if (stage.reward.resources) {
            if (!combined.resources) combined.resources = {};
            for (const [k, v] of Object.entries(stage.reward.resources)) {
              const key = k as keyof typeof combined.resources;
              combined.resources[key] = (combined.resources[key] ?? 0) + (v ?? 0);
            }
          }
          if (stage.reward.fields) {
            if (!combined.fields) combined.fields = {};
            for (const [k, v] of Object.entries(stage.reward.fields)) {
              const key = k as ResearchField;
              (combined.fields as Record<string, number>)[key] =
                ((combined.fields as Record<string, number>)[key] ?? 0) + (v ?? 0);
            }
          }
          if (stage.reward.unlocksCards?.length) {
            if (!combined.unlocksCards) combined.unlocksCards = [];
            combined.unlocksCards.push(...stage.reward.unlocksCards);
          }
        }

        const latestTurn = Math.max(...stageDefs.map((d) => completedProjectIds[d.id] ?? 0));
        result.push({
          id: def.groupId,
          name: def.groupName ?? def.groupId,
          description: stageDefs[stageDefs.length - 1].description,
          reward: combined,
          era: def.era,
          completedYear: turnToYear(latestTurn),
        });
      } else {
        if (!(def.id in completedProjectIds)) continue;
        result.push({
          id: def.id,
          name: def.name,
          description: def.description,
          reward: def.reward,
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
              <span class="image-glyph">◈</span>
            </div>
            <div class="card-info">
              <div class="project-name">{entry.name}</div>
              <div class="era-badge">{ERA_LABELS[entry.era] ?? entry.era} · {entry.completedYear}</div>
            </div>
          </div>
          <div class="reward-row">
            {#if entry.reward.signalProgress}
              <span class="chip signal">+{entry.reward.signalProgress} SIG</span>
            {/if}
            {#if entry.reward.resources?.funding}
              <span class="chip funding">+{entry.reward.resources.funding}F</span>
            {/if}
            {#if entry.reward.resources?.materials}
              <span class="chip materials">+{entry.reward.resources.materials}M</span>
            {/if}
            {#if entry.reward.resources?.politicalWill}
              <span class="chip will">+{entry.reward.resources.politicalWill}W</span>
            {/if}
            {#if entry.reward.fields}
              {#each Object.entries(entry.reward.fields) as [field, pts]}
                {#if pts}
                  <span class="chip field">{FIELD_LABELS[field] ?? field} +{pts}</span>
                {/if}
              {/each}
            {/if}
            {#if entry.reward.unlocksCards?.length}
              <span class="chip card">{entry.reward.unlocksCards.length} card{entry.reward.unlocksCards.length === 1 ? '' : 's'}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel-header {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    color: #4a6080;
    padding: 8px 12px 6px;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .panel {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    min-height: 0;
  }

  .empty-state {
    font-size: 0.65rem;
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
    background: #0a0f18;
    border: 1px solid #1a2535;
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
    background: #0d1520;
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
    font-size: 0.65rem;
    color: #a0c8e8;
    line-height: 1.3;
  }

  .era-badge {
    font-size: 0.55rem;
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
</style>
