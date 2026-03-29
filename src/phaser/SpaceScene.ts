import Phaser from 'phaser';
import type { SpaceNode, FacilityInstance } from '../engine/types';

// ---------------------------------------------------------------------------
// SpaceScene — Near Space map (Era 2)
//
// A fixed set of orbital nodes connected by transit lines.
// Node positions are purely visual (canvas coordinates); game state for each
// node is read from SpaceNode via callbacks.
//
// Scene key: 'SpaceScene'
// ---------------------------------------------------------------------------

export interface SpaceSceneCallbacks {
  getNodes: () => SpaceNode[];
  getFacilities: () => FacilityInstance[];
  getSelectedNode: () => string | null;
  onNodeClick: (id: string) => void;
  getCompletedProjects: () => string[];
}

// Fixed canvas positions for each node id (normalised to 600 × 400 logical px)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  leo: { x: 300, y: 240 },
  l1: { x: 110, y: 230 },
  l2: { x: 490, y: 230 },
  lunarOrbit: { x: 300, y: 130 },
  lunarSurface: { x: 300, y: 60 },
};

// Which nodes are directly connected by transit lines
const CONNECTIONS: [string, string][] = [
  ['leo', 'l1'],
  ['leo', 'l2'],
  ['leo', 'lunarOrbit'],
  ['lunarOrbit', 'lunarSurface'],
];

// Type colours
const NODE_COLOURS: Record<string, number> = {
  lowEarthOrbit: 0x4a90c0,
  lagrangePoint: 0x7a60c0,
  lunarOrbit: 0x8090a0,
  lunarSurface: 0xb0b8c0,
};

const NODE_RADIUS = 18;
const EARTH_RADIUS = 40;

// Orbital station stage project IDs in order
const STATION_STAGES = [
  'orbitalStation_stage1',
  'orbitalStation_stage2',
  'orbitalStation_stage3',
];

export class SpaceScene extends Phaser.Scene {
  private callbacks: SpaceSceneCallbacks | null = null;
  private gfx!: Phaser.GameObjects.Graphics;
  private labelGroup!: Phaser.GameObjects.Group;
  private hitZones: Phaser.GameObjects.Arc[] = [];
  private scaleX = 1;
  private scaleY = 1;

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
    this.drawEarth(w, h);

    this.game.events.emit('spaceSceneReady');
  }

  update(): void {
    if (!this.callbacks) return;
    this.renderScene();
  }

  // ---------------------------------------------------------------------------
  // Earth
  // ---------------------------------------------------------------------------

  private drawEarth(w: number, h: number): void {
    const sx = this.scaleX;
    const sy = this.scaleY;
    const ex = w / 2;
    const ey = h - 50 * sy;
    const r = EARTH_RADIUS * Math.min(sx, sy);

    const g = this.add.graphics();

    // Ocean base
    g.fillStyle(0x1a4a7a, 1);
    g.fillCircle(ex, ey, r);

    // Continent blobs — fixed positions (logical, pre-scale)
    // Expressed as offsets from earth centre in logical coords, scaled to radius
    const blobs: { ox: number; oy: number; rx: number; ry: number; angle: number }[] = [
      // Africa / Europe
      { ox: 0.05, oy: -0.25, rx: 0.28, ry: 0.38, angle: 10 },
      // Americas
      { ox: -0.42, oy: -0.1, rx: 0.22, ry: 0.45, angle: -15 },
      // Asia
      { ox: 0.3, oy: -0.3, rx: 0.38, ry: 0.3, angle: 5 },
      // Antarctica
      { ox: 0.0, oy: 0.62, rx: 0.45, ry: 0.18, angle: 0 },
      // Australia
      { ox: 0.42, oy: 0.28, rx: 0.2, ry: 0.16, angle: 8 },
    ];

    g.fillStyle(0x2d6e3a, 1);
    for (const b of blobs) {
      // Save/restore matrix for rotation
      const cx = ex + b.ox * r;
      const cy = ey + b.oy * r;
      const bw = b.rx * r;
      const bh = b.ry * r;
      // Clip to earth circle by drawing an ellipse — Phaser doesn't have
      // a native clipping API in Graphics, so we use overlapping ellipses
      // that stay visually inside the circle due to small sizes.
      g.fillEllipse(cx, cy, bw * 2, bh * 2);
    }

    // Polar caps
    g.fillStyle(0xc8dde8, 0.55);
    g.fillEllipse(ex, ey - r * 0.78, r * 0.7, r * 0.32);
    g.fillEllipse(ex, ey + r * 0.82, r * 0.8, r * 0.24);

    // Atmosphere glow ring
    g.lineStyle(3 * Math.min(sx, sy), 0xaad4f0, 0.3);
    g.strokeCircle(ex, ey, r + 4 * Math.min(sx, sy));

    // Label
    this.add
      .text(ex, ey, 'EARTH', {
        fontSize: `${Math.round(9 * sx)}px`,
        color: '#6ab0d8',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
  }

  // ---------------------------------------------------------------------------
  // Main render loop
  // ---------------------------------------------------------------------------

  private renderScene(): void {
    const nodes = this.callbacks!.getNodes();
    const selectedId = this.callbacks!.getSelectedNode();
    const completed = this.callbacks!.getCompletedProjects();

    this.gfx.clear();
    this.hitZones.forEach((z) => z.destroy());
    this.hitZones = [];
    this.labelGroup.clear(true, true);

    // Connection lines
    this.gfx.lineStyle(1, 0x1a3050, 0.6);
    for (const [aId, bId] of CONNECTIONS) {
      const aPos = NODE_POSITIONS[aId];
      const bPos = NODE_POSITIONS[bId];
      if (!aPos || !bPos) continue;
      this.gfx.beginPath();
      this.gfx.moveTo(aPos.x * this.scaleX, aPos.y * this.scaleY);
      this.gfx.lineTo(bPos.x * this.scaleX, bPos.y * this.scaleY);
      this.gfx.strokePath();
    }

    // Telescope array (drawn before nodes so it sits behind labels)
    this.drawTelescopeArray(completed, selectedId === 'leo');

    // Nodes
    for (const node of nodes) {
      const pos = NODE_POSITIONS[node.id];
      if (!pos) continue;

      const cx = pos.x * this.scaleX;
      const cy = pos.y * this.scaleY;
      const r = NODE_RADIUS * Math.min(this.scaleX, this.scaleY);
      const isSelected = node.id === selectedId;
      const colour = NODE_COLOURS[node.type] ?? 0x6080a0;
      const hasFacility = node.facilityId !== null;

      if (node.id === 'leo') {
        const stageCount = STATION_STAGES.filter((s) => completed.includes(s)).length;
        if (stageCount > 0) {
          this.drawOrbitalStation(cx, cy, r, stageCount, isSelected);
        } else {
          this.drawPlainNode(cx, cy, r, colour, hasFacility, isSelected);
        }
      } else {
        this.drawPlainNode(cx, cy, r, colour, hasFacility, isSelected);
      }

      // Launch cost label under node
      const costLabel = this.add
        .text(cx, cy + r + 4, `${node.launchCost}M`, {
          fontSize: `${Math.round(8 * this.scaleX)}px`,
          color: '#4a7090',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 0);
      this.labelGroup.add(costLabel);

      // Node name above
      const nameLabel = this.add
        .text(cx, cy - r - 5, node.label, {
          fontSize: `${Math.round(9 * this.scaleX)}px`,
          color: isSelected ? '#88c8ff' : '#8aacca',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 1);
      this.labelGroup.add(nameLabel);

      // Invisible hit zone
      const hit = this.add.circle(cx, cy, r + 8, 0xffffff, 0);
      hit.setInteractive({ cursor: 'pointer' });
      hit.on('pointerup', () => this.callbacks?.onNodeClick(node.id));
      hit.on('pointerover', () => {
        this.gfx.lineStyle(1.5, 0x6aaad8, 0.8);
        this.gfx.strokeCircle(cx, cy, r + 3);
      });
      this.hitZones.push(hit);
    }
  }

  // ---------------------------------------------------------------------------
  // Plain node (non-station)
  // ---------------------------------------------------------------------------

  private drawPlainNode(
    cx: number,
    cy: number,
    r: number,
    colour: number,
    hasFacility: boolean,
    isSelected: boolean
  ): void {
    if (isSelected) {
      this.gfx.lineStyle(2, 0x88c8ff, 0.9);
      this.gfx.strokeCircle(cx, cy, r + 5);
    }
    this.gfx.fillStyle(colour, hasFacility ? 1 : 0.55);
    this.gfx.fillCircle(cx, cy, r);
    this.gfx.lineStyle(1.5, isSelected ? 0x88c8ff : colour, 1);
    this.gfx.strokeCircle(cx, cy, r);
    if (hasFacility) {
      this.gfx.fillStyle(0xffffff, 0.85);
      this.gfx.fillCircle(cx, cy, r * 0.35);
    }
  }

  // ---------------------------------------------------------------------------
  // Orbital station (LEO node, 1–3 stages)
  // ---------------------------------------------------------------------------

  private drawOrbitalStation(
    cx: number,
    cy: number,
    r: number,
    stageCount: number,
    isSelected: boolean
  ): void {
    const s = Math.min(this.scaleX, this.scaleY);

    // Selection ring
    if (isSelected) {
      this.gfx.lineStyle(2, 0x88c8ff, 0.9);
      this.gfx.strokeCircle(cx, cy, r + 5);
    }

    // Stage 1+: central core module — a small filled rect with a docking collar line
    const cw = r * 0.55; // half-width
    const ch = r * 0.38; // half-height
    this.gfx.fillStyle(0x8ab8d8, 1);
    this.gfx.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
    this.gfx.lineStyle(1.5 * s, 0xaad4f0, 1);
    this.gfx.strokeRect(cx - cw, cy - ch, cw * 2, ch * 2);
    // Docking collar — short vertical line top and bottom
    this.gfx.lineStyle(2 * s, 0xaad4f0, 0.8);
    this.gfx.beginPath();
    this.gfx.moveTo(cx, cy - ch);
    this.gfx.lineTo(cx, cy - ch - r * 0.3);
    this.gfx.strokePath();

    // Stage 2+: habitation ring — full ellipse around the core
    if (stageCount >= 2) {
      this.gfx.lineStyle(2 * s, 0x60a0c8, 0.9);
      this.gfx.strokeEllipse(cx, cy, r * 2.2, r * 1.4);
    }

    // Stage 3: solar panel wings + glow
    if (stageCount >= 3) {
      const pw = r * 1.6; // panel half-length
      const ph = r * 0.22; // panel half-height
      const py = cy - r * 0.05;

      // Left panel
      this.gfx.fillStyle(0x3a6888, 1);
      this.gfx.fillRect(cx - cw - pw, py - ph, pw, ph * 2);
      this.gfx.lineStyle(1 * s, 0x60a8d0, 0.8);
      this.gfx.strokeRect(cx - cw - pw, py - ph, pw, ph * 2);
      // Panel grid lines
      this.gfx.lineStyle(0.5 * s, 0x60a8d0, 0.4);
      for (let i = 1; i < 3; i++) {
        const lx = cx - cw - pw + (pw / 3) * i;
        this.gfx.beginPath();
        this.gfx.moveTo(lx, py - ph);
        this.gfx.lineTo(lx, py + ph);
        this.gfx.strokePath();
      }

      // Right panel
      this.gfx.fillStyle(0x3a6888, 1);
      this.gfx.fillRect(cx + cw, py - ph, pw, ph * 2);
      this.gfx.lineStyle(1 * s, 0x60a8d0, 0.8);
      this.gfx.strokeRect(cx + cw, py - ph, pw, ph * 2);
      for (let i = 1; i < 3; i++) {
        const lx = cx + cw + (pw / 3) * i;
        this.gfx.lineStyle(0.5 * s, 0x60a8d0, 0.4);
        this.gfx.beginPath();
        this.gfx.moveTo(lx, py - ph);
        this.gfx.lineTo(lx, py + ph);
        this.gfx.strokePath();
      }

      // Subtle glow ring
      this.gfx.lineStyle(6 * s, 0x88d4ff, 0.12);
      this.gfx.strokeCircle(cx, cy, r * 1.8);
    }
  }

  // ---------------------------------------------------------------------------
  // Orbital Telescope Array
  // ---------------------------------------------------------------------------

  private drawTelescopeArray(completed: string[], leoSelected: boolean): void {
    if (!completed.includes('orbitalTelescopeArray')) return;

    const s = Math.min(this.scaleX, this.scaleY);
    // Arc of 4 instrument dots above-right of LEO node.
    // Offset slightly further when LEO is selected to clear the glow ring.
    const leoPos = NODE_POSITIONS['leo'];
    const offsetY = leoSelected ? -8 : -4;

    // 4 instrument positions in logical coords (pre-scale), relative to scene
    const instruments = [
      { x: 248, y: leoPos.y + offsetY - 62 },
      { x: 270, y: leoPos.y + offsetY - 68 },
      { x: 292, y: leoPos.y + offsetY - 70 },
      { x: 314, y: leoPos.y + offsetY - 65 },
    ];

    // Connecting dashes between instruments
    this.gfx.lineStyle(1 * s, 0x60b0a8, 0.45);
    for (let i = 0; i < instruments.length - 1; i++) {
      const a = instruments[i];
      const b = instruments[i + 1];
      const ax = a.x * this.scaleX;
      const ay = a.y * this.scaleY;
      const bx = b.x * this.scaleX;
      const by = b.y * this.scaleY;
      // Draw short dashes manually
      const steps = 4;
      for (let d = 0; d < steps; d += 2) {
        const t0 = d / steps;
        const t1 = (d + 1) / steps;
        this.gfx.beginPath();
        this.gfx.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0);
        this.gfx.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
        this.gfx.strokePath();
      }
    }

    // Instrument diamonds
    this.gfx.fillStyle(0x60b0a8, 0.8);
    const dr = 3 * s;
    for (const inst of instruments) {
      const ix = inst.x * this.scaleX;
      const iy = inst.y * this.scaleY;
      this.gfx.beginPath();
      this.gfx.moveTo(ix, iy - dr);
      this.gfx.lineTo(ix + dr, iy);
      this.gfx.lineTo(ix, iy + dr);
      this.gfx.lineTo(ix - dr, iy);
      this.gfx.closePath();
      this.gfx.fillPath();
    }

    // Label
    const midX = ((instruments[0].x + instruments[3].x) / 2) * this.scaleX;
    const minY = Math.min(...instruments.map((i) => i.y)) * this.scaleY;
    const label = this.add
      .text(midX, minY - 6 * s, 'TELESCOPE ARRAY', {
        fontSize: `${Math.round(7 * this.scaleX)}px`,
        color: '#60b0a8',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 1);
    this.labelGroup.add(label);
  }

  // ---------------------------------------------------------------------------
  // Stars
  // ---------------------------------------------------------------------------

  private drawStars(w: number, h: number): void {
    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xffffff, 1);
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
