<script lang="ts">
  import type { TechState, TechDef, FieldPoints } from '../../engine/types';
  import { FIELD_COLOURS_CSS, FIELD_ABBR } from '../fieldColours';

  let {
    techs = [],
    techDefs = new Map(),
  }: {
    techs?: TechState[];
    techDefs?: Map<string, TechDef>;
  } = $props();

  // Sort in-progress techs by overall completion (closest to discovered first)
  function completionFraction(tech: TechState): number {
    if (!tech.recipe) return 0;
    const entries = Object.entries(tech.recipe) as [keyof FieldPoints, number][];
    if (entries.length === 0) return 1;
    const sum = entries.reduce((acc, [f, t]) => {
      return acc + Math.min(1, (tech.fieldProgress[f] ?? 0) / t);
    }, 0);
    return sum / entries.length;
  }

  const progressTechs = $derived(
    techs
      .filter((t) => t.stage === 'progress')
      .sort((a, b) => completionFraction(b) - completionFraction(a))
      .slice(0, 3),
  );
</script>

<div class="summary">
  {#if progressTechs.length === 0}
    <p class="empty">No research in progress.</p>
  {:else}
    {#each progressTechs as tech (tech.defId)}
      {@const def = techDefs.get(tech.defId)}
      {#if def}
        {@const recipe = tech.recipe ?? def.baseRecipe}
        <div class="tech-card">
          <span class="tech-name">{def.name}</span>
          <div class="bars">
            {#each Object.entries(recipe) as [field, threshold]}
              {#if threshold}
                {@const pct = Math.min(100, ((tech.fieldProgress[field as keyof FieldPoints] ?? 0) / threshold) * 100)}
                {@const color = FIELD_COLOURS_CSS[field as keyof FieldPoints] ?? '#4a6880'}
                <div class="bar-row">
                  <span class="abbr" style="color: {color}">{FIELD_ABBR[field as keyof FieldPoints] ?? field.slice(0, 3).toUpperCase()}</span>
                  <div class="track">
                    <div class="fill" style="width: {pct}%; background: {color}"></div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
    overflow-y: auto;
    flex-shrink: 0;
    max-height: 10rem;
  }

  .empty {
    font-size: 0.62rem;
    color: #3a4a5a;
    margin: 0;
    padding: 0.4rem 0;
    letter-spacing: 0.05em;
  }

  .tech-card {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.45rem 0.5rem;
    background: #0a1018;
    border: 1px solid #1a2530;
    border-radius: 2px;
  }

  .tech-name {
    font-size: 0.65rem;
    color: #8ab8c8;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .abbr {
    font-size: 0.58rem;
    width: 2.2rem;
    flex-shrink: 0;
    letter-spacing: 0.06em;
  }

  .track {
    flex: 1;
    height: 4px;
    background: #131e28;
    border-radius: 2px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
  }
</style>
