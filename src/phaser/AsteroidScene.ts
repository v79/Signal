import Phaser from 'phaser';
import type { BeltNode, BeltEdge, FacilityInstance } from '../engine/types';

// ---------------------------------------------------------------------------
// AsteroidScene — Asteroid Belt / Deep Space map (Era 3)
//
// A node-graph renderer: named nodes connected by transit edges.
// Unprospected nodes show "?" and are drawn dimly.
// Node positions are purely visual (canvas coordinates).
//
// Scene key: 'AsteroidScene'
// ---------------------------------------------------------------------------

export interface AsteroidSceneCallbacks {
  getNodes: () => BeltNode[];
  getEdges: () => BeltEdge[];
  getFacilities: () => FacilityInstance[];
  getSelectedNode: () => string | null;
  onNodeClick: (id: string) => void;
}

// Fixed canvas positions for each node id (normalised to 600 × 400 logical px)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  ceres: { x: 300, y: 220 },
  vesta: { x: 150, y: 180 },
  psyche: { x: 450, y: 200 },
  europa: { x: 120, y: 100 },
  ganymede: { x: 300, y: 80 },
  trojans: { x: 535, y: 255 },
  heliopause: { x: 490, y: 80 },
};

// All potential transit connections (visual topology)
const CONNECTIONS: [string, string][] = [
  ['ceres', 'vesta'],
  ['ceres', 'psyche'],
  ['ceres', 'ganymede'],
  ['vesta', 'europa'],
  ['psyche', 'trojans'],
  ['psyche', 'heliopause'],
  ['ganymede', 'heliopause'],
];

const NODE_COLOURS: Record<string, number> = {
  asteroid: 0xa08060,
  jovianMoon: 0x6090a0,
  transitPoint: 0x705090,
  heliopause: 0x50a080,
  wormhole: 0x88ffcc,
};

const NODE_RADIUS = 16;

export class AsteroidScene extends Phaser.Scene {
  private callbacks: AsteroidSceneCallbacks | null = null;
  private gfx!: Phaser.GameObjects.Graphics;
  private labelGroup!: Phaser.GameObjects.Group;
  private hitZones: Phaser.GameObjects.Arc[] = [];
  private scaleX = 1;
  private scaleY = 1;

  constructor() {
    super({ key: 'AsteroidScene' });
  }

  setCallbacks(cb: AsteroidSceneCallbacks): void {
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

    // Directional label
    this.add
      .text(w / 2, h - 18, '\u2190 OUTER SOLAR SYSTEM', {
        fontSize: `${Math.round(8 * this.scaleX)}px`,
        color: '#253040',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.game.events.emit('asteroidSceneReady');
  }

  update(): void {
    if (!this.callbacks) return;
    this.renderScene();
  }

  private renderScene(): void {
    const nodes = this.callbacks!.getNodes();
    const edges = this.callbacks!.getEdges();
    const selectedId = this.callbacks!.getSelectedNode();

    this.gfx.clear();
    this.hitZones.forEach((z) => z.destroy());
    this.hitZones = [];
    this.labelGroup.clear(true, true);

    // Potential routes (very dim — show topology even before established)
    this.gfx.lineStyle(1, 0x1a2838, 0.35);
    for (const [aId, bId] of CONNECTIONS) {
      const aPos = NODE_POSITIONS[aId];
      const bPos = NODE_POSITIONS[bId];
      if (!aPos || !bPos) continue;
      this.gfx.beginPath();
      this.gfx.moveTo(aPos.x * this.scaleX, aPos.y * this.scaleY);
      this.gfx.lineTo(bPos.x * this.scaleX, bPos.y * this.scaleY);
      this.gfx.strokePath();
    }

    // Active transit routes (bright)
    this.gfx.lineStyle(1.5, 0x2a5070, 0.8);
    for (const edge of edges) {
      if (!edge.active) continue;
      const aPos = NODE_POSITIONS[edge.fromNodeId];
      const bPos = NODE_POSITIONS[edge.toNodeId];
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
      const colour = NODE_COLOURS[node.type] ?? 0x607080;
      const isProspected = node.prospected;

      // Glow ring if selected
      if (isSelected) {
        this.gfx.lineStyle(2, 0x88c8ff, 0.9);
        this.gfx.strokeCircle(cx, cy, r + 5);
      }

      // Node body — dim if unprospected
      this.gfx.fillStyle(colour, isProspected ? 1 : 0.3);
      this.gfx.fillCircle(cx, cy, r);
      this.gfx.lineStyle(1.5, isSelected ? 0x88c8ff : colour, isProspected ? 1 : 0.4);
      this.gfx.strokeCircle(cx, cy, r);

      // Facility dot
      if (node.facilityId !== null) {
        this.gfx.fillStyle(0xffffff, 0.85);
        this.gfx.fillCircle(cx, cy, r * 0.3);
      }

      // Label: "?" if unprospected
      const labelText = isProspected ? node.label : '?';
      const labelColour = isProspected ? (isSelected ? '#88c8ff' : '#8aacca') : '#2a3c50';

      const nameLabel = this.add
        .text(cx, cy - r - 5, labelText, {
          fontSize: `${Math.round(9 * this.scaleX)}px`,
          color: labelColour,
          fontFamily: 'monospace',
        })
        .setOrigin(0.5, 1);
      this.labelGroup.add(nameLabel);

      // Material yield hint for prospected nodes
      if (isProspected && node.materialYield !== null) {
        const yieldLabel = this.add
          .text(cx, cy + r + 4, `${node.materialYield}M/t`, {
            fontSize: `${Math.round(8 * this.scaleX)}px`,
            color: '#4a7090',
            fontFamily: 'monospace',
          })
          .setOrigin(0.5, 0);
        this.labelGroup.add(yieldLabel);
      }

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
    // Denser star field for deep space
    const stars = [
      [15, 25],
      [45, 12],
      [78, 38],
      [112, 15],
      [145, 55],
      [188, 22],
      [222, 42],
      [265, 18],
      [298, 52],
      [335, 28],
      [368, 48],
      [405, 15],
      [438, 35],
      [475, 58],
      [512, 22],
      [548, 42],
      [578, 12],
      [22, 65],
      [58, 88],
      [95, 72],
      [132, 95],
      [168, 70],
      [205, 92],
      [242, 65],
      [278, 88],
      [315, 72],
      [352, 95],
      [388, 68],
      [425, 88],
      [462, 72],
      [498, 90],
      [535, 65],
      [565, 88],
      [30, 130],
      [70, 145],
      [110, 125],
      [148, 148],
      [185, 130],
      [220, 150],
      [258, 128],
      [292, 145],
      [330, 132],
      [365, 155],
      [402, 138],
      [440, 155],
      [478, 135],
      [515, 152],
      [552, 130],
      [582, 150],
      [8, 170],
      [40, 185],
      [80, 175],
      [120, 190],
      [160, 168],
      [200, 185],
      [240, 172],
      [560, 170],
      [575, 190],
      [590, 175],
    ];
    for (const [sx, sy] of stars) {
      const opacity = ((sx * 11 + sy * 17) % 5) * 0.12 + 0.15;
      starGfx.fillStyle(0xffffff, opacity);
      starGfx.fillCircle((sx / 600) * w, (sy / 400) * h, 1);
    }
  }
}
