<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import FacilityPicker from './FacilityPicker.svelte';
  import TileTooltip from './TileTooltip.svelte';
  import BoardPanel from './BoardPanel.svelte';
  import BlocStatusPanel from './BlocStatusPanel.svelte';
  import FacilityOverview from './FacilityOverview.svelte';
  import SpaceOverview from './SpaceOverview.svelte';
  import SpaceNodePicker from './SpaceNodePicker.svelte';
  import { gameStore } from '../stores/game.svelte';
  import { FACILITY_DEFS, TECH_DEFS, BOARD_DEFS, PROJECT_DEFS, TILE_ACTION_DEFS } from '../../data/loader';
  import type { EarthScene as EarthSceneType, AdjacencyIndicator } from '../../phaser/EarthScene';
  import type { SpaceScene as SpaceSceneType } from '../../phaser/SpaceScene';
  import type { AsteroidScene as AsteroidSceneType } from '../../phaser/AsteroidScene';
  import type { BoardRole, Era, FacilityInstance, OngoingAction } from '../../engine/types';
  import { getFacilitiesOnTile, computeHqBonus, canUpgradeFacility, type HqBonus } from '../../engine/facilities';
  import Tooltip from './Tooltip.svelte';

  type MapTab = 'earth' | 'space' | 'belt';
  type AllTab = MapTab | 'board' | 'blocs';

  type MapTabDef = { id: MapTab; label: string; requiredEra: Era | null; requiredProject?: string };

  const MAP_TABS: MapTabDef[] = [
    { id: 'earth', label: 'EARTH', requiredEra: null },
    { id: 'space', label: 'NEAR SPACE', requiredEra: 'nearSpace', requiredProject: 'orbitalStation_stage1' },
    { id: 'belt', label: 'ASTEROID BELT', requiredEra: 'deepSpace' },
  ];

  const ERA_ORDER: Era[] = ['earth', 'nearSpace', 'deepSpace'];

  const LUNAR_FACILITY_IDS = new Set([
    'lunarMine',
    'lunarProcessingPlant',
    'lunarHabitat',
    'lunarResearchBase',
    'lunarObservatory',
    'lunarColonyHub',
  ]);

  function tabUnlocked(tab: MapTabDef): boolean {
    if (!tab.requiredEra) return true;
    const state = gameStore.state;
    if (!state) return false;
    if (ERA_ORDER.indexOf(state.era) >= ERA_ORDER.indexOf(tab.requiredEra)) return true;
    if (tab.requiredProject && state.player.completedProjectIds.includes(tab.requiredProject)) return true;
    return false;
  }

  const hasLunarFacility = $derived(
    gameStore.state?.player.facilities.some((f) => LUNAR_FACILITY_IDS.has(f.defId)) ?? false,
  );

  let container = $state<HTMLDivElement | undefined>(undefined);
  let game: import('phaser').Game | null = null;
  let activeTab = $state<AllTab>('earth');
  /** Last active map (Phaser) tab — preserved when switching to Board so we can restore it. */
  let lastMapTab = $state<MapTab>('earth');
  /** Mouse position inside the map container for tooltip positioning. */
  let mouseX = $state(0);
  let mouseY = $state(0);
  /** True once the Phaser game has fully initialised. */
  let mapReady = $state(false);
  /** Whether the facility overview panel is open. */
  let showFacilityOverview = $state(false);
  let showSpaceOverview = $state(false);

  /** HQ bonus including tech field bonuses — passed to TileTooltip for the HQ tile. */
  const hqBonus = $derived.by<HqBonus>(() => {
    const s = gameStore.state;
    if (!s) return { resources: {}, fields: {} };
    const techFieldBonus: Partial<import('../../engine/types').FieldPoints> = {};
    for (const ts of s.player.techs) {
      if (ts.stage !== 'discovered') continue;
      const bonus = TECH_DEFS.get(ts.defId)?.hqFieldBonus;
      if (!bonus) continue;
      for (const k of Object.keys(bonus) as (keyof import('../../engine/types').FieldPoints)[]) {
        techFieldBonus[k] = (techFieldBonus[k] ?? 0) + (bonus[k] ?? 0);
      }
    }
    return computeHqBonus(s.player.willProfile, techFieldBonus);
  });

  const HEX_DIRS = [
    { q: 1, r: 0 }, { q: -1, r: 0 },
    { q: 0, r: 1 }, { q: 0, r: -1 },
    { q: 1, r: -1 }, { q: -1, r: 1 },
  ];

  /**
   * Per-coordKey list of directional adjacency indicators for the Earth scene.
   * Each indicator says: "at the edge facing `direction`, draw a triangle of `type`."
   */
  const adjacencyMap = $derived.by<Map<string, AdjacencyIndicator[]>>(() => {
    if (!gameStore.state) return new Map();
    const facilities = gameStore.state.player.facilities;
    const tiles = gameStore.state.map.earthTiles;

    // Build coordKey → FacilityInstance[] (multiple per tile), skipping destroyed tiles
    const keyToFacilities = new Map<string, FacilityInstance[]>();
    for (const tile of tiles) {
      if (tile.destroyedStatus !== null) continue;
      const tileFacilities = getFacilitiesOnTile(tile, facilities);
      if (tileFacilities.length > 0) {
        keyToFacilities.set(`${tile.coord.q},${tile.coord.r}`, tileFacilities);
      }
    }

    const result = new Map<string, AdjacencyIndicator[]>();

    for (const [key, tileFacilities] of keyToFacilities) {
      const [q, r] = key.split(',').map(Number);
      const addedDirs = new Set<string>();

      for (const facility of tileFacilities) {
        const def = FACILITY_DEFS.get(facility.defId);
        if (!def) continue;

        for (const dir of HEX_DIRS) {
          const nKey = `${q + dir.q},${r + dir.r}`;
          const neighbors = keyToFacilities.get(nKey);
          if (!neighbors) continue;

          for (const neighbor of neighbors) {
            const dirKey = `${dir.q},${dir.r}`;
            for (const rule of def.adjacencyBonuses) {
              if (rule.neighborDefId === neighbor.defId) {
                const k = `${dirKey}:bonus`;
                if (!addedDirs.has(k)) {
                  addedDirs.add(k);
                  if (!result.has(key)) result.set(key, []);
                  result.get(key)!.push({ direction: dir, type: 'bonus' });
                }
              }
            }
            for (const rule of def.adjacencyPenalties) {
              if (rule.neighborDefId === neighbor.defId) {
                const k = `${dirKey}:penalty`;
                if (!addedDirs.has(k)) {
                  addedDirs.add(k);
                  if (!result.has(key)) result.set(key, []);
                  result.get(key)!.push({ direction: dir, type: 'penalty' });
                }
              }
            }
          }
        }
      }
    }
    return result;
  });

  /**
   * Construction queue extended with virtual entries for active projects.
   * Projects that require a specific facility show the building ring on that
   * facility's tile. Computed reactively so Phaser callbacks don't recalculate
   * on every render frame.
   */
  const projectVirtualQueue = $derived.by<OngoingAction[]>(() => {
    const state = gameStore.state;
    if (!state) return [];
    const baseQueue = state.player.constructionQueue;
    const occupiedCoordKeys = new Set(baseQueue.map((a) => a.coordKey));
    const virtualActions: OngoingAction[] = [];
    for (const project of state.player.activeProjects) {
      const def = PROJECT_DEFS.get(project.defId);
      const requiredFacilityDefs = def?.prerequisites.requiredFacilityDefs ?? [];
      for (const facilityDefId of requiredFacilityDefs) {
        const facility = state.player.facilities.find((f) => f.defId === facilityDefId);
        if (!facility) continue;
        const tile = state.map.earthTiles.find((t) => t.facilitySlots.includes(facility.id));
        if (!tile) continue;
        const coordKey = `${tile.coord.q},${tile.coord.r}`;
        // First project to require a given tile wins; avoids visual clutter when
        // multiple active projects share the same required facility.
        if (occupiedCoordKeys.has(coordKey)) continue;
        occupiedCoordKeys.add(coordKey);
        virtualActions.push({
          id: `project-ring-${project.defId}-${facilityDefId}`,
          type: 'construct',
          facilityDefId,
          coordKey,
          turnsRemaining: project.effectiveDuration - project.turnsElapsed,
          totalTurns: project.effectiveDuration,
          slotIndex: 0,
        });
      }
    }
    return virtualActions.length > 0 ? [...baseQueue, ...virtualActions] : baseQueue;
  });

  const SCENE_KEYS: Record<MapTab, string> = {
    earth: 'EarthScene',
    space: 'SpaceScene',
    belt: 'AsteroidScene',
  };

  function switchTab(tab: AllTab): void {
    if (activeTab === tab) return;

    if (tab === 'board' || tab === 'blocs') {
      // Just show the panel — don't stop the running Phaser scene.
      // The canvas becomes hidden via CSS; state is preserved on return.
      activeTab = tab;
    } else {
      // Switching to a map tab. Stop the previously active map scene if it differs.
      const fromMapTab: MapTab = activeTab !== 'board' && activeTab !== 'blocs' ? (activeTab as MapTab) : lastMapTab;
      if (game && fromMapTab !== tab) {
        game.scene.stop(SCENE_KEYS[fromMapTab]);
        game.scene.start(SCENE_KEYS[tab]);
      }
      // Deselect space node when leaving the space tab
      if (fromMapTab === 'space' && tab !== 'space') {
        gameStore.selectSpaceNode(null);
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

  /** The currently selected space node, if any. */
  const selectedSpaceNode = $derived(
    gameStore.selectedSpaceNodeId != null && gameStore.state
      ? (gameStore.state.map.spaceNodes.find((n) => n.id === gameStore.selectedSpaceNodeId) ?? null)
      : null,
  );

  /** Map of nodeId → next-tier facility name for nodes that can be upgraded. */
  const upgradableNodeIds = $derived.by<Record<string, string>>(() => {
    const state = gameStore.state;
    if (!state) return {};
    const result: Record<string, string> = {};
    for (const node of state.map.spaceNodes) {
      const nextDef = canUpgradeFacility(
        node.id,
        state.map.spaceNodes,
        state.player.facilities,
        FACILITY_DEFS,
        state.player.techs,
      );
      if (nextDef) result[node.id] = nextDef.name;
    }
    return result;
  });

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
      parent: container!,
      width: container!.clientWidth || 600,
      height: container!.clientHeight || 400,
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
        getCompletedProjects: () => gameStore.state?.player.completedProjectIds ?? [],
        getLaunchAllocation: () => gameStore.state?.launchAllocation ?? {},
        getConstructionQueue: () => gameStore.state?.player.constructionQueue ?? [],
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
        getQueue: () => projectVirtualQueue,
        getSelected: () => gameStore.selectedCoordKey,
        getClimate: () => gameStore.state?.climatePressure ?? 0,
        getAdjacencyMap: () => adjacencyMap,
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
      mapReady = true;
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
        text={tabUnlocked(tab)
          ? `Switch to ${tab.label} view`
          : `Unlock the ${tab.label} era to access this view`}
        direction="below"
      >
        <button
          class="tab"
          class:active={activeTab === tab.id}
          class:locked={!tabUnlocked(tab)}
          disabled={!tabUnlocked(tab)}
          onclick={() => switchTab(tab.id)}
        >
          {tab.label}
          {#if !tabUnlocked(tab)}
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
      {#if gameStore.state}
        {@const filled = Object.values(gameStore.state.player.board).filter((m) => m !== undefined && m.leftTurn === null).length}
        {@const total = (gameStore.state.era === 'earth' ? 7 : 8) + (hasLunarFacility ? 1 : 0)}
        COMMITTEE (<span class:empty-committee={filled === 0}>{filled}</span>/{total})
      {:else}
        COMMITTEE
      {/if}
    </button>
    <button
      class="tab"
      class:active={activeTab === 'blocs'}
      onclick={() => switchTab('blocs')}
    >
      BLOCS
    </button>
  </div>
  {#if activeTab === 'earth' && gameStore.state}
    <div class="map-toolbar">
      <Tooltip text="Overview of all built facilities" direction="below">
        <button
          class="tab overview-btn"
          class:active={showFacilityOverview}
          onclick={() => (showFacilityOverview = !showFacilityOverview)}
        >
          ≡ FACILITIES
        </button>
      </Tooltip>
    </div>
  {/if}
  {#if activeTab === 'space' && gameStore.state}
    <div class="map-toolbar">
      <Tooltip text="Overview of Near Space assets and orbital projects" direction="below">
        <button
          class="tab overview-btn"
          class:active={showSpaceOverview}
          onclick={() => (showSpaceOverview = !showSpaceOverview)}
        >
          ≡ ASSETS
        </button>
      </Tooltip>
    </div>
  {/if}

  <!-- Bloc status panel (shown instead of Phaser canvas when blocs tab is active) -->
  {#if activeTab === 'blocs' && gameStore.state}
    <div class="board-panel-wrap">
      <BlocStatusPanel blocs={gameStore.state.blocs} playerBlocId={gameStore.state.player.blocDefId} />
    </div>
  {/if}

  <!-- Board panel (shown instead of Phaser canvas when board tab is active) -->
  {#if activeTab === 'board' && gameStore.state}
    <div class="board-panel-wrap">
      <BoardPanel
        board={gameStore.state.player.board}
        boardDefs={BOARD_DEFS}
        phase={gameStore.state.phase}
        playerResources={gameStore.state.player.resources}
        actionsThisTurn={gameStore.state.actionsThisTurn ?? 0}
        maxActionsPerTurn={(gameStore.state.maxActionsPerTurn ?? 3) + (gameStore.state.bonusActionsThisTurn ?? 0)}
        availableBoardDefIds={gameStore.state.availableBoardDefIds ?? []}
        gracePeriodEnds={gameStore.state.boardGracePeriodEnds ?? 4}
        turn={gameStore.state.turn}
        era={gameStore.state.era}
        hasLunarFacility={hasLunarFacility}
        discoveredTechIds={gameStore.state.player.techs
          .filter((t) => t.stage === 'discovered')
          .map((t) => t.defId)}
        committeeNotifications={gameStore.state.committeeNotifications ?? []}
        onRecruit={(defId) => gameStore.recruitMember(defId, BOARD_DEFS.get(defId)?.startAge ?? 40)}
        onDismiss={(role) => gameStore.dismissMember(role as BoardRole)}
        onResolveNotification={(id, choiceIndex) =>
          gameStore.resolveCommitteeNotification(id, choiceIndex)}
        onDismissNotification={(id) => gameStore.dismissCommitteeNotification(id)}
      />
    </div>
  {/if}

  <!-- Phaser canvas mount point (hidden when board tab active, preserving scene state) -->
  <div
    class="map-container"
    role="application"
    aria-label="Game map"
    style="display: {activeTab === 'board' || activeTab === 'blocs' ? 'none' : 'flex'}"
    bind:this={container}
    onmousemove={(e) => {
      mouseX = e.offsetX;
      mouseY = e.offsetY;
    }}
    onmouseleave={() => gameStore.setHoveredTile(null)}
  >
    {#if !mapReady}
      <div class="map-loading">
        <span class="loading-text">SYNCHRONISING GLOBAL UPLINK<span class="cursor">_</span></span>
      </div>
    {/if}
    {#if showFacilityOverview && gameStore.state && activeTab === 'earth'}
      <FacilityOverview
        facilities={gameStore.state.player.facilities}
        facilityDefs={FACILITY_DEFS}
        earthTiles={gameStore.state.map.earthTiles}
        onClose={() => (showFacilityOverview = false)}
      />
    {/if}
    {#if showSpaceOverview && gameStore.state && activeTab === 'space'}
      <SpaceOverview
        spaceNodes={gameStore.state.map.spaceNodes}
        facilities={gameStore.state.player.facilities}
        facilityDefs={FACILITY_DEFS}
        projectDefs={PROJECT_DEFS}
        completedProjectIds={gameStore.state.player.completedProjectIds}
        launchCapacity={gameStore.state.launchCapacity}
        launchAllocation={gameStore.state.launchAllocation}
        remainingCapacity={gameStore.remainingLaunchCapacity}
        {upgradableNodeIds}
        onClose={() => (showSpaceOverview = false)}
        onToggleSupply={(nodeId) => gameStore.toggleSpaceFacilitySupply(nodeId)}
        onUpgrade={(nodeId) => gameStore.upgradeFacility(nodeId)}
      />
    {/if}
    {#if selectedSpaceNode && activeTab === 'space' && gameStore.state}
      <SpaceNodePicker
        node={selectedSpaceNode}
        facilityDefs={FACILITY_DEFS}
        facilityInstances={gameStore.state.player.facilities.filter(
          (f) => f.locationKey === selectedSpaceNode.id,
        )}
        playerResources={gameStore.state.player.resources}
        discoveredTechIds={new Set(
          gameStore.state.player.techs.filter((t) => t.stage === 'discovered').map((t) => t.defId),
        )}
        techNames={new Map([...TECH_DEFS.values()].map((d) => [d.id, d.name]))}
        constructionQueue={gameStore.state.player.constructionQueue}
        launchCapacity={gameStore.state.launchCapacity}
        remainingCapacity={gameStore.remainingLaunchCapacity}
        upgradeName={upgradableNodeIds[selectedSpaceNode.id]}
        actionsThisTurn={gameStore.state.actionsThisTurn ?? 0}
        maxActionsPerTurn={(gameStore.state.maxActionsPerTurn ?? 3) + (gameStore.state.bonusActionsThisTurn ?? 0)}
        onBuild={(defId) => gameStore.buildSpaceFacility(gameStore.selectedSpaceNodeId!, defId)}
        onUpgrade={() => gameStore.upgradeFacility(gameStore.selectedSpaceNodeId!)}
        onClose={() => gameStore.selectSpaceNode(null)}
      />
    {/if}
    {#if selectedTile && activeTab === 'earth'}
      <FacilityPicker
        tile={selectedTile}
        facilityDefs={FACILITY_DEFS}
        tileActionDefs={TILE_ACTION_DEFS}
        playerResources={gameStore.state!.player.resources}
        facilityInstances={getFacilitiesOnTile(selectedTile, gameStore.state!.player.facilities)}
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
        actionsThisTurn={gameStore.state!.actionsThisTurn ?? 0}
        maxActionsPerTurn={(gameStore.state!.maxActionsPerTurn ?? 3) + (gameStore.state!.bonusActionsThisTurn ?? 0)}
        onBuild={(defId) => gameStore.buildFacility(gameStore.selectedCoordKey!, defId)}
        onDemolish={(slotIndex) => gameStore.demolishFacility(gameStore.selectedCoordKey!, slotIndex)}
        onTileAction={(taId) => gameStore.enqueueTileAction(gameStore.selectedCoordKey!, taId)}
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
        {hqBonus}
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

  .empty-committee {
    color: #e05555;
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

  .map-toolbar {
    display: flex;
    gap: 1px;
    background: #0a0e14;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
    padding: 2px 4px 0;
  }

  .overview-btn {
    font-size: 0.6rem;
    letter-spacing: 0.06em;
  }

  .map-loading {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #060a10;
  }

  .loading-text {
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    color: #2a4a6a;
    text-transform: uppercase;
  }

  .cursor {
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
</style>
