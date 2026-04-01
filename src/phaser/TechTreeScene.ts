// =============================================================================
// SIGNAL — Tech Tree Phaser Scene
//
// Rendered inside a dedicated Phaser.Game instance created by TechTreeModal.
// Data is injected via setData() rather than constructor args so the scene
// can be declared as a class reference in the Game config.
//
// Architecture: this scene never imports Svelte modules. All state is pushed
// in via setData(). The scene redraws synchronously on each setData() call.
//
// Camera: the world can be taller than the canvas. Use drag-to-pan and
// mouse-wheel / button zoom. Only the legend strip is fixed to the screen.
// =============================================================================

import Phaser from 'phaser';
import type {
  TechState,
  TechDef,
  SignalState,
  CardDef,
  FacilityDef,
  TechDiscoveryStage,
} from '../engine/types';
import { getTechTier } from '../engine/techTree';
import { FIELD_COLOURS_PHASER, FIELD_COLOURS_CSS, FIELD_ABBR } from '../lib/fieldColours';

// ---------------------------------------------------------------------------
// Public interface — passed in from TechTreeModal.svelte
// ---------------------------------------------------------------------------

export interface TechTreeSceneData {
  techs: TechState[];
  techDefs: Map<string, TechDef>;
  signal: SignalState;
  cardDefs: Map<string, CardDef>;
  facilityDefs: Map<string, FacilityDef>;
}

// ---------------------------------------------------------------------------
// Field colour constants — re-exported for backward compatibility
// ---------------------------------------------------------------------------

export { FIELD_COLOURS_PHASER as FIELD_COLOURS } from '../lib/fieldColours';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TOP_MARGIN = 52; // space above first node (tier headers live here)
const NODE_W = 188;
const NODE_H = 160;
const NODE_GAP = 14;
const WORLD_PAD_BOT = 24; // extra padding below last node in the world
const CORNER_R = 3;
const NODE_PAD = 13;
const BAR_H = 14;
const BAR_ROW_H = 22; // bar height + gap above next label
const LABEL_W = 32; // width reserved for field abbreviation label
const DOT_GRID_SPC = 26; // dot-grid spacing in px

// ---------------------------------------------------------------------------
// Zoom constants
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

// ---------------------------------------------------------------------------
// Colour palette — Phaser numeric colours (edit here to retheme)
// ---------------------------------------------------------------------------

// Scene background & structure
const C_BG_FILL = 0x050a10; // deep space canvas fill
const C_BG_DOT = 0x0f1e2a; // dot-grid dots
const C_COL_DIVIDER = 0x0d1e2a; // vertical column dividers
const C_HEADER_LINE = 0x1a3040; // tier header underline

// Node fills (by discovery stage)
const C_NODE_SIGNAL = 0x060d18; // signal-hidden
const C_NODE_UNKNOWN = 0x080d14; // unknown
const C_NODE_RUMOUR = 0x0c1828; // rumour
const C_NODE_PROGRESS = 0x0a1722; // in progress
const C_NODE_DISC = 0x0c1c14; // discovered

// Node borders (by discovery stage)
const C_BORDER_SIGNAL = 0x183650; // signal-hidden
const C_BORDER_UNKNOWN = 0x14222e; // unknown  (also legend dot for Unknown)
const C_BORDER_RUMOUR = 0x2a4460; // rumour   (also legend dot for Rumoured)

// Key accent colours
const C_GOLD = 0xd4a820; // discovered — border, glow, top accent, legend dot
const C_RUMOUR_DOT = 0x3a6888; // rumour indicator dot (cool blue — distinct from gold)

// Content chrome
const C_BAR_TRACK = 0x141e2a; // field bar track background
const C_REDACT_BAR = 0x141e28; // unknown redaction bars
const C_SEP_RUMOUR = 0x1e3448; // name separator in rumour nodes
const C_SEP_PROGRESS = 0x1e3040; // name separator in progress nodes
const C_SEP_DISC = 0x2a3c1a; // name separator in discovered nodes
const C_FIELD_FALLBACK = 0x4a6880; // field colour when field key is unrecognised

// Signal-hidden waveform
const C_WAVE_DIM = 0x204060; // back wave
const C_WAVE_MID = 0x2a5880; // middle wave
const C_WAVE_BRIGHT = 0x3a7098; // front wave
const C_WAVE_DOTS = 0x2a5070; // zero-crossing dots


// ---------------------------------------------------------------------------
// Font sizes — edit these to rescale all text in one place
// ---------------------------------------------------------------------------

/** Column headers ("TIER I", "TIER II" …) */
const FS_TIER_HEADER = '14px';
/** Technology names inside nodes (known stages). */
const FS_NODE_NAME = '13px';
/** Field abbreviation labels next to progress bars. */
const FS_FIELD_LABEL = '12px';
/** Secondary text: rumour descriptions, stage badges, signal labels, unlock list. */
const FS_SECONDARY = '11px';

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class TechTreeScene extends Phaser.Scene {
  private sceneData: TechTreeSceneData | null = null;

  // Two graphics layers: world scrolls with camera; ui is screen-fixed
  private worldGfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;

  private worldTextObjs: Phaser.GameObjects.Text[] = [];
  private uiTextObjs: Phaser.GameObjects.Text[] = [];

  private ready = false;
  private isDragging = false;
  private dragX = 0;
  private dragY = 0;
  private currentZoom = 1;
  private worldH = 600; // updated each redraw

  constructor() {
    super({ key: 'TechTreeScene' });
  }

  create(): void {
    this.worldGfx = this.add.graphics();

    this.uiGfx = this.add.graphics();
    this.uiGfx.setScrollFactor(0);

    this.setupInput();

    this.ready = true;
    if (this.sceneData) this.redraw();
  }

  /** Called from TechTreeModal after game is ready and on every prop change. */
  setData(data: TechTreeSceneData): void {
    this.sceneData = data;
    if (this.ready) this.redraw();
  }

  // -------------------------------------------------------------------------
  // Public zoom controls (called from HTML overlay buttons in the modal)
  // -------------------------------------------------------------------------

  zoomIn(): void {
    this.adjustZoom(+1);
  }

  zoomOut(): void {
    this.adjustZoom(-1);
  }

  resetZoom(): void {
    this.currentZoom = 1;
    this.cameras.main.setZoom(1);
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
  }

  // -------------------------------------------------------------------------
  // Input setup
  // -------------------------------------------------------------------------

  private setupInput(): void {
    const cam = this.cameras.main;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragX = p.x;
      this.dragY = p.y;
      this.input.setDefaultCursor('grabbing');
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      // Divide by zoom so a screen-pixel drag moves the correct world distance
      cam.scrollX -= (p.x - this.dragX) / this.currentZoom;
      cam.scrollY -= (p.y - this.dragY) / this.currentZoom;
      this.dragX = p.x;
      this.dragY = p.y;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.input.setDefaultCursor('grab');
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
      this.input.setDefaultCursor('grab');
    });

    // Mouse-wheel zoom (deltaY > 0 = scroll down = zoom out)
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
        this.adjustZoom(deltaY > 0 ? -1 : +1);
      },
    );

    this.input.setDefaultCursor('grab');
  }

  private adjustZoom(dir: 1 | -1): void {
    this.currentZoom = Phaser.Math.Clamp(this.currentZoom + dir * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
    this.cameras.main.setZoom(this.currentZoom);
    // Re-apply bounds so Phaser clamps scroll correctly at new zoom level
    this.cameras.main.setBounds(0, 0, this.scale.width, this.worldH);
  }

  // -------------------------------------------------------------------------
  // Redraw
  // -------------------------------------------------------------------------

  private redraw(): void {
    const d = this.sceneData!;
    const W = this.scale.width;
    const H = this.scale.height;

    this.worldGfx.clear();
    this.uiGfx.clear();
    this.clearAllTexts();

    // Group techs by tier (preserving TECH_DEFS insertion order within tier)
    const tierGroups = new Map<number, TechState[]>();
    for (const tech of d.techs) {
      const def = d.techDefs.get(tech.defId);
      if (!def) continue;
      const tier = getTechTier(def);
      if (!tierGroups.has(tier)) tierGroups.set(tier, []);
      tierGroups.get(tier)!.push(tech);
    }
    const maxTier = tierGroups.size > 0 ? Math.max(...tierGroups.keys()) : 4;
    const numTiers = Math.max(maxTier, 4);

    // Compute world height from the tier with the most nodes
    const maxNodes = Math.max(...[...tierGroups.values()].map((g) => g.length), 1);
    const contentH = maxNodes * NODE_H + Math.max(0, maxNodes - 1) * NODE_GAP;
    this.worldH = TOP_MARGIN + contentH + WORLD_PAD_BOT;

    // Update camera world bounds (preserves current scroll/zoom)
    this.cameras.main.setBounds(0, 0, W, this.worldH);

    // Column centres (one column per tier)
    const colCX: number[] = [];
    for (let i = 0; i < numTiers; i++) colCX.push((W / numTiers) * i + W / numTiers / 2);

    this.drawBackground(W, this.worldH);

    // Tier column header labels (world layer — they scroll with content)
    const TIER_LABEL_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    for (let i = 0; i < numTiers; i++) {
      this.worldGfx.lineStyle(1, C_HEADER_LINE, 0.6);
      this.worldGfx.lineBetween(
        colCX[i] - NODE_W / 2 + 6,
        TOP_MARGIN - 6,
        colCX[i] + NODE_W / 2 - 6,
        TOP_MARGIN - 6,
      );

      this.addWorldText(colCX[i], 14, `TIER  ${TIER_LABEL_NAMES[i] ?? i + 1}`, {
        fontFamily: 'monospace',
        fontSize: FS_TIER_HEADER,
        color: '#4a8092',
        align: 'center',
        letterSpacing: 3,
      }).setOrigin(0.5, 0);
    }

    // Compute node top-left positions for all techs (needed for arrows)
    const nodePositions = new Map<string, { x: number; y: number }>();
    for (let tier = 1; tier <= numTiers; tier++) {
      const techs = tierGroups.get(tier) ?? [];
      if (techs.length === 0) continue;
      const totalH = techs.length * NODE_H + Math.max(0, techs.length - 1) * NODE_GAP;
      const startY = TOP_MARGIN + (contentH - totalH) / 2;
      const nodeX = colCX[tier - 1] - NODE_W / 2;
      for (let j = 0; j < techs.length; j++) {
        nodePositions.set(techs[j].defId, { x: nodeX, y: startY + j * (NODE_H + NODE_GAP) });
      }
    }

    // Draw dependency arrows beneath nodes
    this.drawDependencyArrows(d, nodePositions);

    // Draw nodes — vertically centred within content height
    for (let tier = 1; tier <= numTiers; tier++) {
      for (const tech of (tierGroups.get(tier) ?? [])) {
        const pos = nodePositions.get(tech.defId)!;
        this.drawNode(tech, d, pos.x, pos.y);
      }
    }

  }

  // -------------------------------------------------------------------------
  // Dependency arrows (drawn before nodes so they appear behind)
  // -------------------------------------------------------------------------

  private drawDependencyArrows(
    d: TechTreeSceneData,
    nodePositions: Map<string, { x: number; y: number }>,
  ): void {
    const ARROW_SIZE = 5;

    for (const tech of d.techs) {
      const def = d.techDefs.get(tech.defId);
      if (!def || def.requiredTechIds.length === 0) continue;

      const targetPos = nodePositions.get(tech.defId);
      if (!targetPos) continue;

      const targetLeft = targetPos.x;
      const targetMidY = targetPos.y + NODE_H / 2;

      for (const reqId of def.requiredTechIds) {
        const sourcePos = nodePositions.get(reqId);
        if (!sourcePos) continue;

        const sourceRight = sourcePos.x + NODE_W;
        const sourceMidY = sourcePos.y + NODE_H / 2;

        // Colour based on prerequisite stage and relationship status
        const reqTech = d.techs.find((t) => t.defId === reqId);
        const reqStage = reqTech?.stage ?? 'unknown';
        let lineColor: number;
        let lineAlpha: number;

        if (
          reqStage === 'discovered' &&
          (tech.stage === 'progress' || tech.stage === 'discovered')
        ) {
          lineColor = 0x6aacca; // active connection — bright blue
          lineAlpha = 0.85;
        } else if (reqStage === 'discovered' || reqStage === 'progress') {
          lineColor = 0x2a6090; // prerequisite met — medium blue
          lineAlpha = 0.65;
        } else {
          lineColor = 0x1e3040; // undiscovered — dim
          lineAlpha = 0.5;
        }

        // Cubic bezier approximated as line segments (Phaser Graphics types lack bezierCurveTo)
        const cpX = sourceRight + (targetLeft - sourceRight) * 0.5;
        const STEPS = 20;

        this.worldGfx.lineStyle(1.5, lineColor, lineAlpha);
        this.worldGfx.beginPath();
        this.worldGfx.moveTo(sourceRight, sourceMidY);
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const mt = 1 - t;
          const bx =
            mt * mt * mt * sourceRight +
            3 * mt * mt * t * cpX +
            3 * mt * t * t * cpX +
            t * t * t * targetLeft;
          const by =
            mt * mt * mt * sourceMidY +
            3 * mt * mt * t * sourceMidY +
            3 * mt * t * t * targetMidY +
            t * t * t * targetMidY;
          this.worldGfx.lineTo(bx, by);
        }
        this.worldGfx.strokePath();

        // Arrow head — small filled triangle pointing right at target
        this.worldGfx.fillStyle(lineColor, lineAlpha);
        this.worldGfx.fillTriangle(
          targetLeft,
          targetMidY,
          targetLeft - ARROW_SIZE,
          targetMidY - ARROW_SIZE / 2,
          targetLeft - ARROW_SIZE,
          targetMidY + ARROW_SIZE / 2,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Background: dot grid + column dividers (world layer)
  // -------------------------------------------------------------------------

  private drawBackground(W: number, worldH: number): void {
    // Base fill covers the full world
    this.worldGfx.fillStyle(C_BG_FILL, 1);
    this.worldGfx.fillRect(0, 0, W, worldH);

    // Dot grid
    this.worldGfx.fillStyle(C_BG_DOT, 1);
    for (let gx = DOT_GRID_SPC; gx < W; gx += DOT_GRID_SPC) {
      for (let gy = DOT_GRID_SPC; gy < worldH; gy += DOT_GRID_SPC) {
        this.worldGfx.fillRect(gx, gy, 1, 1);
      }
    }

    // Vertical column dividers between tier columns
    const colW = W / 4;
    this.worldGfx.lineStyle(1, C_COL_DIVIDER, 1);
    for (let i = 1; i < 4; i++) {
      this.worldGfx.lineBetween(colW * i, TOP_MARGIN - 10, colW * i, worldH);
    }
  }

  // -------------------------------------------------------------------------
  // Node drawing
  // -------------------------------------------------------------------------

  private drawNode(tech: TechState, d: TechTreeSceneData, x: number, y: number): void {
    const def = d.techDefs.get(tech.defId);
    if (!def) return;

    const signalHidden = def.signalDerived && d.signal.eraStrength === 'faint';
    const effectiveStage: TechDiscoveryStage | 'signal-hidden' = signalHidden
      ? 'signal-hidden'
      : tech.stage;

    const { fill, border, borderAlpha } = this.stageStyle(effectiveStage, def);

    // Multi-layer glow for discovered
    if (effectiveStage === 'discovered') {
      this.worldGfx.fillStyle(C_GOLD, 0.07);
      this.worldGfx.fillCircle(x + NODE_W / 2, y + NODE_H / 2, NODE_W * 0.72);
      this.worldGfx.fillStyle(C_GOLD, 0.04);
      this.worldGfx.fillCircle(x + NODE_W / 2, y + NODE_H / 2, NODE_W * 0.9);
    }

    // Progress nodes: faint field-colour inner glow
    if (effectiveStage === 'progress') {
      this.worldGfx.fillStyle(this.dominantFieldColor(def), 0.04);
      this.worldGfx.fillCircle(x + NODE_W / 2, y + NODE_H / 2, NODE_W * 0.6);
    }

    // Node body
    this.worldGfx.fillStyle(fill, 1);
    this.worldGfx.fillRoundedRect(x, y, NODE_W, NODE_H, CORNER_R);
    this.worldGfx.lineStyle(1, border, borderAlpha);
    this.worldGfx.strokeRoundedRect(x, y, NODE_W, NODE_H, CORNER_R);

    switch (effectiveStage) {
      case 'signal-hidden':
        this.drawSignalHiddenContent(x, y);
        break;
      case 'unknown':
        this.drawUnknownContent(x, y);
        break;
      case 'rumour':
        this.drawRumourContent(def, x, y);
        break;
      case 'progress':
        this.drawProgressContent(def, tech, d, x, y);
        break;
      case 'discovered':
        this.drawDiscoveredContent(def, tech, d, x, y);
        break;
    }

    // Breakthrough indicator: small ⚡ marker in bottom-left corner
    if (tech.unlockedByBreakthrough) {
      this.addWorldText(x + 6, y + NODE_H - 14, '⚡', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#8ab8d0',
      })
        .setOrigin(0, 1)
        .setAlpha(0.7);
    }
  }

  private stageStyle(
    stage: TechDiscoveryStage | 'signal-hidden',
    def: TechDef,
  ): { fill: number; border: number; borderAlpha: number } {
    switch (stage) {
      case 'signal-hidden':
        return { fill: C_NODE_SIGNAL, border: C_BORDER_SIGNAL, borderAlpha: 0.7 };
      case 'unknown':
        return { fill: C_NODE_UNKNOWN, border: C_BORDER_UNKNOWN, borderAlpha: 1 };
      case 'rumour':
        return { fill: C_NODE_RUMOUR, border: C_BORDER_RUMOUR, borderAlpha: 1 };
      case 'progress':
        return { fill: C_NODE_PROGRESS, border: this.dominantFieldColor(def), borderAlpha: 0.9 };
      case 'discovered':
        return { fill: C_NODE_DISC, border: C_GOLD, borderAlpha: 1 };
    }
  }

  // -------------------------------------------------------------------------
  // Stage-specific content
  // -------------------------------------------------------------------------

  /** Unknown: redacted document — horizontal bars like censored text. */
  private drawUnknownContent(x: number, y: number): void {
    const barSpacing = 22;
    const bars = [
      { xOff: 10, w: NODE_W - 22 },
      { xOff: 10, w: NODE_W - 42 },
      { xOff: 10, w: NODE_W - 30 },
      { xOff: 10, w: NODE_W - 56 },
    ];
    this.worldGfx.fillStyle(C_REDACT_BAR, 1);
    for (let i = 0; i < bars.length; i++) {
      this.worldGfx.fillRect(x + bars[i].xOff, y + 24 + i * barSpacing, bars[i].w, 9);
    }

    this.addWorldText(x + NODE_W / 2, y + NODE_H - 13, 'ACCESS RESTRICTED', {
      fontFamily: 'monospace',
      fontSize: FS_SECONDARY,
      color: '#1e3040',
    }).setOrigin(0.5, 1);
  }

  /**
   * Signal-hidden: pulsing waveform to suggest the signal is real
   * but its nature is concealed.
   */
  private drawSignalHiddenContent(x: number, y: number): void {
    const cx = x + NODE_W / 2;
    const cy = y + NODE_H / 2 - 10;

    const waves: { color: number; alpha: number; amp: number }[] = [
      { color: C_WAVE_DIM, alpha: 0.4, amp: 6 },
      { color: C_WAVE_MID, alpha: 0.7, amp: 10 },
      { color: C_WAVE_BRIGHT, alpha: 1.0, amp: 7 },
    ];
    for (const wave of waves) {
      this.drawSineWave(cx, cy, 56, 2.2, wave.amp, wave.color, wave.alpha);
    }

    this.worldGfx.fillStyle(C_WAVE_DOTS, 0.6);
    const dotXs = [-28, -14, 0, 14, 28];
    for (const dx of dotXs) {
      this.worldGfx.fillCircle(cx + dx, cy, 1.5);
    }

    this.addWorldText(cx, cy + 22, 'SIGNAL SOURCE: UNRESOLVED', {
      fontFamily: 'monospace',
      fontSize: FS_SECONDARY,
      color: '#243c52',
    }).setOrigin(0.5, 0);

    this.addWorldText(cx, y + NODE_H - 13, 'PENDING SIGNAL ANALYSIS', {
      fontFamily: 'monospace',
      fontSize: FS_SECONDARY,
      color: '#1a3048',
    }).setOrigin(0.5, 1);
  }

  /** Rumour: named tech but recipe hidden — "unconfirmed intelligence report". */
  private drawRumourContent(def: TechDef, x: number, y: number): void {
    this.worldGfx.fillStyle(C_RUMOUR_DOT, 0.7);
    this.worldGfx.fillCircle(x + NODE_W - 14, y + 16, 4);

    const nameText = this.addWorldText(x + NODE_PAD, y + NODE_PAD, def.name, {
      fontFamily: 'monospace',
      fontSize: FS_NODE_NAME,
      color: '#7aaab8',
      wordWrap: { width: NODE_W - NODE_PAD * 2 - 18 },
    }).setOrigin(0, 0);

    const sepY = y + NODE_PAD + nameText.height + 5;
    this.worldGfx.lineStyle(1, C_SEP_RUMOUR, 1);
    this.worldGfx.lineBetween(x + NODE_PAD, sepY, x + NODE_W - NODE_PAD, sepY);

    this.addWorldText(x + NODE_PAD, sepY + 5, def.rumourText, {
      fontFamily: 'monospace',
      fontSize: FS_SECONDARY,
      color: '#4a6a7a',
      fontStyle: 'italic',
      wordWrap: { width: NODE_W - NODE_PAD * 2 },
    }).setOrigin(0, 0);

    this.addWorldText(x + NODE_W / 2, y + NODE_H - 13, 'UNCONFIRMED', {
      fontFamily: 'monospace',
      fontSize: FS_SECONDARY,
      color: '#2e5060',
    }).setOrigin(0.5, 1);
  }

  /** Progress: visible name and live field bars. */
  private drawProgressContent(
    def: TechDef,
    tech: TechState,
    d: TechTreeSceneData,
    x: number,
    y: number,
  ): void {
    const nameText = this.addWorldText(x + NODE_PAD, y + NODE_PAD, def.name, {
      fontFamily: 'monospace',
      fontSize: FS_NODE_NAME,
      color: '#a8c8d8',
      wordWrap: { width: NODE_W - NODE_PAD * 2 },
    }).setOrigin(0, 0);

    const sepY = y + NODE_PAD + nameText.height + 5;
    this.worldGfx.lineStyle(1, C_SEP_PROGRESS, 1);
    this.worldGfx.lineBetween(x + NODE_PAD, sepY, x + NODE_W - NODE_PAD, sepY);

    const recipe = tech.recipe ?? def.baseRecipe;
    let barY = sepY + 8;
    barY = this.drawFieldBars(recipe, tech.fieldProgress, false, x, barY);

    if (def.requiresSimultaneous) {
      this.addWorldText(x + NODE_W / 2, barY + 3, '\u2295 ALL FIELDS SIMULTANEOUS', {
        fontFamily: 'monospace',
        fontSize: FS_SECONDARY,
        color: '#4a7080',
      }).setOrigin(0.5, 0);
    }
  }

  /** Discovered: gold-framed, full bars shown as achievement. */
  private drawDiscoveredContent(
    def: TechDef,
    tech: TechState,
    d: TechTreeSceneData,
    x: number,
    y: number,
  ): void {
    this.worldGfx.lineStyle(1, C_GOLD, 0.3);
    this.worldGfx.lineBetween(x + 4, y + 4, x + NODE_W - 4, y + 4);

    const nameText = this.addWorldText(x + NODE_PAD, y + NODE_PAD + 4, def.name, {
      fontFamily: 'monospace',
      fontSize: FS_NODE_NAME,
      color: '#f0e4a0',
      wordWrap: { width: NODE_W - NODE_PAD * 2 },
    }).setOrigin(0, 0);

    const sepY = y + NODE_PAD + 4 + nameText.height + 5;
    this.worldGfx.lineStyle(1, C_SEP_DISC, 1);
    this.worldGfx.lineBetween(x + NODE_PAD, sepY, x + NODE_W - NODE_PAD, sepY);

    let barY = sepY + 8;

    const unlocks: string[] = [
      ...def.unlocksCards.map((id) => d.cardDefs.get(id)?.name ?? id),
      ...def.unlocksFacilities.map((id) => d.facilityDefs.get(id)?.name ?? id),
    ];
    if (unlocks.length > 0) {
      this.addWorldText(x + NODE_PAD, barY + 4, '\u25b8 ' + unlocks.join(', '), {
        fontFamily: 'monospace',
        fontSize: FS_SECONDARY,
        color: '#4a8858',
        wordWrap: { width: NODE_W - NODE_PAD * 2 },
      }).setOrigin(0, 0);
    }
  }

  // -------------------------------------------------------------------------
  // Field progress bars
  // -------------------------------------------------------------------------

  private drawFieldBars(
    recipe: Record<string, number | undefined>,
    fieldProgress: Partial<Record<string, number>>,
    discovered: boolean,
    x: number,
    startY: number,
  ): number {
    const barW = NODE_W - NODE_PAD * 2 - LABEL_W;
    const labelX = x + NODE_PAD;
    const barX = x + NODE_PAD + LABEL_W;
    let y = startY;

    for (const [field, threshold] of Object.entries(recipe)) {
      if (!threshold) continue;
      const currentVal = fieldProgress[field] ?? 0;
      const progress = Math.min(1, currentVal / threshold);
      const barColor = FIELD_COLOURS_PHASER[field] ?? C_FIELD_FALLBACK;
      const cssColor = FIELD_COLOURS_CSS[field] ?? '#4a6880';

      this.addWorldText(labelX, y, FIELD_ABBR[field] ?? field.slice(0, 3).toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: FS_FIELD_LABEL,
        color: discovered ? cssColor : '#4a7080',
      }).setOrigin(0, 0.5);

      // Track
      this.worldGfx.fillStyle(C_BAR_TRACK, 1);
      this.worldGfx.fillRect(barX, y - BAR_H / 2, barW, BAR_H);

      // Filled portion
      if (progress > 0) {
        this.worldGfx.fillStyle(barColor, discovered ? 0.5 : 1);
        this.worldGfx.fillRect(barX, y - BAR_H / 2, barW * progress, BAR_H);
      }

      y += BAR_ROW_H;
    }
    return y;
  }

  // -------------------------------------------------------------------------
  // Sine wave helper
  // -------------------------------------------------------------------------

  private drawSineWave(
    cx: number,
    cy: number,
    halfWidth: number,
    cycles: number,
    amplitude: number,
    color: number,
    alpha: number,
  ): void {
    const segments = 36;
    this.worldGfx.lineStyle(1.5, color, alpha);
    this.worldGfx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = cx - halfWidth + t * halfWidth * 2;
      const py = cy + Math.sin(t * Math.PI * 2 * cycles) * amplitude;
      if (i === 0) this.worldGfx.moveTo(px, py);
      else this.worldGfx.lineTo(px, py);
    }
    this.worldGfx.strokePath();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private dominantFieldColor(def: TechDef): number {
    let maxVal = 0;
    let color = C_FIELD_FALLBACK;
    for (const [field, val] of Object.entries(def.baseRecipe)) {
      if ((val ?? 0) > maxVal) {
        maxVal = val ?? 0;
        color = FIELD_COLOURS_PHASER[field] ?? C_FIELD_FALLBACK;
      }
    }
    return color;
  }

  /** Add a world-space text object that scrolls with the camera. */
  private addWorldText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, style);
    this.worldTextObjs.push(t);
    return t;
  }

  /** Add a screen-fixed text object (scroll factor 0). */
  private addUIText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, style);
    t.setScrollFactor(0);
    this.uiTextObjs.push(t);
    return t;
  }

  private clearAllTexts(): void {
    for (const t of this.worldTextObjs) t.destroy();
    for (const t of this.uiTextObjs) t.destroy();
    this.worldTextObjs = [];
    this.uiTextObjs = [];
  }
}
