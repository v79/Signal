import type {
  BoardSlots,
  BoardMemberDef,
  BoardMemberInstance,
  BoardRole,
  CharacterModifier,
  FieldPoints,
  Resources,
  NewsItem,
} from './types';

// ---------------------------------------------------------------------------
// Board (named characters)
//
// The board has seven role slots. Each slot is either vacant or holds an
// active BoardMemberInstance. Characters age each turn; retiring at 70.
// Active board members contribute buff multipliers to facility field and
// resource outputs, and may auto-counter specific event tags.
//
// Buff/debuff multipliers compound multiplicatively across all active members.
// ---------------------------------------------------------------------------

const RETIREMENT_AGE = 70;

// ---------------------------------------------------------------------------
// Modifier aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate all active board members' buffs and debuffs into a single
 * combined CharacterModifier. Multipliers compound multiplicatively.
 * Only active members (leftTurn === null) are included.
 */
export function computeBoardModifiers(
  board: BoardSlots,
  defs: Map<string, BoardMemberDef>,
): CharacterModifier {
  const fieldMultipliers: Partial<FieldPoints> = {};
  const resourceMultipliers: Partial<Resources> = {};

  for (const member of Object.values(board) as (BoardMemberInstance | undefined)[]) {
    if (!member || member.leftTurn !== null) continue;
    const def = defs.get(member.defId);
    if (!def) continue;

    for (const modifier of [...def.buffs, ...def.debuffs]) {
      if (modifier.fieldMultipliers) {
        for (const [field, mult] of Object.entries(modifier.fieldMultipliers)) {
          const k = field as keyof FieldPoints;
          fieldMultipliers[k] = (fieldMultipliers[k] ?? 1) * (mult ?? 1);
        }
      }
      if (modifier.resourceMultipliers) {
        for (const [res, mult] of Object.entries(modifier.resourceMultipliers)) {
          const k = res as keyof Resources;
          resourceMultipliers[k] = (resourceMultipliers[k] ?? 1) * (mult ?? 1);
        }
      }
    }
  }

  return {
    description: 'Combined board modifiers',
    fieldMultipliers,
    resourceMultipliers,
  };
}

// ---------------------------------------------------------------------------
// Multiplier application
// ---------------------------------------------------------------------------

/**
 * Apply board field multipliers to a per-turn field delta.
 * Only fields present in the modifier are affected; others pass through.
 */
export function applyBoardFieldMultipliers(
  fields: FieldPoints,
  modifier: CharacterModifier,
): FieldPoints {
  if (!modifier.fieldMultipliers || Object.keys(modifier.fieldMultipliers).length === 0) {
    return fields;
  }
  const result = { ...fields };
  for (const [field, mult] of Object.entries(modifier.fieldMultipliers)) {
    const k = field as keyof FieldPoints;
    result[k] = Math.round(result[k] * (mult ?? 1));
  }
  return result;
}

/**
 * Apply board resource multipliers to a per-turn resource delta.
 * Multipliers apply to facility output (positive values); negative deltas
 * (upkeep) pass through unchanged to avoid amplifying costs.
 */
export function applyBoardResourceMultipliers(
  resources: Resources,
  modifier: CharacterModifier,
): Resources {
  if (!modifier.resourceMultipliers || Object.keys(modifier.resourceMultipliers).length === 0) {
    return resources;
  }
  return {
    funding:       resources.funding       > 0 ? Math.round(resources.funding       * (modifier.resourceMultipliers.funding       ?? 1)) : resources.funding,
    materials:     resources.materials     > 0 ? Math.round(resources.materials     * (modifier.resourceMultipliers.materials     ?? 1)) : resources.materials,
    politicalWill: resources.politicalWill > 0 ? Math.round(resources.politicalWill * (modifier.resourceMultipliers.politicalWill ?? 1)) : resources.politicalWill,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Tick ages on all active board members by one year. Members who reach or
 * exceed RETIREMENT_AGE are marked retired and a news item is generated.
 */
export function tickBoardAges(
  board: BoardSlots,
  turn: number,
): { updatedBoard: BoardSlots; newNewsItems: NewsItem[] } {
  const updatedBoard: BoardSlots = { ...board };
  const newNewsItems: NewsItem[] = [];

  for (const role of Object.keys(board) as BoardRole[]) {
    const member = board[role];
    if (!member || member.leftTurn !== null) continue;

    const newAge = member.age + 1;
    if (newAge >= RETIREMENT_AGE) {
      updatedBoard[role] = { ...member, age: newAge, leftTurn: turn, leftReason: 'retired' };
      newNewsItems.push({
        id: `retire-${member.id}-t${turn}`,
        turn,
        text: `Board member ${member.id} has retired after a long and distinguished career.`,
      });
    } else {
      updatedBoard[role] = { ...member, age: newAge };
    }
  }

  return { updatedBoard, newNewsItems };
}

/**
 * Place a character in their role slot on the board.
 * If the slot is already occupied by an active member, the recruit is rejected
 * (caller should check vacancy first).
 */
export function recruitBoardMember(
  board: BoardSlots,
  def: BoardMemberDef,
  startAge: number,
  turn: number,
): BoardSlots {
  const instance: BoardMemberInstance = {
    id: `${def.id}-t${turn}`,
    defId: def.id,
    role: def.role,
    age: startAge,
    joinedTurn: turn,
    leftTurn: null,
    leftReason: null,
  };
  return { ...board, [def.role]: instance };
}

/**
 * Mark an active board member as having left (retired, resigned, died,
 * or sacrificed). The instance remains in the slot with leftTurn set.
 */
export function removeBoardMember(
  board: BoardSlots,
  role: BoardRole,
  reason: BoardMemberInstance['leftReason'],
  turn: number,
): BoardSlots {
  const member = board[role];
  if (!member || member.leftTurn !== null) return board;
  return { ...board, [role]: { ...member, leftTurn: turn, leftReason: reason } };
}

// ---------------------------------------------------------------------------
// Auto-counter helpers
// ---------------------------------------------------------------------------

/**
 * Return the list of event tags that active board members can auto-counter
 * without a card play (derived from buff.autoCountersEventTag).
 */
export function getBoardAutoCounterTags(
  board: BoardSlots,
  defs: Map<string, BoardMemberDef>,
): string[] {
  const tags: string[] = [];
  for (const member of Object.values(board) as (BoardMemberInstance | undefined)[]) {
    if (!member || member.leftTurn !== null) continue;
    const def = defs.get(member.defId);
    if (!def) continue;
    for (const buff of def.buffs) {
      if (buff.autoCountersEventTag) tags.push(buff.autoCountersEventTag);
    }
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Vacancy check helpers
// ---------------------------------------------------------------------------

/** True if the given role slot is empty or was vacated (leftTurn is set). */
export function isBoardSlotVacant(board: BoardSlots, role: BoardRole): boolean {
  const member = board[role];
  return !member || member.leftTurn !== null;
}

/** Return all currently active board members (leftTurn === null). */
export function getActiveMembers(board: BoardSlots): BoardMemberInstance[] {
  return (Object.values(board) as (BoardMemberInstance | undefined)[])
    .filter((m): m is BoardMemberInstance => !!m && m.leftTurn === null);
}
