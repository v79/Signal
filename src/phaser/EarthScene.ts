import Phaser from 'phaser';
import type {
  MapTile,
  FacilityInstance,
  TileType,
  TileDestroyedStatus,
  OngoingAction,
} from '../engine/types';

// ---------------------------------------------------------------------------
// Tile visual constants
// ---------------------------------------------------------------------------

/** Flat-top hex size in pixels (centre to vertex). */
const HEX_SIZE = 42;

/** Base fill colours per tile type (flat-top hex). */
const TILE_FILL: Record<TileType, number> = {
  urban: 0x1e2d40,
  industrial: 0x2d1e10,
  coastal: 0x0f2840,
  highland: 0x1e2d1e,
  forested: 0x0f2d18,
  arid: 0x2d221a,
  agricultural: 0x182d0f,
};

/** Stroke (edge) colours — slightly lighter. */
const TILE_STROKE: Record<TileType, number> = {
  urban: 0x3a5878,
  industrial: 0x5a3820,
  coastal: 0x1a4870,
  highland: 0x3a5838,
  forested: 0x1a5830,
  arid: 0x5a4428,
  highland2: 0x3a5838, // alias (unused, for safety)
  agricultural: 0x2a5818,
} as Record<TileType, number>;

/** Overlay colour when a tile is destroyed. */
const DESTROYED_FILL: Record<TileDestroyedStatus, number> = {
  flooded: 0x0a1848,
  dustbowl: 0x482810,
  irradiated: 0x183010,
};

/** Flash colour for the damage animation when a tile is first destroyed. */
const DAMAGE_FLASH_COLOR: Record<TileDestroyedStatus, number> = {
  flooded: 0x60b0ff,
  dustbowl: 0xff8030,
  irradiated: 0x80ff50,
};

/** Facility indicator colours by defId. */
const FACILITY_COLORS: Record<string, number> = {
  hq: 0xd4a820,
  researchLab: 0x6aaad8,
  mine: 0xb06030,
  coalPowerStation: 0x806050,
  fissionPowerStation: 0xc05010,
  solarFarm: 0xd8c840,
  offshoreWindFarm: 0x40c8d8,
  publicUniversity: 0xa070d8,
  engineeringWorks: 0xd87840,
  bioresearchCentre: 0x50c878,
  socialPolicyUnit: 0x70a8d0,
  agriculturalResearchStation: 0x80c850,
  spaceLaunchCentre: 0x1a1a2e,
  dataCentre: 0x20d0a0,
  deepSpaceArray: 0x4060d8,
};

// ---------------------------------------------------------------------------
// Callbacks interface — injected from MapContainer so the scene never imports
// Svelte modules (avoids compile-time coupling with runes).
// ---------------------------------------------------------------------------

/** One directional adjacency indicator for a single hex edge. */
export interface AdjacencyIndicator {
  /** Axial direction toward the neighbour causing the effect. */
  direction: { q: number; r: number };
  type: 'bonus' | 'penalty';
}

export interface EarthSceneCallbacks {
  getTiles: () => MapTile[];
  getFacilities: () => FacilityInstance[];
  getQueue: () => OngoingAction[];
  getSelected: () => string | null;
  getClimate: () => number;
  /** Per-coordKey list of directional indicators to draw at each hex edge. */
  getAdjacencyMap: () => Map<string, AdjacencyIndicator[]>;
  onTileClick: (coordKey: string) => void;
  onTileHover: (coordKey: string | null) => void;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class EarthScene extends Phaser.Scene {
  private cb!: EarthSceneCallbacks;
  private tileGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private hoveredKey: string | null = null;

  // Damage flash animation state
  private prevDestroyedStatus = new Map<string, TileDestroyedStatus | null>();
  private flashingTiles = new Map<string, { startTime: number; color: number }>();
  private static readonly FLASH_DURATION = 1800; // ms

  // Camera pan state
  private camOffsetX = 0;
  private camOffsetY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCamX = 0;
  private dragStartCamY = 0;
  private isDragging = false;
  private dragMoved = false;
  private static readonly DRAG_THRESHOLD = 5; // px
  /** Timestamp until which left-click tile selection is suppressed (scene just started). */
  private clickSuppressUntil = 0;

  constructor() {
    super({ key: 'EarthScene' });
  }

  /** Called by MapContainer after scene is ready. */
  setCallbacks(cb: EarthSceneCallbacks): void {
    this.cb = cb;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    this.cameras.main.setBackgroundColor(0x060a10);
    // Suppress stale clicks that arrive in the same frame as scene start
    this.clickSuppressUntil = this.time.now + 100;

    this.tileGfx = this.add.graphics();
    this.overlayGfx = this.add.graphics();

    // Right-click drag-to-pan: record origin on right press, pan on move, release on right up
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.rightButtonDown()) return;
      this.dragStartX = ptr.x;
      this.dragStartY = ptr.y;
      this.dragStartCamX = this.camOffsetX;
      this.dragStartCamY = this.camOffsetY;
      this.isDragging = true;
      this.dragMoved = false;
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = ptr.x - this.dragStartX;
        const dy = ptr.y - this.dragStartY;
        if (!this.dragMoved && Math.hypot(dx, dy) > EarthScene.DRAG_THRESHOLD) {
          this.dragMoved = true;
        }
        if (this.dragMoved) {
          this.camOffsetX = this.dragStartCamX + dx;
          this.camOffsetY = this.dragStartCamY + dy;
          this.clampCamera();
        }
      }

      // Hover: suppress during drag so the cursor doesn't flicker
      const key = this.isDragging && this.dragMoved ? null : this.hitTest(ptr.x, ptr.y);
      if (key !== this.hoveredKey) {
        this.hoveredKey = key;
        if (this.cb) this.cb.onTileHover(key);
      }
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      // Only end a drag on right-button release; left clicks are unaffected
      if (ptr.rightButtonReleased()) {
        this.isDragging = false;
        // If the right button was released without a meaningful drag, do nothing
        // (right-click selection is intentionally not wired)
      }
    });

    // Left-click → select tile (completely independent of pan)
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.leftButtonDown()) return;
      if (this.time.now < this.clickSuppressUntil) return;
      const key = this.hitTest(ptr.x, ptr.y);
      if (key && this.cb) this.cb.onTileClick(key);
    });

    // Clear hover and cancel drag when pointer leaves the canvas
    this.input.on('pointerout', () => {
      this.isDragging = false;
      this.dragMoved = false;
      if (this.hoveredKey !== null) {
        this.hoveredKey = null;
        if (this.cb) this.cb.onTileHover(null);
      }
    });

    // Suppress the browser context menu on the Phaser canvas
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(): void {
    this.renderAll();
  }

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------

  /**
   * Clamp `camOffsetX/Y` so the map can't be panned completely off-screen.
   * Keeps at least one hex-width of the map visible on each side.
   */
  private clampCamera(): void {
    if (!this.cb) return;
    const tiles = this.cb.getTiles();
    if (tiles.length === 0) return;

    // Compute the bounding box of all tile centres in un-offset map space
    const sqrt3 = Math.sqrt(3);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of tiles) {
      const tx = HEX_SIZE * 1.5 * t.coord.q;
      const ty = HEX_SIZE * ((sqrt3 / 2) * t.coord.q + sqrt3 * t.coord.r);
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    }

    // Pad by one hex to keep the edge tiles fully visible
    const pad = HEX_SIZE * 2;
    const hw = this.scale.width / 2;
    const hh = this.scale.height / 2;

    // Offset must keep the map extent within [−hw+pad, hw−pad] of viewport centre
    this.camOffsetX = Math.min(hw - minX - pad, Math.max(-hw - maxX + pad, this.camOffsetX));
    this.camOffsetY = Math.min(hh - minY - pad, Math.max(-hh - maxY + pad, this.camOffsetY));
  }

  // ---------------------------------------------------------------------------
  // Hex geometry helpers
  // ---------------------------------------------------------------------------

  /** World position of the centre of a flat-top hex at axial (q, r). */
  private hexCenter(q: number, r: number): { x: number; y: number } {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    return {
      x: cx + this.camOffsetX + HEX_SIZE * (1.5 * q),
      y: cy + this.camOffsetY + HEX_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
    };
  }

  /**
   * Vertices of a flat-top hexagon centred at (cx, cy).
   * Returns [x0,y0, x1,y1, ...] for Phaser fillPoints.
   */
  private hexVertices(cx: number, cy: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      pts.push({ x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) });
    }
    return pts;
  }

  /**
   * Axial cube-rounding hit-test: returns the coordKey of the hex that
   * contains pixel (px, py), or null if no tile exists there.
   */
  private hitTest(px: number, py: number): string | null {
    if (!this.cb) return null;
    const cx = px - this.scale.width / 2 - this.camOffsetX;
    const cy = py - this.scale.height / 2 - this.camOffsetY;

    // Inverse of the flat-top hex formula
    const fq = ((2 / 3) * cx) / HEX_SIZE;
    const fr = ((-1 / 3) * cx + (Math.sqrt(3) / 3) * cy) / HEX_SIZE;
    const fs = -fq - fr;

    let q = Math.round(fq);
    let r = Math.round(fr);
    const s = Math.round(fs);

    const dq = Math.abs(q - fq);
    const dr = Math.abs(r - fr);
    const ds = Math.abs(s - fs);

    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;

    const key = `${q},${r}`;
    const tiles = this.cb.getTiles();
    return tiles.some((t) => t.coord.q === q && t.coord.r === r) ? key : null;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderAll(): void {
    if (!this.cb) return;

    this.tileGfx.clear();
    this.overlayGfx.clear();

    const tiles = this.cb.getTiles();
    const facilities = this.cb.getFacilities();
    const queue = this.cb.getQueue();
    const selected = this.cb.getSelected();
    const climate = this.cb.getClimate(); // 0–100
    const adjacencyMap = this.cb.getAdjacencyMap();
    const now = this.time.now;

    // Detect newly destroyed tiles and start flash animations
    for (const tile of tiles) {
      const key = `${tile.coord.q},${tile.coord.r}`;
      const prev = this.prevDestroyedStatus.get(key) ?? null;
      const curr = tile.destroyedStatus;
      if (curr !== null && curr !== prev) {
        this.flashingTiles.set(key, { startTime: now, color: DAMAGE_FLASH_COLOR[curr] });
      }
      this.prevDestroyedStatus.set(key, curr);
    }

    // Prune expired flashes
    for (const [key, flash] of this.flashingTiles) {
      if (now - flash.startTime > EarthScene.FLASH_DURATION) {
        this.flashingTiles.delete(key);
      }
    }

    const facilityById = new Map(facilities.map((f) => [f.id, f]));
    const queueMap = new Map(queue.map((a) => [a.coordKey, a]));

    for (const tile of tiles) {
      const key = `${tile.coord.q},${tile.coord.r}`;
      const { x, y } = this.hexCenter(tile.coord.q, tile.coord.r);
      const verts = this.hexVertices(x, y);
      // Resolve each slot to its FacilityInstance (multi-slot facilities repeat the same instance across slots)
      const slotInstances: (import('../engine/types').FacilityInstance | null)[] = tile.facilitySlots.map((id) =>
        id ? (facilityById.get(id) ?? null) : null,
      );
      const action = queueMap.get(key) ?? null;
      const isHovered = key === this.hoveredKey;
      const isSelected = key === selected;
      const flash = this.flashingTiles.get(key) ?? null;

      this.drawTile(tile, verts, x, y, isHovered, isSelected, slotInstances, action, climate, adjacencyMap.get(key) ?? [], flash, now);
    }
  }

  private drawTile(
    tile: MapTile,
    verts: { x: number; y: number }[],
    cx: number,
    cy: number,
    hovered: boolean,
    selected: boolean,
    slotInstances: (FacilityInstance | null)[],
    action: OngoingAction | null,
    climate: number,
    adjacency: AdjacencyIndicator[],
    flash: { startTime: number; color: number } | null,
    now: number,
  ): void {
    const baseFill = TILE_FILL[tile.type] ?? 0x1e2d40;
    const baseStroke = TILE_STROKE[tile.type] ?? 0x3a5878;

    // Productivity darkening: 0.4 at min productivity
    const prodAlpha = 0.4 + tile.productivity * 0.6;

    // Draw hex fill
    this.tileGfx.fillStyle(baseFill, prodAlpha);
    this.tileGfx.fillPoints(verts, true);

    // Destroyed overlay
    if (tile.destroyedStatus) {
      this.tileGfx.fillStyle(DESTROYED_FILL[tile.destroyedStatus], 0.55);
      this.tileGfx.fillPoints(verts, true);
    }

    // Stroke
    const strokeAlpha = selected ? 1.0 : hovered ? 0.85 : 0.4;
    const strokeColor = selected ? 0x88c8ff : hovered ? 0x6aaad8 : baseStroke;
    const strokeW = selected ? 2.5 : hovered ? 1.5 : 1.0;
    this.tileGfx.lineStyle(strokeW, strokeColor, strokeAlpha);
    this.tileGfx.strokePoints(verts, true);

    // Facility slots — circle-cluster rendering
    {
      const CIRCLE_OFFSETS: [number, number][][] = [
        [[0, 0]],
        [[-11, 0], [11, 0]],
        [[0, -11], [-11, 9], [11, 9]],
      ];
      const CIRCLE_RADIUS = 10;

      // Deduplicate slot instances to unique facilities
      const unique = [...new Map(
        slotInstances.filter(Boolean).map(f => [f!.id, f!])
      ).values()];

      const isHq = unique.some(f => f.defId === 'hq');

      if (isHq) {
        // Large gold circle + cross + outer ring
        this.overlayGfx.fillStyle(FACILITY_COLORS['hq'] ?? 0xffd060, 0.9);
        this.overlayGfx.fillCircle(cx, cy, 16);
        const arm = HEX_SIZE * 0.18;
        this.overlayGfx.lineStyle(1.5, 0xfff0c0, 0.85);
        this.overlayGfx.lineBetween(cx - arm, cy, cx + arm, cy);
        this.overlayGfx.lineBetween(cx, cy - arm, cx, cy + arm);
        this.overlayGfx.lineStyle(1.5, 0xffd060, 0.5);
        this.overlayGfx.strokePoints(verts, true);
      } else if (unique.length > 0) {
        const offsets = CIRCLE_OFFSETS[unique.length - 1];
        for (let i = 0; i < unique.length; i++) {
          const [dx, dy] = offsets[i];
          const fColor = FACILITY_COLORS[unique[i].defId] ?? 0xffffff;
          const opacity = Math.max(0.4, unique[i].condition * 0.9);
          this.overlayGfx.fillStyle(fColor, opacity);
          this.overlayGfx.fillCircle(cx + dx, cy + dy, CIRCLE_RADIUS);
        }
      }
    }

    // Adjacency indicators — one small triangle per active edge, pointing toward the neighbour
    if (adjacency.length > 0) {
      // Inradius: distance from hex centre to edge midpoint (flat-top hex)
      const inradius = HEX_SIZE * (Math.sqrt(3) / 2);
      const triH = 5; // triangle height in px
      const triW = 5; // triangle base half-width in px

      for (const { direction, type } of adjacency) {
        // World-space vector toward neighbour centre (unnormalised)
        const vx = 1.5 * direction.q;
        const vy = (Math.sqrt(3) / 2) * direction.q + Math.sqrt(3) * direction.r;
        const angle = Math.atan2(vy, vx);

        // Edge midpoint — place the triangle centroid just inside the edge
        const ex = cx + inradius * 0.82 * Math.cos(angle);
        const ey = cy + inradius * 0.82 * Math.sin(angle);

        // Perpendicular direction (for base width)
        const px = Math.cos(angle + Math.PI / 2);
        const py = Math.sin(angle + Math.PI / 2);

        // Tip points outward toward the neighbour; base is behind it
        const tipX = ex + (triH * 0.67) * Math.cos(angle);
        const tipY = ey + (triH * 0.67) * Math.sin(angle);
        const b1x = ex - (triH * 0.33) * Math.cos(angle) + triW * px;
        const b1y = ey - (triH * 0.33) * Math.sin(angle) + triW * py;
        const b2x = ex - (triH * 0.33) * Math.cos(angle) - triW * px;
        const b2y = ey - (triH * 0.33) * Math.sin(angle) - triW * py;

        const color = type === 'bonus' ? 0xd4a820 : 0xd44040;
        this.overlayGfx.fillStyle(color, 0.85);
        this.overlayGfx.fillTriangle(tipX, tipY, b1x, b1y, b2x, b2y);
      }
    }

    // Construction / demolition overlay
    if (action) {
      const progress = (action.totalTurns - action.turnsRemaining) / action.totalTurns;
      const arcEnd = Phaser.Math.DegToRad(-90 + 360 * progress);

      if (action.type === 'construct') {
        // Scaffold: dashed-look ring in facility's colour, pulsed opacity
        const fColor = FACILITY_COLORS[action.facilityDefId] ?? 0xaaaaaa;
        const pulse = 0.45 + 0.3 * Math.sin(this.time.now * 0.004);
        this.overlayGfx.lineStyle(2, fColor, pulse);
        this.overlayGfx.strokeCircle(cx, cy, HEX_SIZE * 0.28);
        // Progress arc (fills clockwise from top)
        this.overlayGfx.lineStyle(2.5, fColor, 0.85);
        this.overlayGfx.beginPath();
        this.overlayGfx.arc(cx, cy, HEX_SIZE * 0.42, Phaser.Math.DegToRad(-90), arcEnd, false);
        this.overlayGfx.strokePath();
      } else {
        // Demolition: red cross-hatch over the facility indicator
        const r = HEX_SIZE * 0.22;
        this.overlayGfx.fillStyle(0x600000, 0.5);
        this.overlayGfx.fillCircle(cx, cy, r);
        const arm = r * 0.75;
        this.overlayGfx.lineStyle(2, 0xff4040, 0.9);
        this.overlayGfx.lineBetween(cx - arm, cy - arm, cx + arm, cy + arm);
        this.overlayGfx.lineBetween(cx + arm, cy - arm, cx - arm, cy + arm);
        // Progress arc (drains clockwise from top)
        const remaining = 1 - progress;
        const demArcEnd = Phaser.Math.DegToRad(-90 + 360 * remaining);
        this.overlayGfx.lineStyle(2, 0xff6060, 0.7);
        this.overlayGfx.beginPath();
        this.overlayGfx.arc(cx, cy, HEX_SIZE * 0.42, Phaser.Math.DegToRad(-90), demArcEnd, false);
        this.overlayGfx.strokePath();
      }
    }

    // Damage flash — 3 diminishing pulses over FLASH_DURATION ms
    if (flash) {
      const t = (now - flash.startTime) / EarthScene.FLASH_DURATION; // 0→1
      const alpha = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 0.8;
      if (alpha > 0.01) {
        this.tileGfx.fillStyle(flash.color, alpha);
        this.tileGfx.fillPoints(verts, true);
      }
    }

    // Selection pulse ring
    if (selected) {
      this.overlayGfx.lineStyle(1.5, 0x88c8ff, 0.5);
      this.overlayGfx.strokeCircle(cx, cy, HEX_SIZE * 0.7);
    }
  }
}
