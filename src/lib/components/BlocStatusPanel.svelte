<script lang="ts">
  import { slide } from 'svelte/transition';
  import { BLOC_DEFS } from '../../data/loader';
  import type { BlocState, FieldPoints } from '../../engine/types';
  import { FIELD_COLOURS_CSS, FIELD_ABBR } from '../fieldColours';

  let {
    blocs,
    playerBlocId,
  }: {
    blocs: BlocState[];
    playerBlocId: string;
  } = $props();

  const ERA_LABELS: Record<string, string> = {
    earth: 'E1',
    nearSpace: 'E2',
    deepSpace: 'E3',
  };

  const VICTORY_BIAS_LABELS: Record<string, string> = {
    wormhole:              'Wormhole',
    ecologicalRestoration: 'Ecological Restoration',
    economicHegemony:      'Economic Hegemony',
    terraforming:          'Terraforming',
    obstruction:           'Obstruction',
    wildcard:              'Wildcard',
  };

  const VICTORY_BIAS_COLOURS: Record<string, string> = {
    wormhole:              '#6a9fd8',
    ecologicalRestoration: '#58a870',
    economicHegemony:      '#c8a040',
    terraforming:          '#c87840',
    obstruction:           '#c86080',
    wildcard:              '#8a70c8',
  };

  const FIELD_ORDER: (keyof FieldPoints)[] = [
    'physics', 'mathematics', 'engineering', 'biochemistry', 'computing', 'socialScience',
  ];

  function willColor(will: number, ceiling: number): string {
    const pct = ceiling > 0 ? will / ceiling : 0;
    if (pct >= 0.6) return '#4a9b5a';
    if (pct >= 0.3) return '#c8a040';
    return '#c84040';
  }

  function willWidth(will: number, ceiling: number): string {
    const pct = ceiling > 0 ? Math.min(1, will / ceiling) : 0;
    return `${Math.round(pct * 100)}%`;
  }

  function scienceScore(fields: FieldPoints): number {
    return Math.round(
      fields.physics + fields.mathematics + fields.engineering +
      fields.biochemistry + fields.computing + fields.socialScience,
    );
  }

  let expandedBlocIds = $state<Set<string>>(new Set());

  function toggleExpanded(defId: string, eliminated: boolean): void {
    if (eliminated) return;
    const next = new Set(expandedBlocIds);
    next.has(defId) ? next.delete(defId) : next.add(defId);
    expandedBlocIds = next;
  }

  const playerBloc = $derived(blocs.find((b) => b.defId === playerBlocId) ?? null);

  const npcBlocs = $derived(
    blocs
      .filter((b) => b.defId !== playerBlocId)
      .sort((a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return 0;
      }),
  );
</script>

<div class="bloc-panel">
  <div class="panel-header">GEOPOLITICAL STATUS</div>

  <div class="bloc-list">
    <!-- Player's own bloc -->
    {#if playerBloc}
      {@const def = BLOC_DEFS.get(playerBloc.defId)}
      {#if def}
        <div
          class="bloc-row player-bloc"
          class:expanded={expandedBlocIds.has(playerBloc.defId)}
          onclick={() => toggleExpanded(playerBloc.defId, playerBloc.eliminated)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && toggleExpanded(playerBloc.defId, playerBloc.eliminated)}
        >
          <div class="bloc-name">
            {def.name}
            <span class="player-label">YOU</span>
            <span class="profile-badge" class:auth={def.willProfile === 'authoritarian'}>
              {def.willProfile === 'authoritarian' ? 'AUTH' : 'DEM'}
            </span>
          </div>
          <div class="bloc-stats">
            <div class="will-bar-wrap">
              <div class="will-bar-label">WILL</div>
              <div class="will-bar-track">
                <div
                  class="will-bar-fill"
                  style="width: {willWidth(playerBloc.will, def.willCeiling)}; background: {willColor(playerBloc.will, def.willCeiling)};"
                ></div>
              </div>
              <div class="will-value">{Math.round(playerBloc.will)}</div>
            </div>
            <div class="funding-stat">
              <span class="stat-label">F</span>
              <span class="stat-value">{Math.round(playerBloc.resources.funding)}</span>
            </div>
            <div class="era-badge">{ERA_LABELS[playerBloc.era] ?? playerBloc.era}</div>
          </div>

          {#if expandedBlocIds.has(playerBloc.defId)}
            <div class="bloc-detail" transition:slide={{ duration: 150 }}>
              <div class="detail-section">
                <div class="detail-label">OBJECTIVE</div>
                <div class="victory-bias-badge" style="color:{VICTORY_BIAS_COLOURS[def.victoryBias] ?? '#4a6080'}">
                  {VICTORY_BIAS_LABELS[def.victoryBias] ?? def.victoryBias}
                </div>
              </div>
              <div class="detail-row">
                <div class="detail-stat">
                  <span class="detail-stat-label">MAT</span>
                  <span class="detail-stat-value">{Math.round(playerBloc.resources.materials)}</span>
                </div>
                <div class="detail-stat">
                  <span class="detail-stat-label">SCI</span>
                  <span class="detail-stat-value">{scienceScore(playerBloc.fields)}</span>
                </div>
              </div>
              <div class="detail-section">
                <div class="detail-label">RESEARCH</div>
                <div class="fields-grid">
                  {#each FIELD_ORDER as field}
                    <div class="field-row">
                      <span class="field-abbr" style="color:{FIELD_COLOURS_CSS[field]}">{FIELD_ABBR[field]}</span>
                      <div class="field-track">
                        <div
                          class="field-fill"
                          style="width:{Math.min(100, (playerBloc.fields[field] / 150) * 100)}%; background:{FIELD_COLOURS_CSS[field]};"
                        ></div>
                      </div>
                      <span class="field-value">{Math.round(playerBloc.fields[field])}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <div class="separator"><span class="separator-label">OTHER BLOCS</span></div>

    <!-- NPC blocs -->
    {#each npcBlocs as bloc (bloc.defId)}
      {@const def = BLOC_DEFS.get(bloc.defId)}
      {#if def}
        <div
          class="bloc-row"
          class:eliminated={bloc.eliminated}
          class:expanded={expandedBlocIds.has(bloc.defId)}
          onclick={() => toggleExpanded(bloc.defId, bloc.eliminated)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && toggleExpanded(bloc.defId, bloc.eliminated)}
        >
          <div class="bloc-name">
            {def.name}
            <span class="profile-badge" class:auth={def.willProfile === 'authoritarian'}>
              {def.willProfile === 'authoritarian' ? 'AUTH' : 'DEM'}
            </span>
          </div>

          {#if bloc.eliminated}
            <div class="eliminated-label">DISSOLVED</div>
          {:else}
            <div class="bloc-stats">
              <div class="will-bar-wrap">
                <div class="will-bar-label">WILL</div>
                <div class="will-bar-track">
                  <div
                    class="will-bar-fill"
                    style="width: {willWidth(bloc.will, def.willCeiling)}; background: {willColor(bloc.will, def.willCeiling)};"
                  ></div>
                </div>
                <div class="will-value">{Math.round(bloc.will)}</div>
              </div>
              <div class="funding-stat">
                <span class="stat-label">F</span>
                <span class="stat-value">{Math.round(bloc.resources.funding)}</span>
              </div>
              <div class="era-badge">{ERA_LABELS[bloc.era] ?? bloc.era}</div>
            </div>
          {/if}

          {#if expandedBlocIds.has(bloc.defId)}
            <div class="bloc-detail" transition:slide={{ duration: 150 }}>
              <div class="detail-section">
                <div class="detail-label">OBJECTIVE</div>
                <div class="victory-bias-badge" style="color:{VICTORY_BIAS_COLOURS[def.victoryBias] ?? '#4a6080'}">
                  {VICTORY_BIAS_LABELS[def.victoryBias] ?? def.victoryBias}
                </div>
              </div>
              <div class="detail-row">
                <div class="detail-stat">
                  <span class="detail-stat-label">MAT</span>
                  <span class="detail-stat-value">{Math.round(bloc.resources.materials)}</span>
                </div>
                <div class="detail-stat">
                  <span class="detail-stat-label">SCI</span>
                  <span class="detail-stat-value">{scienceScore(bloc.fields)}</span>
                </div>
              </div>
              <div class="detail-section">
                <div class="detail-label">RESEARCH</div>
                <div class="fields-grid">
                  {#each FIELD_ORDER as field}
                    <div class="field-row">
                      <span class="field-abbr" style="color:{FIELD_COLOURS_CSS[field]}">{FIELD_ABBR[field]}</span>
                      <div class="field-track">
                        <div
                          class="field-fill"
                          style="width:{Math.min(100, (bloc.fields[field] / 150) * 100)}%; background:{FIELD_COLOURS_CSS[field]};"
                        ></div>
                      </div>
                      <span class="field-value">{Math.round(bloc.fields[field])}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .bloc-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #060a10;
    color: #8aacca;
    font-family: monospace;
  }

  .panel-header {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: #4a6080;
    padding: 8px 12px 6px;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .bloc-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bloc-row {
    background: #0a0e14;
    border: 1px solid #1e2530;
    border-radius: 2px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .bloc-row:hover {
    border-color: #2a3a50;
  }

  .bloc-row.expanded {
    border-color: #2a4a6a;
  }

  .bloc-row.player-bloc {
    border-color: #2a4a6a;
    background: #0a1420;
  }

  .bloc-row.player-bloc:hover {
    border-color: #3a5a7a;
  }

  .bloc-row.eliminated {
    opacity: 0.4;
    border-color: #141820;
    cursor: default;
  }

  .bloc-row.eliminated:hover {
    border-color: #141820;
  }

  .player-label {
    font-size: 0.5rem;
    letter-spacing: 0.08em;
    padding: 1px 4px;
    border-radius: 2px;
    background: #1a3a5a;
    color: #4a90c0;
  }

  .separator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 2px;
  }

  .separator::before,
  .separator::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #1e2530;
  }

  .separator-label {
    font-size: 0.5rem;
    letter-spacing: 0.1em;
    color: #2a3a50;
    white-space: nowrap;
  }

  .bloc-name {
    font-size: 0.65rem;
    color: #a0c8e8;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .profile-badge {
    font-size: 0.5rem;
    letter-spacing: 0.06em;
    padding: 1px 4px;
    border-radius: 2px;
    background: #1a2a3a;
    color: #5a8aaa;
  }

  .profile-badge.auth {
    background: #2a1a10;
    color: #aa6040;
  }

  .eliminated-label {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    color: #4a3030;
  }

  .bloc-stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .will-bar-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .will-bar-label {
    font-size: 0.5rem;
    color: #4a6080;
    letter-spacing: 0.06em;
    width: 22px;
    flex-shrink: 0;
  }

  .will-bar-track {
    flex: 1;
    height: 6px;
    background: #141820;
    border-radius: 1px;
    overflow: hidden;
  }

  .will-bar-fill {
    height: 100%;
    border-radius: 1px;
    transition: width 0.3s ease;
  }

  .will-value {
    font-size: 0.55rem;
    color: #6a8aa8;
    width: 24px;
    text-align: right;
    flex-shrink: 0;
  }

  .funding-stat {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .stat-label {
    font-size: 0.5rem;
    color: #4a6080;
  }

  .stat-value {
    font-size: 0.6rem;
    color: #8aacca;
    min-width: 28px;
  }

  .era-badge {
    font-size: 0.5rem;
    letter-spacing: 0.06em;
    color: #4a6080;
    padding: 1px 4px;
    border: 1px solid #1e2530;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* --- Expanded detail section --- */

  .bloc-detail {
    border-top: 1px solid #1e2530;
    padding-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .detail-label {
    font-size: 0.48rem;
    letter-spacing: 0.1em;
    color: #2a3a50;
  }

  .victory-bias-badge {
    font-size: 0.58rem;
    letter-spacing: 0.06em;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .detail-stat {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .detail-stat-label {
    font-size: 0.48rem;
    color: #4a6080;
    letter-spacing: 0.06em;
  }

  .detail-stat-value {
    font-size: 0.6rem;
    color: #8aacca;
    min-width: 24px;
  }

  .fields-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .field-abbr {
    font-size: 0.5rem;
    letter-spacing: 0.06em;
    width: 32px;
    flex-shrink: 0;
  }

  .field-track {
    flex: 1;
    height: 4px;
    background: #141820;
    border-radius: 1px;
    overflow: hidden;
  }

  .field-fill {
    height: 100%;
    border-radius: 1px;
    opacity: 0.8;
    transition: width 0.3s ease;
  }

  .field-value {
    font-size: 0.5rem;
    color: #4a6080;
    width: 22px;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
