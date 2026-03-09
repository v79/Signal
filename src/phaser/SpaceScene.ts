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

    // Draw stars (deterministic using fixed list)
    this.drawStars(w, h);

    // Earth circle at bottom-centre
    const earthGfx = this.add.graphics();
    const ex = w / 2;
    const ey = h - 50;
    earthGfx.fillStyle(0x204060, 1);
    earthGfx.fillCircle(ex, ey, EARTH_RADIUS * this.scaleX);
    earthGfx.lineStyle(1.5, 0x3a6888, 1);
    earthGfx.strokeCircle(ex, ey, EARTH_RADIUS * this.scaleX);
    this.add
      .text(ex, ey, 'EARTH', {
        fontSize: `${Math.round(9 * this.scaleX)}px`,
        color: '#6aB0d8',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.game.events.emit('spaceSceneReady');
  }

  update(): void {
    if (!this.callbacks) return;
    this.renderScene();
  }

  private renderScene(): void {
    const nodes = this.callbacks!.getNodes();
    const selectedId = this.callbacks!.getSelectedNode();

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

      // Glow ring if selected
      if (isSelected) {
        this.gfx.lineStyle(2, 0x88c8ff, 0.9);
        this.gfx.strokeCircle(cx, cy, r + 5);
      }

      // Node body
      this.gfx.fillStyle(colour, hasFacility ? 1 : 0.55);
      this.gfx.fillCircle(cx, cy, r);
      this.gfx.lineStyle(1.5, isSelected ? 0x88c8ff : colour, 1);
      this.gfx.strokeCircle(cx, cy, r);

      // Facility dot
      if (hasFacility) {
        this.gfx.fillStyle(0xffffff, 0.85);
        this.gfx.fillCircle(cx, cy, r * 0.35);
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

  private drawStars(w: number, h: number): void {
    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xffffff, 1);
    // Fixed star positions derived from a simple hash — no RNG state consumed
    const stars = [
      [42, 18],
      [88, 52],
      [155, 31],
      [210, 75],
      [280, 22],
      [350, 44],
      [420, 15],
      [490, 67],
      [540, 38],
      [20, 88],
      [70, 120],
      [140, 95],
      [200, 140],
      [330, 100],
      [500, 120],
      [570, 85],
      [60, 170],
      [160, 155],
      [380, 165],
      [550, 175],
      [30, 200],
      [450, 210],
      [580, 195],
    ];
    for (const [sx, sy] of stars) {
      const opacity = ((sx * 7 + sy * 13) % 5) * 0.15 + 0.2;
      starGfx.fillStyle(0xffffff, opacity);
      starGfx.fillCircle((sx / 600) * w, (sy / 400) * h, 1);
    }
  }
}
