<script lang="ts">
  import { BLOC_DEFS } from '../../data/loader';
  import type { BlocState } from '../../engine/types';

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
        <div class="bloc-row player-bloc">
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
        </div>
      {/if}
    {/if}

    <div class="separator"><span class="separator-label">OTHER BLOCS</span></div>

    <!-- NPC blocs -->
    {#each npcBlocs as bloc (bloc.defId)}
      {@const def = BLOC_DEFS.get(bloc.defId)}
      {#if def}
        <div class="bloc-row" class:eliminated={bloc.eliminated}>
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
  }

  .bloc-row.player-bloc {
    border-color: #2a4a6a;
    background: #0a1420;
  }

  .bloc-row.eliminated {
    opacity: 0.4;
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
</style>
