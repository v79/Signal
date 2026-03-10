import { describe, it, expect } from 'vitest';
import { enqueueNarrative, dismissNarrative } from './narrative';
import type { GameState, NarrativeDef } from './types';
import { createGameState } from './state';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseConfig = {
  seed: 'test',
  playerBlocDefId: 'eu',
  pushFactor: 'climateChange' as const,
  startYear: 1970,
  willProfile: 'democratic' as const,
  startingWill: 50,
  startingResources: { funding: 100, materials: 50, politicalWill: 50 },
};

const techUnlock: NarrativeDef = {
  id: 'narrative-solar-panels',
  title: 'Solar Panels Discovered',
  slides: [{ text: 'Your engineers have perfected photovoltaic cells.' }],
};

const eraTransition: NarrativeDef = {
  id: 'narrative-era-nearspace',
  title: 'Near Space Access Achieved',
  slides: [
    { text: 'The first orbital platform is now operational.', imageColour: '#1a1a4e' },
    { text: 'A new era begins.' },
  ],
};

function makeState(): GameState {
  return createGameState(baseConfig);
}

// ---------------------------------------------------------------------------
// enqueueNarrative
// ---------------------------------------------------------------------------

describe('enqueueNarrative', () => {
  it('adds a narrative to an empty queue', () => {
    const state = makeState();
    const result = enqueueNarrative(state, techUnlock);
    expect(result.narrativeQueue).toHaveLength(1);
    expect(result.narrativeQueue[0].id).toBe('narrative-solar-panels');
  });

  it('appends to an existing queue', () => {
    const state = makeState();
    const after1 = enqueueNarrative(state, techUnlock);
    const after2 = enqueueNarrative(after1, eraTransition);
    expect(after2.narrativeQueue).toHaveLength(2);
    expect(after2.narrativeQueue[1].id).toBe('narrative-era-nearspace');
  });

  it('does not enqueue a narrative already in seenNarrativeIds', () => {
    const state: GameState = {
      ...makeState(),
      seenNarrativeIds: ['narrative-solar-panels'],
    };
    const result = enqueueNarrative(state, techUnlock);
    expect(result.narrativeQueue).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    enqueueNarrative(state, techUnlock);
    expect(state.narrativeQueue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// dismissNarrative
// ---------------------------------------------------------------------------

describe('dismissNarrative', () => {
  it('removes the first narrative from the queue', () => {
    const state = makeState();
    const queued = enqueueNarrative(enqueueNarrative(state, techUnlock), eraTransition);
    const result = dismissNarrative(queued);
    expect(result.narrativeQueue).toHaveLength(1);
    expect(result.narrativeQueue[0].id).toBe('narrative-era-nearspace');
  });

  it('adds the dismissed narrative id to seenNarrativeIds', () => {
    const state = enqueueNarrative(makeState(), techUnlock);
    const result = dismissNarrative(state);
    expect(result.seenNarrativeIds).toContain('narrative-solar-panels');
  });

  it('is a no-op on an empty queue', () => {
    const state = makeState();
    const result = dismissNarrative(state);
    expect(result.narrativeQueue).toHaveLength(0);
    expect(result.seenNarrativeIds).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const state = enqueueNarrative(makeState(), techUnlock);
    dismissNarrative(state);
    expect(state.narrativeQueue).toHaveLength(1);
    expect(state.seenNarrativeIds).toHaveLength(0);
  });
});
