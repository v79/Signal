import { describe, it, expect } from 'vitest';
import {
  computeBoardModifiers,
  applyBoardFieldMultipliers,
  applyBoardResourceMultipliers,
  tickBoardAges,
  recruitBoardMember,
  removeBoardMember,
  getBoardAutoCounterTags,
  isBoardSlotVacant,
  getActiveMembers,
  addCommitteeNotification,
  resolveCommitteeNotification,
  dismissCommitteeNotification,
} from './board';
import type { CommitteeNotification } from './types';
import type { BoardMemberDef, BoardSlots, FieldPoints, Resources } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEF_SCIENTIST: BoardMemberDef = {
  id: 'drRamirez',
  name: 'Dr. Elena Ramirez',
  role: 'chiefScientist',
  buffs: [
    {
      description: '+20% Physics output',
      fieldMultipliers: { physics: 1.2 },
    },
  ],
  debuffs: [],
  isAI: false,
  recruitCost: { funding: 20, politicalWill: 15 },
  startAge: 42,
};

const DEF_ENGINEER: BoardMemberDef = {
  id: 'ingMarkov',
  name: 'Ing. Pavel Markov',
  role: 'directorOfEngineering',
  buffs: [
    {
      description: '+15% Materials income',
      resourceMultipliers: { materials: 1.15 },
    },
    {
      description: 'Auto-counters industrial accidents',
      autoCountersEventTag: 'industrial',
    },
  ],
  debuffs: [
    {
      description: '-10% Funding income (budget friction)',
      resourceMultipliers: { funding: 0.9 },
    },
  ],
  isAI: false,
  recruitCost: { funding: 15, politicalWill: 10 },
  startAge: 47,
};

const DEF_SECURITY: BoardMemberDef = {
  id: 'secBristow',
  name: 'Director Bristow',
  role: 'securityDirector',
  buffs: [
    {
      description: 'Auto-counters interference events',
      autoCountersEventTag: 'interference',
    },
  ],
  debuffs: [],
  isAI: false,
  recruitCost: { funding: 20, politicalWill: 5 },
  startAge: 48,
};

const DEFS: Map<string, BoardMemberDef> = new Map([
  ['drRamirez', DEF_SCIENTIST],
  ['ingMarkov', DEF_ENGINEER],
  ['secBristow', DEF_SECURITY],
]);

function makeInstance(defId: string, role: BoardMemberDef['role'], age = 45, turn = 1) {
  return {
    id: `${defId}-t${turn}`,
    defId,
    role,
    age,
    joinedTurn: turn,
    leftTurn: null as null,
    leftReason: null as null,
  };
}

// ---------------------------------------------------------------------------
// computeBoardModifiers
// ---------------------------------------------------------------------------

describe('computeBoardModifiers', () => {
  it('returns identity modifiers for an empty board', () => {
    const mod = computeBoardModifiers({}, DEFS);
    expect(mod.fieldMultipliers).toEqual({});
    expect(mod.resourceMultipliers).toEqual({});
  });

  it('returns single member field multiplier', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist') };
    const mod = computeBoardModifiers(board, DEFS);
    expect(mod.fieldMultipliers?.physics).toBeCloseTo(1.2);
    expect(mod.resourceMultipliers?.materials).toBeUndefined();
  });

  it('compounds multipliers from two members', () => {
    const board: BoardSlots = {
      chiefScientist: makeInstance('drRamirez', 'chiefScientist'),
      directorOfEngineering: makeInstance('ingMarkov', 'directorOfEngineering'),
    };
    const mod = computeBoardModifiers(board, DEFS);
    // Buff 1.15 × debuff 0.9 = 1.035 for materials
    expect(mod.resourceMultipliers?.materials).toBeCloseTo(1.15);
    expect(mod.resourceMultipliers?.funding).toBeCloseTo(0.9);
    expect(mod.fieldMultipliers?.physics).toBeCloseTo(1.2);
  });

  it('skips members whose leftTurn is set', () => {
    const departed = {
      ...makeInstance('drRamirez', 'chiefScientist'),
      leftTurn: 2,
      leftReason: 'retired' as const,
    };
    const board: BoardSlots = { chiefScientist: departed };
    const mod = computeBoardModifiers(board, DEFS);
    expect(mod.fieldMultipliers).toEqual({});
  });

  it('applies no vacant penalties within grace period', () => {
    // turn=3, gracePeriodEnds=4 → still in grace period
    const mod = computeBoardModifiers({}, DEFS, 3, 4);
    expect(mod.fieldMultipliers).toEqual({});
    expect(mod.resourceMultipliers).toEqual({});
  });

  it('applies vacant penalties after grace period', () => {
    // turn=5, gracePeriodEnds=4 → penalties active; all slots vacant
    const mod = computeBoardModifiers({}, DEFS, 5, 4);
    // chiefScientist vacancy → physics and mathematics ×0.9
    expect(mod.fieldMultipliers?.physics).toBeCloseTo(0.9);
    expect(mod.fieldMultipliers?.mathematics).toBeCloseTo(0.9);
    // headOfFinance vacancy (×0.9) compounded with directorOfOperations vacancy (×0.95)
    // = 0.9 × 0.95 = 0.855
    expect(mod.resourceMultipliers?.funding).toBeCloseTo(0.855);
  });

  it('does not double-penalise a filled role', () => {
    // chiefScientist filled — should give +20% physics buff, not vacancy penalty
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist') };
    const mod = computeBoardModifiers(board, DEFS, 5, 4);
    // buff 1.2 — no -10% penalty stacked on top
    expect(mod.fieldMultipliers?.physics).toBeCloseTo(1.2);
  });
});

// ---------------------------------------------------------------------------
// applyBoardFieldMultipliers
// ---------------------------------------------------------------------------

describe('applyBoardFieldMultipliers', () => {
  const baseFields: FieldPoints = {
    physics: 10,
    mathematics: 5,
    engineering: 8,
    biochemistry: 2,
    computing: 4,
    socialScience: 3,
  };

  it('passes through unchanged when no multipliers', () => {
    const mod = { description: '', fieldMultipliers: {} };
    expect(applyBoardFieldMultipliers(baseFields, mod)).toEqual(baseFields);
  });

  it('applies physics multiplier and rounds', () => {
    const mod = { description: '', fieldMultipliers: { physics: 1.2 } };
    const result = applyBoardFieldMultipliers(baseFields, mod);
    expect(result.physics).toBe(12); // Math.round(10 * 1.2)
    expect(result.mathematics).toBe(5); // untouched
  });

  it('does not modify the input object', () => {
    const copy = { ...baseFields };
    const mod = { description: '', fieldMultipliers: { physics: 1.5 } };
    applyBoardFieldMultipliers(baseFields, mod);
    expect(baseFields).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// applyBoardResourceMultipliers
// ---------------------------------------------------------------------------

describe('applyBoardResourceMultipliers', () => {
  const baseResources: Resources = { funding: 20, materials: 10, politicalWill: 0 };

  it('passes through when no multipliers', () => {
    const mod = { description: '', resourceMultipliers: {} };
    expect(applyBoardResourceMultipliers(baseResources, mod)).toEqual(baseResources);
  });

  it('applies materials multiplier', () => {
    const mod = { description: '', resourceMultipliers: { materials: 1.15 } };
    const result = applyBoardResourceMultipliers(baseResources, mod);
    expect(result.materials).toBe(12); // Math.round(10 * 1.15)
    expect(result.funding).toBe(20);
  });

  it('does not amplify negative (upkeep) values', () => {
    const negative: Resources = { funding: -5, materials: 10, politicalWill: 0 };
    const mod = { description: '', resourceMultipliers: { funding: 1.5 } };
    const result = applyBoardResourceMultipliers(negative, mod);
    expect(result.funding).toBe(-5); // negative passes through unchanged
  });
});

// ---------------------------------------------------------------------------
// tickBoardAges
// ---------------------------------------------------------------------------

describe('tickBoardAges', () => {
  it('increments age for active members', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist', 40) };
    const { updatedBoard, newNewsItems } = tickBoardAges(board, DEFS, 5);
    expect(updatedBoard.chiefScientist?.age).toBe(41);
    expect(newNewsItems).toHaveLength(0);
  });

  it('retires member at age 70', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist', 69) };
    const { updatedBoard, newNewsItems } = tickBoardAges(board, DEFS, 10);
    expect(updatedBoard.chiefScientist?.age).toBe(70);
    expect(updatedBoard.chiefScientist?.leftTurn).toBe(10);
    expect(updatedBoard.chiefScientist?.leftReason).toBe('retired');
    expect(newNewsItems).toHaveLength(1);
    expect(newNewsItems[0].turn).toBe(10);
  });

  it('uses character display name in retirement news', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist', 69) };
    const { newNewsItems } = tickBoardAges(board, DEFS, 10);
    expect(newNewsItems[0].text).toContain('Dr. Elena Ramirez');
  });

  it('skips already-departed members', () => {
    const departed = {
      ...makeInstance('drRamirez', 'chiefScientist', 65),
      leftTurn: 3,
      leftReason: 'resigned' as const,
    };
    const board: BoardSlots = { chiefScientist: departed };
    const { updatedBoard, newNewsItems } = tickBoardAges(board, DEFS, 7);
    expect(updatedBoard.chiefScientist?.age).toBe(65); // no change
    expect(newNewsItems).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recruitBoardMember
// ---------------------------------------------------------------------------

describe('recruitBoardMember', () => {
  it('adds the member to the correct role slot', () => {
    const board = recruitBoardMember({}, DEF_SCIENTIST, 42, 5);
    expect(board.chiefScientist?.defId).toBe('drRamirez');
    expect(board.chiefScientist?.age).toBe(42);
    expect(board.chiefScientist?.joinedTurn).toBe(5);
    expect(board.chiefScientist?.leftTurn).toBeNull();
  });

  it('does not mutate the original board', () => {
    const original: BoardSlots = {};
    recruitBoardMember(original, DEF_SCIENTIST, 50, 1);
    expect(original.chiefScientist).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// removeBoardMember
// ---------------------------------------------------------------------------

describe('removeBoardMember', () => {
  it('marks the member as departed', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist') };
    const updated = removeBoardMember(board, 'chiefScientist', 'resigned', 8);
    expect(updated.chiefScientist?.leftTurn).toBe(8);
    expect(updated.chiefScientist?.leftReason).toBe('resigned');
  });

  it('is a no-op for a vacant slot', () => {
    const board: BoardSlots = {};
    const updated = removeBoardMember(board, 'chiefScientist', 'died', 4);
    expect(updated.chiefScientist).toBeUndefined();
  });

  it('is a no-op if member already departed', () => {
    const departed = {
      ...makeInstance('drRamirez', 'chiefScientist'),
      leftTurn: 2,
      leftReason: 'retired' as const,
    };
    const board: BoardSlots = { chiefScientist: departed };
    const updated = removeBoardMember(board, 'chiefScientist', 'died', 6);
    expect(updated.chiefScientist?.leftTurn).toBe(2); // unchanged
  });
});

// ---------------------------------------------------------------------------
// getBoardAutoCounterTags
// ---------------------------------------------------------------------------

describe('getBoardAutoCounterTags', () => {
  it('returns empty array for an empty board', () => {
    expect(getBoardAutoCounterTags({}, DEFS)).toEqual([]);
  });

  it('collects auto-counter tags from active members', () => {
    const board: BoardSlots = {
      directorOfEngineering: makeInstance('ingMarkov', 'directorOfEngineering'),
      securityDirector: makeInstance('secBristow', 'securityDirector'),
    };
    const tags = getBoardAutoCounterTags(board, DEFS);
    expect(tags).toContain('industrial');
    expect(tags).toContain('interference');
  });

  it('excludes tags from departed members', () => {
    const departed = {
      ...makeInstance('ingMarkov', 'directorOfEngineering'),
      leftTurn: 3,
      leftReason: 'retired' as const,
    };
    const board: BoardSlots = { directorOfEngineering: departed };
    expect(getBoardAutoCounterTags(board, DEFS)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isBoardSlotVacant / getActiveMembers
// ---------------------------------------------------------------------------

describe('isBoardSlotVacant', () => {
  it('returns true for an empty slot', () => {
    expect(isBoardSlotVacant({}, 'chiefScientist')).toBe(true);
  });

  it('returns false for an active member', () => {
    const board: BoardSlots = { chiefScientist: makeInstance('drRamirez', 'chiefScientist') };
    expect(isBoardSlotVacant(board, 'chiefScientist')).toBe(false);
  });

  it('returns true for a departed member', () => {
    const departed = {
      ...makeInstance('drRamirez', 'chiefScientist'),
      leftTurn: 2,
      leftReason: 'retired' as const,
    };
    const board: BoardSlots = { chiefScientist: departed };
    expect(isBoardSlotVacant(board, 'chiefScientist')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Committee notifications
// ---------------------------------------------------------------------------

const FLAVOUR_NOTIFICATION: CommitteeNotification = {
  id: 'notif-1',
  memberDefId: 'ingMarkov',
  text: 'Materials procurement is behind schedule.',
  turnCreated: 5,
  dismissed: false,
};

const CHOICE_NOTIFICATION: CommitteeNotification = {
  id: 'notif-2',
  memberDefId: 'drRamirez',
  text: 'Dr. Ramirez requests additional laboratory funding.',
  choices: [
    { label: 'Authorise', resourceDelta: { funding: -20 }, newsText: 'Laboratory funding authorised.' },
    { label: 'Decline' },
  ],
  turnCreated: 6,
  dismissed: false,
};

describe('addCommitteeNotification', () => {
  it('appends a notification to an empty list', () => {
    const result = addCommitteeNotification([], FLAVOUR_NOTIFICATION);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('notif-1');
  });

  it('does not mutate the original array', () => {
    const original: CommitteeNotification[] = [];
    addCommitteeNotification(original, FLAVOUR_NOTIFICATION);
    expect(original).toHaveLength(0);
  });
});

describe('dismissCommitteeNotification', () => {
  it('marks the notification as dismissed', () => {
    const result = dismissCommitteeNotification([FLAVOUR_NOTIFICATION], 'notif-1');
    expect(result[0].dismissed).toBe(true);
  });

  it('is a no-op for an unknown id', () => {
    const result = dismissCommitteeNotification([FLAVOUR_NOTIFICATION], 'unknown');
    expect(result[0].dismissed).toBe(false);
  });
});

describe('resolveCommitteeNotification', () => {
  it('marks the notification as dismissed', () => {
    const { notifications } = resolveCommitteeNotification([CHOICE_NOTIFICATION], 'notif-2', 0);
    expect(notifications[0].dismissed).toBe(true);
  });

  it('returns the resource delta for the chosen option', () => {
    const { resourceDelta } = resolveCommitteeNotification([CHOICE_NOTIFICATION], 'notif-2', 0);
    expect(resourceDelta?.funding).toBe(-20);
  });

  it('returns the news text for the chosen option', () => {
    const { newsText } = resolveCommitteeNotification([CHOICE_NOTIFICATION], 'notif-2', 0);
    expect(newsText).toBe('Laboratory funding authorised.');
  });

  it('returns undefined resourceDelta and newsText when choice has none', () => {
    const { resourceDelta, newsText } = resolveCommitteeNotification([CHOICE_NOTIFICATION], 'notif-2', 1);
    expect(resourceDelta).toBeUndefined();
    expect(newsText).toBeUndefined();
  });
});

describe('getActiveMembers', () => {
  it('returns only active members', () => {
    const departed = {
      ...makeInstance('drRamirez', 'chiefScientist'),
      leftTurn: 1,
      leftReason: 'resigned' as const,
    };
    const board: BoardSlots = {
      chiefScientist: departed,
      directorOfEngineering: makeInstance('ingMarkov', 'directorOfEngineering'),
    };
    const active = getActiveMembers(board);
    expect(active).toHaveLength(1);
    expect(active[0].defId).toBe('ingMarkov');
  });
});
