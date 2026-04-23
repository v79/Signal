// =============================================================================
// SIGNAL — Save System
// Handles localStorage auto-save, JSON export/import, and state validation.
// Browser APIs (localStorage, Blob, FileReader) are accessed only inside
// function bodies — never at module level — so this module is SSR-safe.
// =============================================================================

import type { GameState, Era, TurnPhase } from './types';
import { serialiseGameState, deserialiseGameState } from './state';

export const SAVE_KEY = 'signal-autosave';
export const SAVE_FORMAT_VERSION = 2;

const VALID_ERAS: Era[] = ['earth', 'nearSpace', 'deepSpace'];
const VALID_PHASES: TurnPhase[] = ['event', 'draw', 'action', 'world'];

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface SaveEnvelope {
  version: number;
  savedAt: string;
  state: GameState;
}

export function wrapEnvelope(state: GameState): SaveEnvelope {
  return {
    version: SAVE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

// ---------------------------------------------------------------------------
// Serialise / Deserialise
// ---------------------------------------------------------------------------

export function serialiseSave(state: GameState): string {
  const envelope: SaveEnvelope = wrapEnvelope(state);
  return JSON.stringify({ ...envelope, state: JSON.parse(serialiseGameState(state)) });
}

export function deserialiseSave(json: string): GameState {
  const parsed = JSON.parse(json) as unknown;
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'version' in (parsed as object) &&
    'state' in (parsed as object)
  ) {
    return (parsed as SaveEnvelope).state;
  }
  // Backward compat: bare GameState with no envelope
  return deserialiseGameState(json);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationResult = { valid: true; state: GameState } | { valid: false; error: string };

export function validateSave(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { valid: false, error: 'Save data is not a valid object.' };
  }

  // Unwrap envelope if present
  let candidate: unknown = raw;
  if ('version' in (raw as object) && 'state' in (raw as object)) {
    candidate = (raw as SaveEnvelope).state;
    if (candidate === null || typeof candidate !== 'object') {
      return { valid: false, error: 'Save envelope contains no state.' };
    }
  }

  const s = candidate as Record<string, unknown>;

  if (typeof s['seed'] !== 'string' || s['seed'] === '') {
    return { valid: false, error: 'Missing or invalid field: seed' };
  }
  if (typeof s['turn'] !== 'number' || s['turn'] < 1) {
    return { valid: false, error: 'Missing or invalid field: turn' };
  }
  if (typeof s['year'] !== 'number') {
    return { valid: false, error: 'Missing or invalid field: year' };
  }
  if (!VALID_ERAS.includes(s['era'] as Era)) {
    return { valid: false, error: `Invalid era: "${String(s['era'])}"` };
  }
  if (!VALID_PHASES.includes(s['phase'] as TurnPhase)) {
    return { valid: false, error: `Invalid phase: "${String(s['phase'])}"` };
  }
  if (typeof s['pushFactor'] !== 'string') {
    return { valid: false, error: 'Missing or invalid field: pushFactor' };
  }

  const player = s['player'] as Record<string, unknown> | null | undefined;
  if (!player || typeof player !== 'object') {
    return { valid: false, error: 'Missing or invalid field: player' };
  }
  const resources = player['resources'] as Record<string, unknown> | null | undefined;
  if (!resources || typeof resources !== 'object') {
    return { valid: false, error: 'Missing player.resources' };
  }
  for (const k of ['funding', 'materials', 'politicalWill']) {
    if (typeof resources[k] !== 'number') {
      return { valid: false, error: `Missing player.resources.${k}` };
    }
  }
  const fields = player['fields'] as Record<string, unknown> | null | undefined;
  if (!fields || typeof fields !== 'object') {
    return { valid: false, error: 'Missing player.fields' };
  }
  for (const k of [
    'physics',
    'mathematics',
    'engineering',
    'biochemistry',
    'computing',
    'socialScience',
  ]) {
    if (typeof fields[k] !== 'number') {
      return { valid: false, error: `Missing player.fields.${k}` };
    }
  }

  const map = s['map'] as Record<string, unknown> | null | undefined;
  if (!map || typeof map !== 'object') {
    return { valid: false, error: 'Missing or invalid field: map' };
  }
  if (!Array.isArray(map['earthTiles'])) {
    return { valid: false, error: 'Missing map.earthTiles array' };
  }

  const signal = s['signal'] as Record<string, unknown> | null | undefined;
  if (!signal || typeof signal !== 'object') {
    return { valid: false, error: 'Missing or invalid field: signal' };
  }
  const dp = signal['decodeProgress'];
  if (typeof dp !== 'number' || dp < 0 || dp > 100) {
    return { valid: false, error: 'signal.decodeProgress must be a number in [0, 100]' };
  }

  if (!Array.isArray(s['activeEvents'])) {
    return { valid: false, error: 'Missing activeEvents array' };
  }
  if (!Array.isArray(s['blocs'])) {
    return { valid: false, error: 'Missing blocs array' };
  }

  // Backward-compat defaults for narrative fields added in Phase 19.
  if (!Array.isArray(s['seenNarrativeIds'])) s['seenNarrativeIds'] = [];
  if (!Array.isArray(s['narrativeQueue'])) s['narrativeQueue'] = [];

  // Backward-compat: Phase 21 adds fieldProgress and unlockedByBreakthrough to TechState.
  // Also zeros out player.fields which is now a per-turn snapshot (not cumulative).
  const playerObj = s['player'] as Record<string, unknown> | undefined;
  if (playerObj && Array.isArray(playerObj['techs'])) {
    playerObj['techs'] = (playerObj['techs'] as Record<string, unknown>[]).map((t) => ({
      ...t,
      fieldProgress: typeof t['fieldProgress'] === 'object' && t['fieldProgress'] !== null
        ? t['fieldProgress']
        : {},
      unlockedByBreakthrough: typeof t['unlockedByBreakthrough'] === 'boolean'
        ? t['unlockedByBreakthrough']
        : false,
    }));
  }
  // player.fields is now per-turn output — zero it out on load from old saves
  // (old saves had cumulative totals which are no longer meaningful)
  if (playerObj && typeof playerObj['fields'] === 'object' && playerObj['fields'] !== null) {
    const oldFields = playerObj['fields'] as Record<string, unknown>;
    // Only reset if any field value is very large (indicating cumulative totals)
    const maxField = Math.max(...Object.values(oldFields).map(v => typeof v === 'number' ? v : 0));
    if (maxField > 50) { // threshold: per-turn output should never exceed this
      playerObj['fields'] = {
        physics: 0, mathematics: 0, engineering: 0,
        biochemistry: 0, computing: 0, socialScience: 0,
      };
    }
  }

  // Backward-compat: Phase 24 replaces MapTile.facilityId with facilitySlots[3].
  // Also adds slotIndex to OngoingAction.
  const mapObj = s['map'] as Record<string, unknown> | undefined;
  if (mapObj && Array.isArray(mapObj['earthTiles'])) {
    mapObj['earthTiles'] = (mapObj['earthTiles'] as Record<string, unknown>[]).map((t) => {
      if (!Array.isArray(t['facilitySlots'])) {
        // Old save: facilityId → facilitySlots[0]
        const oldId = typeof t['facilityId'] === 'string' ? t['facilityId'] : null;
        t['facilitySlots'] = [oldId, null, null];
        delete t['facilityId'];
      }
      return t;
    });
  }
  const playerForMigration = s['player'] as Record<string, unknown> | undefined;
  if (playerForMigration && Array.isArray(playerForMigration['constructionQueue'])) {
    playerForMigration['constructionQueue'] = (
      playerForMigration['constructionQueue'] as Record<string, unknown>[]
    ).map((a) => ({
      slotIndex: 0,
      ...a,
    }));
  }

  return { valid: true, state: candidate as GameState };
}

// ---------------------------------------------------------------------------
// localStorage auto-save / auto-load
// ---------------------------------------------------------------------------

export function autoSave(state: GameState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SAVE_KEY, serialiseSave(state));
  } catch (e) {
    console.warn('[Signal] Auto-save failed:', e);
  }
}

export function autoLoad(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    const result = validateSave(parsed);
    if (!result.valid) {
      console.warn('[Signal] Auto-load rejected invalid save:', result.error);
      return null;
    }
    return result.state;
  } catch (e) {
    console.warn('[Signal] Auto-load failed:', e);
    return null;
  }
}

export function clearSave(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Export — browser download
// ---------------------------------------------------------------------------

export function exportSave(state: GameState): void {
  const json = serialiseSave(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `signal-save-${state.player.blocDefId}-${state.seed}-t${state.turn}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import — file upload
// ---------------------------------------------------------------------------

export function importSave(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json) as unknown;
        const result = validateSave(parsed);
        if (!result.valid) {
          reject(`Invalid save file: ${result.error}`);
        } else {
          resolve(result.state);
        }
      } catch {
        reject('Could not parse save file — not valid JSON.');
      }
    };
    reader.onerror = () => reject('Could not read the file.');
    reader.readAsText(file);
  });
}
