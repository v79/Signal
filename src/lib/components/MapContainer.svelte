<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import FacilityPicker from './FacilityPicker.svelte';
  import TileTooltip from './TileTooltip.svelte';
  import BoardPanel from './BoardPanel.svelte';
  import BlocStatusPanel from './BlocStatusPanel.svelte';
  import CompletedProjectsPanel from './CompletedProjectsPanel.svelte';
  import FacilityOverview from './FacilityOverview.svelte';
  import SpaceOverview from './SpaceOverview.svelte';
  import SpaceNodePicker from './SpaceNodePicker.svelte';
  import HelpButton from './HelpButton.svelte';
  import HelpModal from './HelpModal.svelte';
  import { HELP_TOPICS, type HelpTopicId } from '../../data/helpTopics';
  import { gameStore } from '../stores/game.svelte';
  import { BOARD_DEFS, FACILITY_DEFS, PROJECT_DEFS, TECH_DEFS, TILE_ACTION_DEFS } from '../../data/loader';
  import type { AdjacencyIndicator, EarthScene as EarthSceneType } from '../../phaser/EarthScene';
  import type { SpaceScene as SpaceSceneType } from '../../phaser/SpaceScene';
  import type { AsteroidScene as AsteroidSceneType } from '../../phaser/AsteroidScene';
  import type { Era, FacilityInstance, OngoingAction, BoardRole } from '../../engine/types';
  import { canUpgradeFacility, computeHqBonus, getFacilitiesOnTile, type HqBonus } from '../../engine/facilities';
  import Tooltip from './Tooltip.svelte';

  type MapTab = 'earth' | 'space' | 'belt';
  type AllTab = MapTab | 'board' | 'blocs' | 'projects';

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
    if (tab.requiredProject && tab.requiredProject in state.player.completedProjectIds) return true;
    return false;
  }

  /** True when a tab has a pending notification dot. */
  function tabHasNewDot(tabId: string): boolean {
    const state = gameStore.state;
    if (!state) return false;
    return state.tabSeen[tabId] === false;
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
  let launchDetailOpen = $state(false);
  let helpOpen = $state(false);

  /**
   * The current tab's help topic. Map tab ids match HelpTopicId 1:1, so this
   * is just a typed cast — kept as a $derived so the modal updates if the
   * active tab changes while help is somehow still open.
   */
  const helpTopic = $derived(HELP_TOPICS[activeTab as HelpTopicId]);

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

  function isMapTab(tab: AllTab): tab is MapTab {
    return tab === 'earth' || tab === 'space' || tab === 'belt';
  }

  const SCENE_KEYS: Record<MapTab, string> = {
    earth: 'EarthScene',
    space: 'SpaceScene',
    belt: 'AsteroidScene',
  };

  function switchTab(tab: AllTab): void {
    if (activeTab === tab) return;

    gameStore.markTabSeen(tab);

    if (!isMapTab(tab)) {
      // Just show the panel — don't stop the running Phaser scene.
      // The canvas becomes hidden via CSS; state is preserved on return.
      activeTab = tab;
    } else {
      // Switching to a map tab. Stop the previously active map scene if it differs.
      const fromMapTab: MapTab = isMapTab(activeTab) ? activeTab : lastMapTab;
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

  const completedProjectKeys = $derived(
    Object.keys(gameStore.state?.player.completedProjectIds ?? {}),
  );

  const hasCompletedProjects = $derived(completedProjectKeys.length > 0);

  /** Coord key of the tile containing CERN's host publicUniversity, or null. */
  const cernHostCoordKey = $derived((): string | null => {
    const state = gameStore.state;
    if (!state) return null;
    const hostFacilityId = state.player.projectHostFacilityIds['cern'];
    if (!hostFacilityId) return null;
    const tile = state.map.earthTiles.find((t) => t.facilitySlots.includes(hostFacilityId));
    return tile ? `${tile.coord.q},${tile.coord.r}` : null;
  });

  /** The currently selected space node, if any. */
  const selectedSpaceNode = $derived(
    gameStore.selectedSpaceNodeId != null && gameStore.state
      ? (gameStore.state.map.spaceNodes.find((n) => n.id === gameStore.selectedSpaceNodeId) ?? null)
      : null,
  );

  /** Map of nodeId → next-tier FacilityDef for nodes that can be upgraded. */
  const upgradableNodeIds = $derived.by<Record<string, import('../../engine/types').FacilityDef>>(() => {
    const state = gameStore.state;
    if (!state) return {};
    const result: Record<string, import('../../engine/types').FacilityDef> = {};
    for (const node of state.map.spaceNodes) {
      const nextDef = canUpgradeFacility(
        node.id,
        state.map.spaceNodes,
        state.player.facilities,
        FACILITY_DEFS,
        state.player.techs,
      );
      if (nextDef) result[node.id] = nextDef;
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
        getCompletedProjects: () => completedProjectKeys,
        getLaunchAllocation: () => gameStore.state?.launchAllocation ?? {},
        getConstructionQueue: () => gameStore.state?.player.constructionQueue ?? [],
        onNodeClick: (id: string) => {
          gameStore.selectSpaceNode(gameStore.selectedSpaceNodeId === id ? null : id);
        },
        onEarthClick: () => {
          switchTab('earth');
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
        getCernHostCoordKey: () => cernHostCoordKey(),
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
          {:else if tabHasNewDot(tab.id)}
            <span class="new-dot" aria-label="New content"></span>
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
        {@const
          filled = Object.values(gameStore.state.player.board).filter((m) => m !== undefined && m.leftTurn === null).length}
        {@const total = (gameStore.state.era === 'earth' ? 7 : 8) + (hasLunarFacility ? 1 : 0)}
        COMMITTEE (<span class:empty-committee={filled === 0}>{filled}</span>/{total})
      {:else}
        COMMITTEE
      {/if}
      {#if tabHasNewDot('board')}
        <span class="new-dot" aria-label="New committee activity"></span>
      {/if}
    </button>
    <button
      class="tab"
      class:active={activeTab === 'blocs'}
      onclick={() => switchTab('blocs')}
    >
      BLOCS
    </button>
    <Tooltip
      text={hasCompletedProjects ? 'View completed projects' : 'Complete a project to unlock this view'}
      direction="below"
    >
      <button
        class="tab"
        class:active={activeTab === 'projects'}
        class:locked={!hasCompletedProjects}
        disabled={!hasCompletedProjects}
        onclick={() => switchTab('projects')}
      >
          PROJECTS
          {#if !hasCompletedProjects}
            <span class="lock">&#x1F512;</span>
          {:else if tabHasNewDot('projects')}
            <span class="new-dot" aria-label="New project completed"></span>
          {/if}
        </button>
      </Tooltip>
    <div class="tab-spacer"></div>
    <div class="help-slot">
      <HelpButton onClick={() => (helpOpen = true)} label={`Help — ${helpTopic.title}`} />
    </div>
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
      {#if gameStore.state.launchCapacity > 0}
        {@const used = gameStore.state.launchCapacity - gameStore.remainingLaunchCapacity}
        {@const breakdown = gameStore.launchCapacityBreakdown}
        <div class="launch-widget">
          <Tooltip
            text={"Launch capacity limits how many near-space facilities can be actively supplied each turn. Each facility costs 1 or more capacity units.\n\nTo free up capacity, open the ASSETS panel and toggle facilities off — mothballed facilities stop consuming supply but also stop producing output.\n\nClick to see a breakdown of capacity sources."}
            direction="below"
          >
            <button
              class="launch-toggle"
              onclick={() => { launchDetailOpen = !launchDetailOpen; }}
              aria-expanded={launchDetailOpen}
              aria-label="Toggle launch capacity breakdown"
            >
              <span class="launch-label">LAUNCH CAPACITY</span>
              <div class="launch-bar-track">
                <div
                  class="launch-bar-fill"
                  style="width: {Math.min(100, (used / gameStore.state.launchCapacity) * 100)}%"
                ></div>
              </div>
              <span class="launch-value">{used}/{gameStore.state.launchCapacity}</span>
            </button>
          </Tooltip>
          {#if launchDetailOpen}
            <div class="detail-backdrop" onclick={() => { launchDetailOpen = false; }} role="none" tabindex="-1"></div>
            <div class="launch-detail" role="region" aria-label="Launch capacity sources">
              {#each breakdown.entries as entry}
                <div class="launch-detail-row">
                  <span class="launch-detail-label">{entry.label}</span>
                  <span class="launch-detail-value">+{entry.amount}</span>
                </div>
              {/each}
              {#if breakdown.entries.length === 0}
                <div class="launch-detail-row">
                  <span class="launch-detail-label">No sources</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Bloc status panel (shown instead of Phaser canvas when blocs tab is active) -->
  {#if activeTab === 'blocs' && gameStore.state}
    <div class="board-panel-wrap">
      <BlocStatusPanel blocs={gameStore.state.blocs} playerBlocId={gameStore.state.player.blocDefId}
                       playerResources={gameStore.state.player.resources} />
    </div>
  {/if}

  <!-- Projects panel (shown instead of Phaser canvas when projects tab is active) -->
  {#if activeTab === 'projects' && gameStore.state}
    <div class="board-panel-wrap">
      <CompletedProjectsPanel
        completedProjectIds={gameStore.state.player.completedProjectIds}
        projectDefs={PROJECT_DEFS}
      />
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
    style="display: {isMapTab(activeTab) ? 'flex' : 'none'}"
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
        playerResources={gameStore.state.player.resources}
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
        spaceNodes={gameStore.state.map.spaceNodes}
        playerResources={gameStore.state.player.resources}
        discoveredTechIds={new Set(
          gameStore.state.player.techs.filter((t) => t.stage === 'discovered').map((t) => t.defId),
        )}
        techNames={new Map([...TECH_DEFS.values()].map((d) => [d.id, d.name]))}
        constructionQueue={gameStore.state.player.constructionQueue}
        launchCapacity={gameStore.state.launchCapacity}
        remainingCapacity={gameStore.remainingLaunchCapacity}
        launchAllocation={gameStore.state.launchAllocation}
        upgradeDef={upgradableNodeIds[selectedSpaceNode.id]}
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

{#if helpOpen}
  <HelpModal topic={helpTopic} onClose={() => (helpOpen = false)} />
{/if}

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
        align-items: center;
        gap: 1px;
        background: var(--surface-1);
        border-bottom: 1px solid var(--border-panel);
        flex-shrink: 0;
        padding: 2px 4px 0;
    }

    .tab-spacer {
        flex: 1;
    }

    .help-slot {
        display: flex;
        align-items: center;
        padding: 0 6px 2px;
    }

    .tab {
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-dim);
        cursor: pointer;
        font-family: var(--ff-mono);
        font-size: var(--fs-base);
        letter-spacing: 0.04em;
        padding: 3px 8px 4px;
        transition: color 0.15s,
        border-color 0.15s;
    }

    .tab:hover:not(:disabled) {
        color: var(--text-accent);
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
        font-size: var(--fs-xs);
        opacity: 0.6;
        margin-left: 2px;
    }

    /* Tab-bar variant of the global .new-dot — adds spacing + alignment. */
    .tab :global(.new-dot) {
        margin-left: 4px;
        vertical-align: middle;
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
        background: var(--surface-1);
        border-bottom: 1px solid var(--border-panel);
        flex-shrink: 0;
        padding: 2px 4px 0;
    }

    .overview-btn {
        font-size: var(--fs-sm);
        letter-spacing: 0.06em;
    }

    .detail-backdrop {
        position: fixed;
        inset: 0;
        z-index: 49;
    }

    .launch-widget {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-left: auto;
        padding: 2px 6px;
        position: relative;
    }

    .launch-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
        letter-spacing: inherit;
        color: inherit;
    }

    .launch-detail {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--surface-1);
        border: 1px solid var(--border-active);
        padding: 0.4rem 0.6rem;
        min-width: 13rem;
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        margin-top: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .launch-detail-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: var(--fs-sm);
        letter-spacing: 0.06em;
    }

    .launch-detail-label {
        color: #6a7888;
    }

    .launch-detail-value {
        color: #4a90c0;
        font-variant-numeric: tabular-nums;
    }

    .launch-label {
        font-size: var(--fs-xs);
        letter-spacing: 0.08em;
        color: #4a7a9a;
        flex-shrink: 0;
    }

    .launch-bar-track {
        width: 60px;
        height: 4px;
        background: var(--border-subtle);
        border-radius: 2px;
        overflow: hidden;
    }

    .launch-bar-fill {
        height: 100%;
        background: #4a90c0;
        border-radius: 2px;
        transition: width 0.2s;
    }

    .launch-value {
        font-size: var(--fs-xs);
        color: #8aaabb;
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
    }

    .map-loading {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-0);
    }

    .loading-text {
        font-size: var(--fs-md);
        letter-spacing: 0.18em;
        color: #2a4a6a;
        text-transform: uppercase;
    }

    .cursor {
        animation: blink 1s step-end infinite;
    }

    @keyframes blink {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
    }
</style>
