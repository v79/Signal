<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import FacilityPicker from './FacilityPicker.svelte';
  import TileTooltip from './TileTooltip.svelte';
  import BoardPanel from './BoardPanel.svelte';
  import { gameStore } from '../stores/game.svelte';
  import { FACILITY_DEFS } from '../../data/facilities';
  import { TECH_DEFS } from '../../data/technologies';
  import { BOARD_DEFS } from '../../data/board';
  import type { EarthScene as EarthSceneType } from '../../phaser/EarthScene';
  import type { SpaceScene as SpaceSceneType } from '../../phaser/SpaceScene';
  import type { AsteroidScene as AsteroidSceneType } from '../../phaser/AsteroidScene';
  import type { Era, BoardRole } from '../../engine/types';
  import Tooltip from './Tooltip.svelte';

  type MapTab = 'earth' | 'space' | 'belt';
  type AllTab = MapTab | 'board';

  const MAP_TABS: { id: MapTab; label: string; requiredEra: Era | null }[] = [
    { id: 'earth', label: 'EARTH', requiredEra: null },
    { id: 'space', label: 'NEAR SPACE', requiredEra: 'nearSpace' },
    { id: 'belt', label: 'ASTEROID BELT', requiredEra: 'deepSpace' },
  ];

  const ERA_ORDER: Era[] = ['earth', 'nearSpace', 'deepSpace'];

  function eraUnlocked(requiredEra: Era | null): boolean {
    if (!requiredEra) return true;
    return ERA_ORDER.indexOf(gameStore.state!.era) >= ERA_ORDER.indexOf(requiredEra);
  }

  let container: HTMLDivElement;
  let game: import('phaser').Game | null = null;
  let activeTab = $state<AllTab>('earth');
  /** Last active map (Phaser) tab — preserved when switching to Board so we can restore it. */
  let lastMapTab = $state<MapTab>('earth');
  /** Mouse position inside the map container for tooltip positioning. */
  let mouseX = $state(0);
  let mouseY = $state(0);

  const SCENE_KEYS: Record<MapTab, string> = {
    earth: 'EarthScene',
    space: 'SpaceScene',
    belt: 'AsteroidScene',
  };

  function switchTab(tab: AllTab): void {
    if (activeTab === tab) return;

    if (tab === 'board') {
      // Just show the board panel — don't stop the running Phaser scene.
      // The canvas becomes hidden via CSS; state is preserved on return.
      activeTab = 'board';
    } else {
      // Switching to a map tab. Stop the previously active map scene if it differs.
      const fromMapTab: MapTab = activeTab !== 'board' ? (activeTab as MapTab) : lastMapTab;
      if (game && fromMapTab !== tab) {
        game.scene.stop(SCENE_KEYS[fromMapTab]);
        game.scene.start(SCENE_KEYS[tab]);
      }
      lastMapTab = tab;
      activeTab = tab;
    }
  }

  // Selected Earth tile for facility placement
  const selectedTile = $derived(
    gameStore.selectedCoordKey != null && gameStore.state
      ? (gameStore.state.map.earthTiles.find(
          (t) => `${t.coord.q},${t.coord.r}` === gameStore.selectedCoordKey,
        ) ?? null)
      : null,
  );

  onMount(async () => {
    if (!browser) return;

    const [Phaser, { EarthScene }, { SpaceScene }, { AsteroidScene }] = await Promise.all([
      import('phaser'),
      import('../../phaser/EarthScene'),
      import('../../phaser/SpaceScene'),
      import('../../phaser/AsteroidScene'),
    ]);

    const earthScene = new EarthScene();
    const spaceScene = new SpaceScene();
    const asteroidScene = new AsteroidScene();

    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: container.clientWidth || 600,
      height: container.clientHeight || 400,
      backgroundColor: '#060a10',
      scene: [earthScene, spaceScene, asteroidScene],
      banner: false,
    });

    // Wire SpaceScene callbacks each time it (re)starts
    game.events.on('spaceSceneReady', () => {
      const space = game!.scene.getScene('SpaceScene') as SpaceSceneType;
      space.setCallbacks({
        getNodes: () => gameStore.state?.map.spaceNodes ?? [],
        getFacilities: () => gameStore.state?.player.facilities ?? [],
        getSelectedNode: () => gameStore.selectedSpaceNodeId,
        onNodeClick: (id: string) => {
          gameStore.selectSpaceNode(gameStore.selectedSpaceNodeId === id ? null : id);
        },
      });
    });

    // Wire AsteroidScene callbacks each time it (re)starts
    game.events.on('asteroidSceneReady', () => {
      const asteroid = game!.scene.getScene('AsteroidScene') as AsteroidSceneType;
      asteroid.setCallbacks({
        getNodes: () => gameStore.state?.map.beltNodes ?? [],
        getEdges: () => gameStore.state?.map.beltEdges ?? [],
        getFacilities: () => gameStore.state?.player.facilities ?? [],
        getSelectedNode: () => gameStore.selectedBeltNodeId,
        onNodeClick: (id: string) => {
          gameStore.selectBeltNode(gameStore.selectedBeltNodeId === id ? null : id);
        },
      });
    });

    // Wire EarthScene callbacks after Phaser is ready; stop the other scenes
    game.events.once('ready', () => {
      const earth = game!.scene.getScene('EarthScene') as EarthSceneType;
      earth.setCallbacks({
        getTiles: () => gameStore.state?.map.earthTiles ?? [],
        getFacilities: () => gameStore.state?.player.facilities ?? [],
        getQueue: () => gameStore.state?.player.constructionQueue ?? [],
        getSelected: () => gameStore.selectedCoordKey,
        getClimate: () => gameStore.state?.climatePressure ?? 0,
        onTileClick: (key: string) => {
          gameStore.selectTile(gameStore.selectedCoordKey === key ? null : key);
        },
        onTileHover: (key: string | null) => {
          gameStore.setHoveredTile(key);
        },
      });
      // Only EarthScene should run at startup
      game!.scene.stop('SpaceScene');
      game!.scene.stop('AsteroidScene');
    });
  });

  onDestroy(() => {
    game?.destroy(true);
    game = null;
  });
</script>

<div class="map-wrapper">
  <!-- Scene tab bar -->
  <div class="tab-bar">
    {#each MAP_TABS as tab}
      <Tooltip
        text={eraUnlocked(tab.requiredEra)
          ? `Switch to ${tab.label} view`
          : `Unlock the ${tab.label} era to access this view`}
        direction="below"
      >
        <button
          class="tab"
          class:active={activeTab === tab.id}
          class:locked={!eraUnlocked(tab.requiredEra)}
          disabled={!eraUnlocked(tab.requiredEra)}
          onclick={() => switchTab(tab.id)}
        >
          {tab.label}
          {#if !eraUnlocked(tab.requiredEra)}
            <span class="lock">&#x1F512;</span>
          {/if}
        </button>
      </Tooltip>
    {/each}
    <button
      class="tab"
      class:active={activeTab === 'board'}
      onclick={() => switchTab('board')}
    >
      BOARD
    </button>
  </div>

  <!-- Board panel (shown instead of Phaser canvas when board tab is active) -->
  {#if activeTab === 'board' && gameStore.state}
    <div class="board-panel-wrap">
      <BoardPanel
        board={gameStore.state.player.board}
        boardDefs={BOARD_DEFS}
        phase={gameStore.state.phase}
        onRecruit={(defId) => gameStore.recruitMember(defId, 40)}
        onDismiss={(role) => gameStore.dismissMember(role as BoardRole)}
      />
    </div>
  {/if}

  <!-- Phaser canvas mount point (hidden when board tab active, preserving scene state) -->
  <div
    class="map-container"
    style="display: {activeTab === 'board' ? 'none' : 'flex'}"
    bind:this={container}
    onmousemove={(e) => {
      mouseX = e.offsetX;
      mouseY = e.offsetY;
    }}
    onmouseleave={() => gameStore.setHoveredTile(null)}
  >
    {#if selectedTile && activeTab === 'earth'}
      <FacilityPicker
        tile={selectedTile}
        facilityDefs={FACILITY_DEFS}
        playerResources={gameStore.state!.player.resources}
        discoveredTechIds={new Set(
          gameStore.state!.player.techs.filter((t) => t.stage === 'discovered').map((t) => t.defId),
        )}
        techNames={new Map([...TECH_DEFS.values()].map((d) => [d.id, d.name]))}
        builtDefIds={new Set([
          ...gameStore.state!.player.facilities.map((f) => f.defId),
          ...gameStore.state!.player.constructionQueue
            .filter((a) => a.type === 'construct')
            .map((a) => a.facilityDefId),
        ])}
        onBuild={(defId) => gameStore.buildFacility(gameStore.selectedCoordKey!, defId)}
        onDemolish={() => gameStore.demolishFacility(gameStore.selectedCoordKey!)}
        onClose={() => gameStore.selectTile(null)}
      />
    {/if}
    {#if gameStore.hoveredTileKey && !selectedTile && activeTab === 'earth' && gameStore.state}
      <TileTooltip
        tile={gameStore.state.map.earthTiles.find(
          (t) => `${t.coord.q},${t.coord.r}` === gameStore.hoveredTileKey,
        ) ?? null}
        facilities={gameStore.state.player.facilities}
        facilityDefs={FACILITY_DEFS}
        x={mouseX}
        y={mouseY}
        containerWidth={container?.clientWidth ?? 600}
        containerHeight={container?.clientHeight ?? 400}
      />
    {/if}
  </div>
</div>

<style>
  .map-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    gap: 1px;
    background: #0a0e14;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
    padding: 2px 4px 0;
  }

  .tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #4a6080;
    cursor: pointer;
    font-family: monospace;
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    padding: 3px 8px 4px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .tab:hover:not(:disabled) {
    color: #8aacca;
  }

  .tab.active {
    border-bottom-color: #4a90c0;
    color: #a0c8e8;
  }

  .tab.locked {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .lock {
    font-size: 0.55rem;
    opacity: 0.6;
    margin-left: 2px;
  }

  .board-panel-wrap {
    flex: 1;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 0;
    flex-direction: column;
  }

  .map-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>
