// =============================================================================
// Construction queue tests: enqueue, tick, completion, demolition
// =============================================================================

import { describe, it, expect } from 'vitest';
import { tickConstructionQueue } from './facilities';
import type { OngoingAction, FacilityInstance, MapTile } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAction(overrides: Partial<OngoingAction> = {}): OngoingAction {
  return {
    id: 'action-1',
    type: 'construct',
    facilityDefId: 'researchLab',
    coordKey: '1,0',
    turnsRemaining: 2,
    totalTurns: 2,
    ...overrides,
  };
}

function makeTile(q: number, r: number, opts: Partial<MapTile> = {}): MapTile {
  return {
    coord: { q, r },
    type: 'urban',
    destroyedStatus: null,
    productivity: 1,
    mineDepletion: 1,
    facilityId: null,
    pendingActionId: null,
    ...opts,
  };
}

function makeFacility(overrides: Partial<FacilityInstance> = {}): FacilityInstance {
  return {
    id: 'f1',
    defId: 'researchLab',
    locationKey: '1,0',
    condition: 1,
    builtTurn: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// tickConstructionQueue — construct
// ---------------------------------------------------------------------------

describe('tickConstructionQueue — construct', () => {
  it('decrements turnsRemaining each call', () => {
    const action = makeAction({ turnsRemaining: 3, totalTurns: 3 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [], [tile], 5);
    expect(result.updatedQueue).toHaveLength(1);
    expect(result.updatedQueue[0].turnsRemaining).toBe(2);
    expect(result.completedActions).toHaveLength(0);
  });

  it('completes when turnsRemaining reaches 0', () => {
    const action = makeAction({ turnsRemaining: 1, totalTurns: 2 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [], [tile], 10);
    expect(result.updatedQueue).toHaveLength(0);
    expect(result.completedActions).toHaveLength(1);
    expect(result.updatedFacilities).toHaveLength(1);
    expect(result.updatedFacilities[0].defId).toBe('researchLab');
    expect(result.updatedFacilities[0].locationKey).toBe('1,0');
  });

  it('sets tile.facilityId on completion', () => {
    const action = makeAction({ turnsRemaining: 1, totalTurns: 2 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [], [tile], 10);
    const updatedTile = result.updatedTiles.find((t) => t.coord.q === 1 && t.coord.r === 0);
    expect(updatedTile?.facilityId).toBeTruthy();
    expect(updatedTile?.facilityId).toContain('researchLab');
  });

  it('clears tile.pendingActionId on completion', () => {
    const action = makeAction({ turnsRemaining: 1, totalTurns: 2 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [], [tile], 10);
    const updatedTile = result.updatedTiles.find((t) => t.coord.q === 1 && t.coord.r === 0);
    expect(updatedTile?.pendingActionId).toBeNull();
  });

  it('does not mutate input arrays', () => {
    const action = makeAction({ turnsRemaining: 2, totalTurns: 2 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const origQueue = [action];
    const origTiles = [tile];
    tickConstructionQueue(origQueue, [], origTiles, 5);
    expect(origQueue[0].turnsRemaining).toBe(2); // unchanged
    expect(origTiles[0].pendingActionId).toBe('action-1'); // unchanged
  });

  it('handles multiple concurrent actions', () => {
    const a1 = makeAction({ id: 'a1', coordKey: '1,0', turnsRemaining: 1, totalTurns: 2 });
    const a2 = makeAction({ id: 'a2', coordKey: '2,0', turnsRemaining: 2, totalTurns: 2 });
    const t1 = makeTile(1, 0, { pendingActionId: 'a1' });
    const t2 = makeTile(2, 0, { pendingActionId: 'a2' });
    const result = tickConstructionQueue([a1, a2], [], [t1, t2], 10);
    // a1 completes, a2 still in progress
    expect(result.updatedQueue).toHaveLength(1);
    expect(result.updatedQueue[0].id).toBe('a2');
    expect(result.completedActions).toHaveLength(1);
    expect(result.completedActions[0].id).toBe('a1');
    expect(result.updatedFacilities).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// tickConstructionQueue — demolish
// ---------------------------------------------------------------------------

describe('tickConstructionQueue — demolish', () => {
  it('decrements turnsRemaining while in progress', () => {
    const action = makeAction({ type: 'demolish', turnsRemaining: 2, totalTurns: 2 });
    const facility = makeFacility();
    const tile = makeTile(1, 0, { facilityId: 'f1', pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [facility], [tile], 5);
    expect(result.updatedQueue).toHaveLength(1);
    expect(result.updatedFacilities).toHaveLength(1); // not removed yet
  });

  it('removes facility on completion', () => {
    const action = makeAction({ type: 'demolish', turnsRemaining: 1, totalTurns: 1 });
    const facility = makeFacility();
    const tile = makeTile(1, 0, { facilityId: 'f1', pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [facility], [tile], 5);
    expect(result.updatedQueue).toHaveLength(0);
    expect(result.updatedFacilities).toHaveLength(0);
  });

  it('clears tile.facilityId and pendingActionId on demolish completion', () => {
    const action = makeAction({ type: 'demolish', turnsRemaining: 1, totalTurns: 1 });
    const facility = makeFacility();
    const tile = makeTile(1, 0, { facilityId: 'f1', pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [facility], [tile], 5);
    const updatedTile = result.updatedTiles.find((t) => t.coord.q === 1);
    expect(updatedTile?.facilityId).toBeNull();
    expect(updatedTile?.pendingActionId).toBeNull();
  });

  it('only removes the facility at the matching coordKey', () => {
    const action = makeAction({
      type: 'demolish',
      turnsRemaining: 1,
      totalTurns: 1,
      coordKey: '1,0',
    });
    const f1 = makeFacility({ id: 'f1', locationKey: '1,0' });
    const f2 = makeFacility({ id: 'f2', locationKey: '2,0' });
    const t1 = makeTile(1, 0, { facilityId: 'f1', pendingActionId: 'action-1' });
    const t2 = makeTile(2, 0, { facilityId: 'f2' });
    const result = tickConstructionQueue([action], [f1, f2], [t1, t2], 5);
    expect(result.updatedFacilities).toHaveLength(1);
    expect(result.updatedFacilities[0].id).toBe('f2');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('tickConstructionQueue — edge cases', () => {
  it('returns unchanged arrays when queue is empty', () => {
    const tile = makeTile(0, 0);
    const result = tickConstructionQueue([], [], [tile], 1);
    expect(result.updatedQueue).toHaveLength(0);
    expect(result.updatedFacilities).toHaveLength(0);
    expect(result.updatedTiles).toHaveLength(1);
    expect(result.completedActions).toHaveLength(0);
  });

  it('includes completedTurn in the built facility id', () => {
    const action = makeAction({ turnsRemaining: 1, totalTurns: 2 });
    const tile = makeTile(1, 0, { pendingActionId: 'action-1' });
    const result = tickConstructionQueue([action], [], [tile], 42);
    expect(result.updatedFacilities[0].id).toContain('t42');
    expect(result.updatedFacilities[0].builtTurn).toBe(42);
  });
});
