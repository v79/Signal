import Phaser from 'phaser';
import type { SpaceNode, FacilityInstance, OngoingAction } from '../engine/types';

// ---------------------------------------------------------------------------
// SpaceScene — Near Space map (Era 2)
//
// A fixed set of orbital nodes connected by transit lines.
// Node positions are purely visual (canvas coordinates); game state for each
// node is read from SpaceNode via callbacks.
//
// Orbit arcs around Earth and the Moon are purely visual — auto-populated
// from completedProjectIds. Players do not interact with arc slots directly.
//
// Scene key: 'SpaceScene'
// ---------------------------------------------------------------------------

export interface SpaceSceneCallbacks {
  getNodes: () => SpaceNode[];
  getFacilities: () => FacilityInstance[];
  getSelectedNode: () => string | null;
  onNodeClick: (id: string) => void;
  getCompletedProjects: () => string[];
  getLaunchAllocation: () => Record<string, boolean>;
  getConstructionQueue: () => OngoingAction[];
}

// Fixed canvas positions for each node id (normalised to 600 × 400 logical px)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  lunarSurface: { x: 300, y: 55 },
  l1: { x: 90, y: 195 },
  leo: { x: 300, y: 195 },
  l2: { x: 510, y: 195 },
  l4: { x: 120, y: 345 },
  l5: { x: 480, y: 345 },
};

// Transit connections between nodes
const CONNECTIONS: [string, string][] = [
  ['leo', 'l1'],
  ['leo', 'l2'],
  ['leo', 'lunarSurface'],
  ['l1', 'l4'],
  ['l2', 'l5'],
];

// Node type colours
const NODE_COLOURS: Record<string, number> = {
  lowEarthOrbit: 0x4a90c0,
  lagrangePoint: 0x7a60c0,
  lunarSurface: 0xb0b8c0,
};

const NODE_RADIUS = 18;
const EARTH_RADIUS = 40;

// Earth visual position in logical 600×400 space — below LEO, above the bottom edge.
// The orbit arc (arcRy=55) bridges the gap upward toward the LEO node at y=195.
const EARTH_POS = { x: 300, y: 315 };

// Per-facility colours for the construction overlay arc (matches EarthScene convention)
const SPACE_FACILITY_COLORS: Record<string, number> = {
  satelliteArray:        0x4a90d8,
  communicationsHub:     0x50c890,
  spaceObservatory:      0xa070d8,
  basicSolarArray:       0xd8b840,
  advancedSolarArray:    0xf0d060,
  deepSpaceRelay:        0x40c8d8,
  launchRelay:           0xd87840,
  lunarHabitat:          0x9090a0,
  lunarResearchBase:     0x6aaad8,
  lunarColonyHub:        0xc8d8e8,
  lunarMine:             0xb08050,
  lunarObservatory:      0x9060c0,
};

// Orbital station stage project IDs in order
const STATION_STAGES = [
  'orbitalStation_stage1',
  'orbitalStation_stage2',
  'orbitalStation_stage3',
];

// Earth orbit arc — projects with fixed angles (degrees, canvas convention).
// Upper arc spans roughly 200°–340°; angles assigned symmetrically so items
// spread left-to-right above Earth. Max 6 items before crowding.
// Canvas angles: 270° = directly above, 230° = upper-left, 310° = upper-right.
const EARTH_ORBIT_PROJECTS: { id: string; angle: number; label: string; icon: 'telescope' | 'hubble' }[] = [
  { id: 'orbitalTelescopeArray', angle: 230, label: 'TELESCOPE ARRAY', icon: 'telescope' },
  { id: 'hubbleSpaceTelescope',  angle: 310, label: 'IMAGING PLATFORM', icon: 'hubble'    },
];

export class SpaceScene extends Phaser.Scene {
  private callbacks: SpaceSceneCallbacks | null = null;
  private gfx!: Phaser.GameObjects.Graphics;
  private labelGroup!: Phaser.GameObjects.Group;
  private scaleX = 1;
  private scaleY = 1;

  // Right-click drag-to-pan state
  private panX = 0;
  private panY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;
  private isDragging = false;
  private dragMoved = false;
  private static readonly DRAG_THRESHOLD = 5;

  constructor() {
    super({ key: 'SpaceScene' });
  }

  setCallbacks(cb: SpaceSceneCallbacks): void {
    this.callbacks = cb;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.scaleX = w / 600;
    this.scaleY = h / 400;

    this.gfx = this.add.graphics();
    this.labelGroup = this.add.group();

    this.drawStars(w, h);
    // Earth is drawn each frame in renderScene() anchored to the LEO node position.

    // Suppress browser context menu on right-click
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Right-click drag-to-pan
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.rightButtonDown()) return;
      this.dragStartX = ptr.x;
      this.dragStartY = ptr.y;
      this.dragStartPanX = this.panX;
      this.dragStartPanY = this.panY;
      this.isDragging = true;
      this.dragMoved = false;
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = ptr.x - this.dragStartX;
      const dy = ptr.y - this.dragStartY;
      if (!this.dragMoved && Math.hypot(dx, dy) > SpaceScene.DRAG_THRESHOLD) {
        this.dragMoved = true;
      }
      if (this.dragMoved) {
        this.panX = this.dragStartPanX + dx;
        this.panY = this.dragStartPanY + dy;
      }
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonReleased()) {
        this.isDragging = false;
      }
    });

    this.input.on('pointerout', () => {
      this.isDragging = false;
      this.dragMoved = false;
    });

    // Left-click node selection (suppressed during drag)
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.leftButtonDown()) return;
      if (this.isDragging && this.dragMoved) return;
      const nodeId = this.hitTestNode(ptr.x, ptr.y);
      if (nodeId) this.callbacks?.onNodeClick(nodeId);
    });

    this.game.events.emit('spaceSceneReady');
  }

  update(): void {
    if (!this.callbacks) return;
    this.renderScene();
  }

  // ---------------------------------------------------------------------------
  // Earth — drawn each frame into gfx, centred on the LEO node position
  // ---------------------------------------------------------------------------

  private drawEarth(ex: number, ey: number): void {
    const sx = this.scaleX;
    const sy = this.scaleY;
    const r = EARTH_RADIUS * Math.min(sx, sy);

    // Ocean base
    this.gfx.fillStyle(0x1a4a7a, 1);
    this.gfx.fillCircle(ex, ey, r);

    // Continent blobs — fixed offsets relative to Earth centre (fraction of r)
    const blobs = [
      { ox: 0.05, oy: -0.25, rx: 0.28, ry: 0.38 }, // Africa/Europe
      { ox: -0.42, oy: -0.1,  rx: 0.22, ry: 0.45 }, // Americas
      { ox: 0.3,  oy: -0.3,  rx: 0.38, ry: 0.30 }, // Asia
      { ox: 0.0,  oy: 0.62,  rx: 0.45, ry: 0.18 }, // Antarctica
      { ox: 0.42, oy: 0.28,  rx: 0.20, ry: 0.16 }, // Australia
    ];
    this.gfx.fillStyle(0x2d6e3a, 1);
    for (const b of blobs) {
      this.gfx.fillEllipse(ex + b.ox * r, ey + b.oy * r, b.rx * r * 2, b.ry * r * 2);
    }

    // Polar caps
    this.gfx.fillStyle(0xc8dde8, 0.55);
    this.gfx.fillEllipse(ex, ey - r * 0.78, r * 0.7,  r * 0.32);
    this.gfx.fillEllipse(ex, ey + r * 0.82, r * 0.8,  r * 0.24);

    // Atmosphere glow ring
    this.gfx.lineStyle(3 * Math.min(sx, sy), 0xaad4f0, 0.3);
    this.gfx.strokeCircle(ex, ey, r + 4 * Math.min(sx, sy));

    // Label — added to labelGroup so it clears with everything else each frame
    const label = this.add
      .text(ex, ey, 'EARTH', {
        fontSize: `${Math.round(9 * sx)}px`,
        color: '#6ab0d8',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.labelGroup.add(label);
  }

  // ---------------------------------------------------------------------------
  // Main render loop
  // ---------------------------------------------------------------------------

  /**
   * Returns the ID of the node whose hit area contains (px, py), or null.
   * Hit radius is NODE_RADIUS + 8px (scaled), matching the old hit zone size.
   */
  private hitTestNode(px: number, py: number): string | null {
    const s = Math.min(this.scaleX, this.scaleY);
    const hitR = (NODE_RADIUS + 8) * s;
    for (const [id, pos] of Object.entries(NODE_POSITIONS)) {
      const cx = pos.x * this.scaleX + this.panX;
      const cy = pos.y * this.scaleY + this.panY;
      if (Math.hypot(px - cx, py - cy) <= hitR) return id;
    }
    return null;
  }

  private renderScene(): void {
    const nodes = this.callbacks!.getNodes();
    const selectedId = this.callbacks!.getSelectedNode();
    const completed = this.callbacks!.getCompletedProjects();
    const launchAllocation = this.callbacks!.getLaunchAllocation();
    const queue = this.callbacks!.getConstructionQueue();

    // Build a quick lookup: spaceNodeId → action
    const constructionByNode = new Map<string, OngoingAction>();
    for (const action of queue) {
      if (action.spaceNodeId) constructionByNode.set(action.spaceNodeId, action);
    }

    this.gfx.clear();
    this.labelGroup.clear(true, true);

    // Pan-aware Earth position — distinct from the LEO node, below it
    const leoX = EARTH_POS.x * this.scaleX + this.panX;
    const leoY = EARTH_POS.y * this.scaleY + this.panY;

    // Connection lines
    this.gfx.lineStyle(1, 0x1a3050, 0.6);
    for (const [aId, bId] of CONNECTIONS) {
      const aPos = NODE_POSITIONS[aId];
      const bPos = NODE_POSITIONS[bId];
      if (!aPos || !bPos) continue;
      this.gfx.beginPath();
      this.gfx.moveTo(aPos.x * this.scaleX + this.panX, aPos.y * this.scaleY + this.panY);
      this.gfx.lineTo(bPos.x * this.scaleX + this.panX, bPos.y * this.scaleY + this.panY);
      this.gfx.strokePath();
    }

    // Orbit arcs first, then Earth on top (masks lower half of arc), then nodes on top of all
    this.drawEarthOrbitArc(leoX, leoY, completed);
    this.drawMoonOrbitArc(nodes);
    this.drawEarth(leoX, leoY);

    // Nodes
    for (const node of nodes) {
      const pos = NODE_POSITIONS[node.id];
      if (!pos) continue;

      const cx = pos.x * this.scaleX + this.panX;
      const cy = pos.y * this.scaleY + this.panY;
      const r = NODE_RADIUS * Math.min(this.scaleX, this.scaleY);
      const isSelected = node.id === selectedId;
      const colour = NODE_COLOURS[node.type] ?? 0x6080a0;
      const hasFacility = node.facilityId !== null;
      const isInactive = hasFacility && launchAllocation[node.id] === false;
      const action = constructionByNode.get(node.id) ?? null;

      if (node.id === 'leo') {
        const stageCount = STATION_STAGES.filter((s) => completed.includes(s)).length;
        if (stageCount > 0) {
          this.drawOrbitalStation(cx, cy, r, stageCount, isSelected, isInactive);
        } else {
          this.drawPlainNode(cx, cy, r, colour, hasFacility, isSelected, isInactive);
        }
      } else {
        this.drawPlainNode(cx, cy, r, colour, hasFacility, isSelected, isInactive);
      }

      // Construction / upgrade overlay
      if (action) {
        this.drawConstructionOverlay(cx, cy, r, action);
      }

      // Launch cost label
      const costLabel = this.add
        .text(cx, cy + r + 4, `${node.launchCost}M`, {
          fontSize: `${Math.round(8 * this.scaleX)}px`,
          color: '#4a7090',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 0);
      this.labelGroup.add(costLabel);

      // Node name
      const nameLabel = this.add
        .text(cx, cy - r - 5, node.label, {
          fontSize: `${Math.round(9 * this.scaleX)}px`,
          color: isSelected ? '#88c8ff' : isInactive ? '#3a5060' : '#8aacca',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 1);
      this.labelGroup.add(nameLabel);
    }
  }

  // ---------------------------------------------------------------------------
  // Construction overlay — progress arc (mirrors EarthScene style)
  // ---------------------------------------------------------------------------

  private drawConstructionOverlay(cx: number, cy: number, r: number, action: OngoingAction): void {
    const progress = (action.totalTurns - action.turnsRemaining) / action.totalTurns;
    const fColor = SPACE_FACILITY_COLORS[action.facilityDefId] ?? 0xaaaaaa;
    const arcEnd = Phaser.Math.DegToRad(-90 + 360 * progress);
    const pulse = 0.45 + 0.3 * Math.sin(this.time.now * 0.004);

    // Pulsing inner ring (scaffold indicator)
    this.gfx.lineStyle(1.5, fColor, pulse);
    this.gfx.strokeCircle(cx, cy, r * 0.55);

    // Progress arc filling clockwise from top, drawn just outside the node
    this.gfx.lineStyle(2.5, fColor, 0.85);
    this.gfx.beginPath();
    this.gfx.arc(cx, cy, r * 1.25, Phaser.Math.DegToRad(-90), arcEnd, false);
    this.gfx.strokePath();
  }

  // ---------------------------------------------------------------------------
  // Plain node
  // ---------------------------------------------------------------------------

  private drawPlainNode(
    cx: number, cy: number, r: number,
    colour: number, hasFacility: boolean, isSelected: boolean, isInactive = false
  ): void {
    if (isSelected) {
      this.gfx.lineStyle(2, 0x88c8ff, 0.9);
      this.gfx.strokeCircle(cx, cy, r + 5);
    }
    const alpha = isInactive ? 0.25 : (hasFacility ? 1 : 0.55);
    this.gfx.fillStyle(colour, alpha);
    this.gfx.fillCircle(cx, cy, r);
    this.gfx.lineStyle(1.5, isSelected ? 0x88c8ff : colour, isInactive ? 0.3 : 1);
    this.gfx.strokeCircle(cx, cy, r);
    if (hasFacility) {
      this.gfx.fillStyle(0xffffff, isInactive ? 0.2 : 0.85);
      this.gfx.fillCircle(cx, cy, r * 0.35);
    }
  }

  // ---------------------------------------------------------------------------
  // Orbital station (LEO node, stages 1–3)
  // ---------------------------------------------------------------------------

  private drawOrbitalStation(
    cx: number, cy: number, r: number,
    stageCount: number, isSelected: boolean, isInactive = false
  ): void {
    const s = Math.min(this.scaleX, this.scaleY);
    const stationAlpha = isInactive ? 0.25 : 1;

    if (isSelected) {
      this.gfx.lineStyle(2, 0x88c8ff, 0.9);
      this.gfx.strokeCircle(cx, cy, r + 5);
    }

    // Stage 1+: core module
    const cw = r * 0.55;
    const ch = r * 0.38;
    this.gfx.fillStyle(0x8ab8d8, stationAlpha);
    this.gfx.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
    this.gfx.lineStyle(1.5 * s, 0xaad4f0, stationAlpha);
    this.gfx.strokeRect(cx - cw, cy - ch, cw * 2, ch * 2);
    // Docking collar
    this.gfx.lineStyle(2 * s, 0xaad4f0, 0.8 * stationAlpha);
    this.gfx.beginPath();
    this.gfx.moveTo(cx, cy - ch);
    this.gfx.lineTo(cx, cy - ch - r * 0.3);
    this.gfx.strokePath();

    // Stage 2+: habitation ring
    if (stageCount >= 2) {
      this.gfx.lineStyle(2 * s, 0x60a0c8, 0.9 * stationAlpha);
      this.gfx.strokeEllipse(cx, cy, r * 2.2, r * 1.4);
    }

    // Stage 3: solar panel wings + glow
    if (stageCount >= 3) {
      const pw = r * 1.6;
      const ph = r * 0.22;
      const py = cy - r * 0.05;

      for (const side of [-1, 1]) {
        const px = side === -1 ? cx - cw - pw : cx + cw;
        this.gfx.fillStyle(0x3a6888, stationAlpha);
        this.gfx.fillRect(px, py - ph, pw, ph * 2);
        this.gfx.lineStyle(1 * s, 0x60a8d0, 0.8 * stationAlpha);
        this.gfx.strokeRect(px, py - ph, pw, ph * 2);
        this.gfx.lineStyle(0.5 * s, 0x60a8d0, 0.4 * stationAlpha);
        for (let i = 1; i < 3; i++) {
          const lx = px + (pw / 3) * i;
          this.gfx.beginPath();
          this.gfx.moveTo(lx, py - ph);
          this.gfx.lineTo(lx, py + ph);
          this.gfx.strokePath();
        }
      }

      this.gfx.lineStyle(6 * s, 0x88d4ff, 0.12);
      this.gfx.strokeCircle(cx, cy, r * 1.8);
    }
  }

  // ---------------------------------------------------------------------------
  // Earth orbit arc — auto-populated from completed projects
  // ---------------------------------------------------------------------------

  private drawEarthOrbitArc(ex: number, ey: number, completed: string[]): void {
    const s = Math.min(this.scaleX, this.scaleY);
    const arcRx = 110 * this.scaleX;
    const arcRy = 55 * this.scaleY;

    // Full ellipse — Earth is drawn after this arc in renderScene(), so it
    // naturally renders on top and masks the lower half of the ring.
    this.gfx.lineStyle(1 * s, 0x2a5878, 0.55);
    this.gfx.strokeEllipse(ex, ey, arcRx * 2, arcRy * 2);

    // Populated project icons
    for (const proj of EARTH_ORBIT_PROJECTS) {
      if (!completed.includes(proj.id)) continue;

      const rad = (proj.angle * Math.PI) / 180;
      const ix = ex + Math.cos(rad) * arcRx;
      const iy = ey + Math.sin(rad) * arcRy;

      if (proj.icon === 'telescope') {
        this.drawTelescopeIcon(ix, iy, s);
      } else if (proj.icon === 'hubble') {
        this.drawHubbleIcon(ix, iy, s);
      }

      // Label placed radially outside the arc
      const lx = ex + Math.cos(rad) * (arcRx + 18 * this.scaleX);
      const ly = ey + Math.sin(rad) * (arcRy + 18 * this.scaleY);
      const label = this.add
        .text(lx, ly, proj.label, {
          fontSize: `${Math.round(6.5 * this.scaleX)}px`,
          color: '#60b0a8',
          fontFamily: 'monospace',
          align: 'center',
        })
        .setOrigin(0.5, 0.5);
      this.labelGroup.add(label);
    }
  }

  private drawTelescopeIcon(cx: number, cy: number, s: number): void {
    // 3 small diamonds connected by dashes
    const dr = 2.5 * s;
    const spacing = 7 * s;
    const positions = [-spacing, 0, spacing];

    // Dashes between diamonds
    this.gfx.lineStyle(0.8 * s, 0x60b0a8, 0.4);
    for (let i = 0; i < positions.length - 1; i++) {
      const ax = cx + positions[i];
      const bx = cx + positions[i + 1];
      this.gfx.beginPath();
      this.gfx.moveTo(ax + dr, cy);
      this.gfx.lineTo(bx - dr, cy);
      this.gfx.strokePath();
    }

    this.gfx.fillStyle(0x60b0a8, 0.85);
    for (const ox of positions) {
      const ix = cx + ox;
      this.gfx.beginPath();
      this.gfx.moveTo(ix, cy - dr);
      this.gfx.lineTo(ix + dr, cy);
      this.gfx.lineTo(ix, cy + dr);
      this.gfx.lineTo(ix - dr, cy);
      this.gfx.closePath();
      this.gfx.fillPath();
    }
  }

  private drawHubbleIcon(cx: number, cy: number, s: number): void {
    // Single larger diamond with crosshair lines
    const dr = 4 * s;
    this.gfx.fillStyle(0xa0c8e0, 0.85);
    this.gfx.beginPath();
    this.gfx.moveTo(cx, cy - dr);
    this.gfx.lineTo(cx + dr, cy);
    this.gfx.lineTo(cx, cy + dr);
    this.gfx.lineTo(cx - dr, cy);
    this.gfx.closePath();
    this.gfx.fillPath();

    // Crosshair
    this.gfx.lineStyle(0.8 * s, 0xd0eeff, 0.6);
    this.gfx.beginPath();
    this.gfx.moveTo(cx - dr * 1.5, cy);
    this.gfx.lineTo(cx + dr * 1.5, cy);
    this.gfx.strokePath();
    this.gfx.beginPath();
    this.gfx.moveTo(cx, cy - dr * 1.5);
    this.gfx.lineTo(cx, cy + dr * 1.5);
    this.gfx.strokePath();
  }

  // ---------------------------------------------------------------------------
  // Moon orbit arc — always visible, auto-populated from future lunar projects
  // ---------------------------------------------------------------------------

  private drawMoonOrbitArc(nodes: SpaceNode[]): void {
    const lunarNode = nodes.find((n) => n.id === 'lunarSurface');
    if (!lunarNode) return;

    const pos = NODE_POSITIONS['lunarSurface'];
    const s = Math.min(this.scaleX, this.scaleY);
    const mx = pos.x * this.scaleX + this.panX;
    const my = pos.y * this.scaleY + this.panY;
    const arcRx = 38 * this.scaleX;
    const arcRy = 12 * this.scaleY;

    // Faint ring — full ellipse (moon is smaller, ring can wrap around)
    this.gfx.lineStyle(1 * s, 0x506070, 0.45);
    this.gfx.strokeEllipse(mx, my, arcRx * 2, arcRy * 2);

    // 3 slot positions (upper arc) — empty for now, ready for future projects
    // No icons drawn until lunar orbit projects are defined
  }

  // ---------------------------------------------------------------------------
  // Stars (static)
  // ---------------------------------------------------------------------------

  private drawStars(w: number, h: number): void {
    const starGfx = this.add.graphics();
    const stars = [
      [42, 18], [88, 52], [155, 31], [210, 75], [280, 22],
      [350, 44], [420, 15], [490, 67], [540, 38], [20, 88],
      [70, 120], [140, 95], [200, 140], [330, 100], [500, 120],
      [570, 85], [60, 170], [160, 155], [380, 165], [550, 175],
      [30, 200], [450, 210], [580, 195],
    ];
    for (const [sx, sy] of stars) {
      const opacity = ((sx * 7 + sy * 13) % 5) * 0.15 + 0.2;
      starGfx.fillStyle(0xffffff, opacity);
      starGfx.fillCircle((sx / 600) * w, (sy / 400) * h, 1);
    }
  }
}
