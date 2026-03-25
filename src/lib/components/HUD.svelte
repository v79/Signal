<script lang="ts">
  import type { Resources, FieldPoints, Era, TurnPhase } from '../../engine/types';
  import type { ResourceBreakdown, ClimateBreakdown } from '../../engine/facilities';
  import Tooltip from './Tooltip.svelte';
  import { FIELD_ABBR, FIELD_COLOURS_CSS } from '../fieldColours';

  let {
    resources,
    fields,
    turn,
    year,
    era,
    phase,
    climatePressure,
    will,
    seed,
    blocName,
    resourceBreakdown,
    climateBreakdown,
    onExport,
    onImport,
    onRestart,
    onNewGame,
    onSettings,
  }: {
    resources: Resources;
    fields: FieldPoints;
    turn: number;
    year: number;
    era: Era;
    phase: TurnPhase;
    climatePressure: number;
    will: number;
    seed: string;
    blocName: string;
    onExport: () => void;
    onImport: (file: File) => Promise<void>;
    onRestart: () => void;
    onNewGame: () => void;
    onSettings: () => void;
    resourceBreakdown: ResourceBreakdown;
    climateBreakdown: ClimateBreakdown;
  } = $props();

  let menuOpen = $state(false);
  let dropdownPos = $state({ top: 0, left: 0 });
  let seedCopied = $state(false);
  let importError = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = null;

  function toggleMenu(event: MouseEvent): void {
    if (!menuOpen) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      dropdownPos = { top: rect.bottom + 4, left: rect.left };
    }
    menuOpen = !menuOpen;
  }
  function closeMenu(): void {
    menuOpen = false;
  }

  function copySeed(): void {
    navigator.clipboard
      .writeText(seed)
      .then(() => {
        seedCopied = true;
        setTimeout(() => { seedCopied = false; }, 1500);
      })
      .catch(() => { /* ignore */ });
  }

  function showImportError(msg: string): void {
    if (errorTimer) clearTimeout(errorTimer);
    importError = msg;
    errorTimer = setTimeout(() => { importError = null; }, 5000);
  }

  async function handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    try {
      await onImport(file);
      closeMenu();
    } catch (err: unknown) {
      const msg =
        typeof err === 'string' ? err
        : err instanceof Error ? err.message
        : 'Unknown error loading save file.';
      showImportError(msg);
    }
  }

  const ERA_LABELS: Record<Era, string> = {
    earth: 'EARTH',
    nearSpace: 'NEAR SPACE',
    deepSpace: 'DEEP SPACE',
  };

  const PHASE_LABELS: Record<TurnPhase, string> = {
    event: 'EVENT',
    draw: 'DRAW',
    action: 'ACTION',
    world: 'WORLD',
  };

  const FIELD_KEYS = Object.keys(FIELD_ABBR) as (keyof FieldPoints)[];

  const FIELD_TOOLTIPS: Record<keyof FieldPoints, string> = {
    physics: 'Physics — drives signal detection and propulsion research.',
    mathematics: 'Mathematics — underpins cryptography, navigation, and signal decoding.',
    engineering: 'Engineering — enables facility construction and hardware projects.',
    biochemistry: 'Biochemistry — supports life sciences, habitat, and medical research.',
    computing: 'Computing — accelerates all research; essential for signal analysis.',
    socialScience: 'Social Science — improves Political Will generation and diplomacy.',
  };

  function climateTooltip(bd: ClimateBreakdown): string {
    const net = bd.base + bd.entries.reduce((s, e) => s + e.amount, 0);
    const sign = (n: number) => (n >= 0 ? '+' : '');
    const header = `Climate pressure (${sign(net)}${net.toFixed(2)}/turn)`;
    const baseRow = `  Base industrial rate: +${bd.base.toFixed(2)}/turn`;
    if (bd.entries.length === 0) return `${header}\n${baseRow}`;
    const rows = bd.entries.map(
      (e) => `  ${e.label}: ${sign(e.amount)}${e.amount.toFixed(2)}/turn`,
    );
    return `${header}\n${baseRow}\n${rows.join('\n')}`;
  }

  function climateColor(p: number): string {
    if (p < 30) return '#4a9b7a';
    if (p < 60) return '#c8a040';
    return '#9b4a4a';
  }

  function willColor(w: number): string {
    if (w >= 60) return '#4a9b7a';
    if (w >= 35) return '#c8a040';
    return '#9b4a4a';
  }

  function fmt(n: number): string {
    return Math.round(n).toLocaleString();
  }

  function netIncome(lines: ResourceBreakdown['funding']): number {
    return lines.reduce((s, l) => s + l.amount, 0);
  }

  function breakdownTooltip(
    lines: ResourceBreakdown['funding'],
    header: string,
    fallback: string,
  ): string {
    if (lines.length === 0) return fallback;
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const sign = total >= 0 ? '+' : '';
    const rows = lines.map((l) => `  ${l.label}: ${l.amount >= 0 ? '+' : ''}${l.amount}/turn`);
    return `${header} (${sign}${total}/turn)\n${rows.join('\n')}`;
  }
</script>

<header class="hud">
  <div class="hud-left">
    <div class="menu-wrapper">
      <Tooltip text="Game menu" direction="below">
        <button
          class="menu-btn"
          onclick={(e) => toggleMenu(e)}
          aria-label="Game menu"
          aria-expanded={menuOpen}
        >
          ≡
        </button>
      </Tooltip>
      {#if menuOpen}
        <div
          class="menu-backdrop"
          onclick={closeMenu}
          role="none"
          tabindex="-1"
          onkeydown={() => {}}
        ></div>
        <div class="menu-dropdown" style="top: {dropdownPos.top}px; left: {dropdownPos.left}px;">
          <div class="menu-seed-row">
            <span class="menu-seed-label">SEED</span>
            <button class="menu-seed-value" onclick={copySeed} title="Copy seed to clipboard">
              {seed}<span class="menu-copy-hint">{seedCopied ? '✓' : '⧉'}</span>
            </button>
          </div>
          <div class="menu-divider"></div>
          <button
            class="menu-item"
            onclick={() => { closeMenu(); onExport(); }}
          >
            EXPORT SAVE
          </button>
          <label class="menu-item menu-import-label" title="Import a save file">
            IMPORT SAVE
            <input
              type="file"
              accept=".json,application/json"
              onchange={handleFileChange}
              class="menu-hidden-input"
            />
          </label>
          <div class="menu-divider"></div>
          <button
            class="menu-item"
            onclick={() => {
              closeMenu();
              onRestart();
            }}
          >
            RESTART GAME
          </button>
          <button
            class="menu-item"
            onclick={() => {
              closeMenu();
              onNewGame();
            }}
          >
            NEW GAME SETUP
          </button>
          <div class="menu-divider"></div>
          <button
            class="menu-item"
            disabled
            onclick={() => {
              closeMenu();
              onSettings();
            }}
          >
            SETTINGS
          </button>
        </div>
      {/if}
    </div>
    <span class="logo">SIGNAL</span>
    <span class="divider">│</span>
    <span class="label">TURN</span><span class="value">{turn}</span>
    <span class="label">YEAR</span><span class="value">{year}</span>
    <span class="era-badge">{ERA_LABELS[era]}</span>
    {#if blocName}
      <span class="bloc-name">{blocName}</span>
    {/if}
    {#if phase !== 'action'}
      <span class="phase-badge">{PHASE_LABELS[phase]}</span>
    {/if}
  </div>

  <div class="hud-center">
    <Tooltip text={climateTooltip(climateBreakdown)} direction="below">
      <div class="climate-group">
        <span class="label">CLIMATE</span>
        <div class="bar-track climate-track">
          <div
            class="bar-fill"
            style="width: {climatePressure}%; background: {climateColor(climatePressure)}"
          ></div>
        </div>
        <span class="value" style="color: {climateColor(climatePressure)}"
          >{climatePressure.toFixed(0)}%</span
        >
      </div>
    </Tooltip>

    <Tooltip text="Global political will level." direction="below">
      <span class="label" style="margin-left: 1rem">WILL</span>
    </Tooltip>
    <div class="bar-track will-track">
      <div class="bar-fill" style="width: {will}%; background: {willColor(will)}"></div>
    </div>
    <span class="value" style="color: {willColor(will)}">{Math.round(will)}</span>
  </div>

  <div class="hud-right">
    <Tooltip
      text={breakdownTooltip(
        resourceBreakdown.funding,
        'Funding',
        'Current funding. Gained from funding facilities and cards.',
      )}
      direction="below"
    >
      <div class="resource">
        <span class="res-label" class:negative-income={netIncome(resourceBreakdown.funding) < 0}>FUND</span>
        <span class="res-value fund" class:fund-negative={resources.funding < 0}>{fmt(resources.funding)}</span>
      </div>
    </Tooltip>
    <Tooltip
      text={breakdownTooltip(
        resourceBreakdown.materials,
        'Materials',
        'Raw materials. Gained from mines and industrial zones.',
      )}
      direction="below"
    >
      <div class="resource">
        <span class="res-label" class:negative-income={netIncome(resourceBreakdown.materials) < 0}>MAT</span>
        <span class="res-value mat">{fmt(resources.materials)}</span>
      </div>
    </Tooltip>
    <Tooltip
      text={breakdownTooltip(
        resourceBreakdown.politicalWill,
        'Political Will',
        'Political will. Volatile in democracies; stable but fragile in authoritarian blocs.',
      )}
      direction="below"
    >
      <div class="resource">
        <span class="res-label" class:negative-income={netIncome(resourceBreakdown.politicalWill) < 0}>WILL</span>
        <span class="res-value will">{fmt(resources.politicalWill)}</span>
      </div>
    </Tooltip>
    <span class="divider">│</span>
    {#each FIELD_KEYS as key}
      <Tooltip text={FIELD_TOOLTIPS[key]} direction="below">
        <div class="field-mini">
          <span class="field-label" style="color: {FIELD_COLOURS_CSS[key]}">{FIELD_ABBR[key]}</span>
          <span class="field-value" style="color: {FIELD_COLOURS_CSS[key]}">{fmt(fields[key])}</span>
        </div>
      </Tooltip>
    {/each}
  </div>
</header>

{#if importError}
  <div class="import-error" role="alert">
    <span class="error-icon">⚠</span>
    <span class="error-text">{importError}</span>
    <button class="error-dismiss" onclick={() => { importError = null; }} aria-label="Dismiss">✕</button>
  </div>
{/if}

<style>
  .hud {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 1rem;
    background: #0d1018;
    border-bottom: 1px solid #1e2530;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    white-space: nowrap;
    overflow: hidden;
    flex-shrink: 0;
  }

  .hud-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .hud-center {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
  }

  .hud-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ---- Menu ---- */

  .menu-wrapper {
    position: relative;
  }

  .menu-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #4a6888;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.35rem;
    cursor: pointer;
    border-radius: 2px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .menu-btn:hover,
  .menu-btn[aria-expanded='true'] {
    color: #8aacca;
    border-color: #2a4060;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .menu-dropdown {
    position: fixed;
    z-index: 100;
    background: #0a1018;
    border: 1px solid #2a3a50;
    min-width: 13rem;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }

  .menu-item {
    background: transparent;
    border: none;
    border-bottom: 1px solid #1a2535;
    color: #8aacca;
    font-family: inherit;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    padding: 0.55rem 0.9rem;
    text-align: left;
    cursor: pointer;
    transition:
      background 0.12s,
      color 0.12s;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-item:hover:not(:disabled) {
    background: #121e2e;
    color: #c8ddf0;
  }

  .menu-item:disabled {
    color: #3a4a5a;
    cursor: not-allowed;
  }

  .menu-divider {
    height: 1px;
    background: #1a2535;
    margin: 0.1rem 0;
  }

  .menu-seed-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.9rem;
  }

  .menu-seed-label {
    color: #5a6878;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  .menu-seed-value {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: 1px solid #2a3040;
    color: #4a8ab4;
    font-size: 0.6rem;
    font-family: inherit;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.35rem;
    cursor: pointer;
    transition: border-color 0.15s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 10rem;
  }

  .menu-seed-value:hover {
    border-color: #4a8ab4;
  }

  .menu-copy-hint {
    color: #5a6878;
    font-size: 0.55rem;
    flex-shrink: 0;
  }

  .menu-import-label {
    cursor: pointer;
  }

  .menu-hidden-input {
    display: none;
  }

  .import-error {
    position: fixed;
    top: 3rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: #1a0e0e;
    border: 1px solid #8b3030;
    color: #d08080;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    padding: 0.55rem 0.85rem;
    z-index: 1000;
    max-width: 36rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }

  .error-icon {
    color: #c04040;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: #6a4040;
    font-size: 0.7rem;
    cursor: pointer;
    padding: 0 0.1rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .error-dismiss:hover {
    color: #d08080;
  }

  /* ---- Logo ---- */

  .logo {
    font-size: 0.85rem;
    font-weight: bold;
    letter-spacing: 0.25em;
    color: #4a8ab4;
  }

  .divider {
    color: #2a3040;
  }

  .label {
    color: #5a6878;
    font-size: 0.7rem;
  }

  .value {
    color: #c8d0d8;
    font-variant-numeric: tabular-nums;
  }

  .era-badge {
    padding: 0.1rem 0.4rem;
    border: 1px solid #2a4a6a;
    color: #4a8ab4;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
  }

  .bloc-name {
    color: #6a8aaa;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.8;
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .phase-badge {
    padding: 0.1rem 0.4rem;
    background: #1a2535;
    color: #c8a040;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
  }

  .bar-track {
    height: 6px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
  }

  .climate-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .climate-track {
    width: 80px;
  }
  .will-track {
    width: 60px;
  }

  .bar-fill {
    height: 100%;
    transition:
      width 0.3s ease,
      background 0.3s ease;
  }

  .resource {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .res-label {
    color: #6a7888;
    font-size: 0.68rem;
  }

  .res-label.negative-income {
    color: #c87050;
  }

  .res-value {
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
  }

  .fund {
    color: #c8d050;
  }
  .fund-negative {
    color: #d46a4a;
  }
  .mat {
    color: #8b5e3c;
  }
  .will {
    color: #b07ad0;
  }

  .field-mini {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }

  .field-label {
    font-size: 0.65rem;
  }

  .field-value {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
</style>
