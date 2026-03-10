import type { GameState, NarrativeDef } from './types';

// ---------------------------------------------------------------------------
// Narrative queue helpers
// ---------------------------------------------------------------------------

/**
 * Add a narrative to the queue, unless it has already been seen this run.
 * Returns an updated GameState (does not mutate the input).
 */
export function enqueueNarrative(state: GameState, def: NarrativeDef): GameState {
  if (state.seenNarrativeIds.includes(def.id)) return state;
  return {
    ...state,
    narrativeQueue: [...state.narrativeQueue, def],
  };
}

/**
 * Mark the first narrative in the queue as seen and remove it.
 * Called when the player closes or skips a narrative modal.
 * Returns an updated GameState (does not mutate the input).
 */
export function dismissNarrative(state: GameState): GameState {
  const [current, ...rest] = state.narrativeQueue;
  if (!current) return state;
  return {
    ...state,
    seenNarrativeIds: [...state.seenNarrativeIds, current.id],
    narrativeQueue: rest,
  };
}
