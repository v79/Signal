// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  serialiseSave,
  deserialiseSave,
  validateSave,
  wrapEnvelope,
  autoSave,
  autoLoad,
  clearSave,
  importSave,
  SAVE_KEY,
  SAVE_FORMAT_VERSION,
} from './save';
import { createGameState } from './state';
import type { GameState } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createGameState({
    seed: 'test-seed',
    playerBlocDefId: 'eu',
    pushFactor: 'climateChange',
    startYear: 2025,
    willProfile: 'democratic',
    startingWill: 60,
    startingResources: { funding: 100, materials: 50, politicalWill: 60 },
  });
  return {
    ...base,
    map: {
      earthTiles: [],
      spaceNodes: [],
      beltNodes: [],
      beltEdges: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// wrapEnvelope
// ---------------------------------------------------------------------------

describe('wrapEnvelope', () => {
  it('produces an envelope with the correct version and a savedAt ISO string', () => {
    const state = makeState();
    const env = wrapEnvelope(state);
    expect(env.version).toBe(SAVE_FORMAT_VERSION);
    expect(typeof env.savedAt).toBe('string');
    expect(() => new Date(env.savedAt)).not.toThrow();
    expect(env.state).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// serialiseSave / deserialiseSave round-trip
// ---------------------------------------------------------------------------

describe('serialiseSave / deserialiseSave', () => {
  it('round-trips a GameState through JSON without mutation', () => {
    const state = makeState({ turn: 5, year: 2030 });
    const json = serialiseSave(state);
    const restored = deserialiseSave(json);
    expect(restored.seed).toBe('test-seed');
    expect(restored.turn).toBe(5);
    expect(restored.year).toBe(2030);
    expect(restored.player.resources.funding).toBe(100);
  });

  it('includes the envelope wrapper in the raw JSON', () => {
    const state = makeState();
    const raw = JSON.parse(serialiseSave(state)) as Record<string, unknown>;
    expect(raw['version']).toBe(SAVE_FORMAT_VERSION);
    expect(typeof raw['savedAt']).toBe('string');
  });

  it('deserialiseSave handles a bare GameState without envelope (backward compat)', () => {
    const state = makeState({ turn: 2 });
    const bareJson = JSON.stringify(state);
    const restored = deserialiseSave(bareJson);
    expect(restored.turn).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateSave — valid inputs
// ---------------------------------------------------------------------------

describe('validateSave — valid inputs', () => {
  it('accepts a correctly wrapped save envelope', () => {
    const state = makeState();
    const envelope = wrapEnvelope(state);
    const result = validateSave(envelope);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.state.seed).toBe('test-seed');
    }
  });

  it('accepts a bare GameState without an envelope', () => {
    const state = makeState();
    const result = validateSave(state);
    expect(result.valid).toBe(true);
  });

  it('accepts all valid era values', () => {
    for (const era of ['earth', 'nearSpace', 'deepSpace'] as const) {
      const result = validateSave(makeState({ era }));
      expect(result.valid).toBe(true);
    }
  });

  it('accepts all valid phase values', () => {
    for (const phase of ['event', 'draw', 'action', 'bank', 'world'] as const) {
      const result = validateSave(makeState({ phase }));
      expect(result.valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateSave — invalid inputs
// ---------------------------------------------------------------------------

describe('validateSave — invalid inputs', () => {
  it('rejects null', () => {
    const result = validateSave(null);
    expect(result.valid).toBe(false);
  });

  it('rejects a non-object primitive', () => {
    const result = validateSave(42);
    expect(result.valid).toBe(false);
  });

  it('rejects an empty object', () => {
    const result = validateSave({});
    expect(result.valid).toBe(false);
  });

  it('rejects when seed is missing', () => {
    const state = makeState();
    const { seed: _omit, ...rest } = state;
    const result = validateSave(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('seed');
  });

  it('rejects when turn is not a number', () => {
    const state = { ...makeState(), turn: 'three' };
    const result = validateSave(state);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('turn');
  });

  it('rejects when turn is less than 1', () => {
    const result = validateSave(makeState({ turn: 0 }));
    expect(result.valid).toBe(false);
  });

  it('rejects an unknown era value', () => {
    const state = { ...makeState(), era: 'mars' };
    const result = validateSave(state);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('era');
  });

  it('rejects an unknown phase value', () => {
    const state = { ...makeState(), phase: 'planning' };
    const result = validateSave(state);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('phase');
  });

  it('rejects when player is missing', () => {
    const { player: _omit, ...rest } = makeState();
    const result = validateSave(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('player');
  });

  it('rejects when player.resources.funding is missing', () => {
    const state = makeState();
    const { funding: _omit, ...resourcesWithout } = state.player.resources;
    const corrupt = { ...state, player: { ...state.player, resources: resourcesWithout } };
    const result = validateSave(corrupt);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('funding');
  });

  it('rejects when signal.decodeProgress is out of range', () => {
    const state = makeState();
    const corrupt = { ...state, signal: { ...state.signal, decodeProgress: 150 } };
    const result = validateSave(corrupt);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('decodeProgress');
  });

  it('rejects when map.earthTiles is not an array', () => {
    const state = makeState();
    const corrupt = { ...state, map: { ...state.map, earthTiles: null } };
    const result = validateSave(corrupt);
    expect(result.valid).toBe(false);
  });

  it('rejects when activeEvents is not an array', () => {
    const state = { ...makeState(), activeEvents: 'none' };
    const result = validateSave(state);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// autoSave / autoLoad / clearSave (uses real localStorage via jsdom)
// ---------------------------------------------------------------------------

describe('autoSave / autoLoad / clearSave', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('autoLoad returns null when nothing is saved', () => {
    expect(autoLoad()).toBeNull();
  });

  it('autoSave + autoLoad round-trips the game state', () => {
    const state = makeState({ turn: 7, year: 2032, era: 'nearSpace' });
    autoSave(state);
    const loaded = autoLoad();
    expect(loaded).not.toBeNull();
    expect(loaded!.turn).toBe(7);
    expect(loaded!.year).toBe(2032);
    expect(loaded!.era).toBe('nearSpace');
    expect(loaded!.seed).toBe('test-seed');
  });

  it('autoLoad returns null after autoSave + clearSave', () => {
    const state = makeState();
    autoSave(state);
    clearSave();
    expect(autoLoad()).toBeNull();
  });

  it('autoLoad returns null for corrupt JSON', () => {
    localStorage.setItem(SAVE_KEY, 'not-json{{{');
    expect(autoLoad()).toBeNull();
  });

  it('autoLoad returns null for valid JSON that fails validation', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(autoLoad()).toBeNull();
  });

  it('clearSave is a no-op when nothing is saved', () => {
    expect(() => clearSave()).not.toThrow();
    expect(autoLoad()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// importSave
// ---------------------------------------------------------------------------

describe('importSave', () => {
  function makeFile(content: string, name = 'save.json'): File {
    return new File([content], name, { type: 'application/json' });
  }

  it('resolves with a valid GameState from a correctly wrapped envelope', async () => {
    const state = makeState({ turn: 10 });
    const json = serialiseSave(state);
    const file = makeFile(json);
    const loaded = await importSave(file);
    expect(loaded.turn).toBe(10);
    expect(loaded.seed).toBe('test-seed');
  });

  it('resolves with a bare GameState file (backward compat)', async () => {
    const state = makeState({ turn: 3 });
    const json = JSON.stringify(state);
    const file = makeFile(json);
    const loaded = await importSave(file);
    expect(loaded.turn).toBe(3);
  });

  it('rejects with a user-friendly message for corrupt JSON', async () => {
    const file = makeFile('not valid json {{{');
    const err = await importSave(file).catch((e: unknown) => e);
    expect(typeof err).toBe('string');
    expect((err as string).toLowerCase()).toContain('not valid json');
  });

  it('rejects with a descriptive message for invalid structure', async () => {
    const file = makeFile(JSON.stringify({ hello: 'world' }));
    const err = await importSave(file).catch((e: unknown) => e);
    expect(typeof err).toBe('string');
    expect((err as string).toLowerCase()).toContain('invalid save file');
  });
});
