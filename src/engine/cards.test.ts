import { describe, it, expect } from 'vitest';
import {
  drawCards,
  playCardFromHand,
  playCardAsCounter,
  bankCard,
  unbankCard,
  discardHand,
  addCardsToDeck,
  upgradeCard,
  getActiveRestrictions,
  isActionRestricted,
  HAND_LIMIT,
  BANK_LIMIT,
} from './cards';
import { createRng } from './rng';
import type { CardDef, CardInstance, StandingActionRestriction } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, defId: string, zone: CardInstance['zone']): CardInstance {
  return { id, defId, zone, bankedSinceTurn: zone === 'bank' ? 1 : null };
}

const lobbyingDef: CardDef = {
  id: 'lobbying',
  name: 'Political Lobbying',
  description: '',
  flavourText: '',
  era: 'earth',
  effect: { resources: { politicalWill: 5 } },
  counterEffect: {
    countersEventTag: 'interference',
    additionalCost: { politicalWill: 10 },
    fullNeutralise: true,
  },
  upgradesFrom: null,
};

const academicDef: CardDef = {
  id: 'academic',
  name: 'Academic Conference',
  description: '',
  flavourText: '',
  era: 'earth',
  effect: { fields: { physics: 5, mathematics: 5 } },
  counterEffect: null,
  upgradesFrom: null,
};

const advancedAcademicDef: CardDef = {
  id: 'advancedAcademic',
  name: 'International Research Summit',
  description: '',
  flavourText: '',
  era: 'nearSpace',
  effect: { fields: { physics: 12, mathematics: 12 } },
  counterEffect: null,
  upgradesFrom: 'academic',
};

const defs = new Map([
  ['lobbying', lobbyingDef],
  ['academic', academicDef],
  ['advancedAcademic', advancedAcademicDef],
]);

// ---------------------------------------------------------------------------
// drawCards
// ---------------------------------------------------------------------------

describe('drawCards', () => {
  it('draws up to HAND_LIMIT cards from the deck', () => {
    const cards = Array.from({ length: 8 }, (_, i) => makeCard(`c${i}`, 'academic', 'deck'));
    const result = drawCards(cards, createRng('draw1'));
    expect(result.filter(c => c.zone === 'hand')).toHaveLength(HAND_LIMIT);
    expect(result.filter(c => c.zone === 'deck')).toHaveLength(3);
  });

  it('does not draw if hand is already at limit', () => {
    const hand = Array.from({ length: HAND_LIMIT }, (_, i) => makeCard(`h${i}`, 'academic', 'hand'));
    const deck = [makeCard('d1', 'academic', 'deck')];
    const result = drawCards([...hand, ...deck], createRng('draw2'));
    expect(result.filter(c => c.zone === 'hand')).toHaveLength(HAND_LIMIT);
    expect(result.filter(c => c.zone === 'deck')).toHaveLength(1);
  });

  it('recycles discard pile when deck is depleted', () => {
    const deck = [makeCard('d1', 'academic', 'deck')];
    const discard = Array.from({ length: 6 }, (_, i) => makeCard(`disc${i}`, 'academic', 'discard'));
    const result = drawCards([...deck, ...discard], createRng('recycle'));
    expect(result.filter(c => c.zone === 'hand')).toHaveLength(HAND_LIMIT);
    // Former discard cards are now deck or hand
    const discardRemaining = result.filter(c => c.zone === 'discard');
    expect(discardRemaining).toHaveLength(0);
  });

  it('only draws as many cards as exist when total < hand limit', () => {
    const cards = [makeCard('d1', 'academic', 'deck'), makeCard('d2', 'academic', 'deck')];
    const result = drawCards(cards, createRng('few'));
    expect(result.filter(c => c.zone === 'hand')).toHaveLength(2);
  });

  it('is deterministic for the same seed', () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`, 'academic', 'deck'));
    const r1 = drawCards(cards, createRng('det'));
    const r2 = drawCards(cards, createRng('det'));
    expect(r1.map(c => c.zone)).toEqual(r2.map(c => c.zone));
  });

  it('does not mutate the input array', () => {
    const cards = Array.from({ length: 6 }, (_, i) => makeCard(`c${i}`, 'academic', 'deck'));
    const original = cards.map(c => ({ ...c }));
    drawCards(cards, createRng('mut'));
    expect(cards).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// playCardFromHand
// ---------------------------------------------------------------------------

describe('playCardFromHand', () => {
  it('moves the card to discard and returns its effect', () => {
    const cards = [makeCard('c1', 'lobbying', 'hand')];
    const { cards: result, effect } = playCardFromHand(cards, 'c1', defs);
    expect(result.find(c => c.id === 'c1')?.zone).toBe('discard');
    expect(effect?.resources?.politicalWill).toBe(5);
  });

  it('returns null effect if card is not in hand', () => {
    const cards = [makeCard('c1', 'lobbying', 'deck')];
    const { effect } = playCardFromHand(cards, 'c1', defs);
    expect(effect).toBeNull();
  });

  it('returns null effect if card def is not found', () => {
    const cards = [makeCard('c1', 'unknown', 'hand')];
    const { effect } = playCardFromHand(cards, 'c1', defs);
    expect(effect).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// playCardAsCounter
// ---------------------------------------------------------------------------

describe('playCardAsCounter', () => {
  it('plays a hand card as a counter and returns counter effect', () => {
    const cards = [makeCard('c1', 'lobbying', 'hand')];
    const { cards: result, counterEffect } = playCardAsCounter(cards, 'c1', defs);
    expect(result.find(c => c.id === 'c1')?.zone).toBe('discard');
    expect(counterEffect?.countersEventTag).toBe('interference');
    expect(counterEffect?.fullNeutralise).toBe(true);
  });

  it('plays a banked card as a counter', () => {
    const cards = [makeCard('c1', 'lobbying', 'bank')];
    const { cards: result, counterEffect } = playCardAsCounter(cards, 'c1', defs);
    expect(result.find(c => c.id === 'c1')?.zone).toBe('discard');
    expect(counterEffect).not.toBeNull();
  });

  it('returns null if card has no counter effect', () => {
    const cards = [makeCard('c1', 'academic', 'hand')];
    const { counterEffect } = playCardAsCounter(cards, 'c1', defs);
    expect(counterEffect).toBeNull();
  });

  it('returns null if card is in deck (not playable as counter)', () => {
    const cards = [makeCard('c1', 'lobbying', 'deck')];
    const { counterEffect } = playCardAsCounter(cards, 'c1', defs);
    expect(counterEffect).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// bankCard / unbankCard
// ---------------------------------------------------------------------------

describe('bankCard', () => {
  it('moves a hand card to the bank and records the turn', () => {
    const cards = [makeCard('c1', 'academic', 'hand')];
    const result = bankCard(cards, 'c1', 5);
    const banked = result.find(c => c.id === 'c1')!;
    expect(banked.zone).toBe('bank');
    expect(banked.bankedSinceTurn).toBe(5);
  });

  it('throws when the bank is already full', () => {
    const cards = [
      makeCard('b1', 'academic', 'bank'),
      makeCard('b2', 'academic', 'bank'),
      makeCard('h1', 'academic', 'hand'),
    ];
    expect(() => bankCard(cards, 'h1', 5)).toThrow();
  });

  it(`allows up to ${BANK_LIMIT} cards in the bank`, () => {
    let cards: CardInstance[] = Array.from({ length: BANK_LIMIT + 1 }, (_, i) =>
      makeCard(`h${i}`, 'academic', 'hand'),
    );
    for (let i = 0; i < BANK_LIMIT; i++) {
      cards = bankCard(cards, `h${i}`, 1);
    }
    expect(cards.filter(c => c.zone === 'bank')).toHaveLength(BANK_LIMIT);
    expect(() => bankCard(cards, `h${BANK_LIMIT}`, 1)).toThrow();
  });
});

describe('unbankCard', () => {
  it('returns a banked card to discard', () => {
    const cards = [{ ...makeCard('c1', 'academic', 'bank'), bankedSinceTurn: 3 }];
    const result = unbankCard(cards, 'c1');
    const card = result.find(c => c.id === 'c1')!;
    expect(card.zone).toBe('discard');
    expect(card.bankedSinceTurn).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// discardHand
// ---------------------------------------------------------------------------

describe('discardHand', () => {
  it('moves all hand cards to discard', () => {
    const cards = [
      makeCard('h1', 'academic', 'hand'),
      makeCard('h2', 'lobbying', 'hand'),
      makeCard('b1', 'academic', 'bank'),
      makeCard('d1', 'academic', 'deck'),
    ];
    const result = discardHand(cards);
    expect(result.filter(c => c.zone === 'hand')).toHaveLength(0);
    expect(result.filter(c => c.zone === 'discard')).toHaveLength(2);
    expect(result.filter(c => c.zone === 'bank')).toHaveLength(1);
    expect(result.filter(c => c.zone === 'deck')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// addCardsToDeck / upgradeCard
// ---------------------------------------------------------------------------

describe('addCardsToDeck', () => {
  it('appends new cards to the collection as deck cards', () => {
    const existing = [makeCard('c1', 'academic', 'deck')];
    const newCards = [makeCard('c2', 'lobbying', 'deck')];
    const result = addCardsToDeck(existing, newCards);
    expect(result).toHaveLength(2);
    expect(result.find(c => c.id === 'c2')?.zone).toBe('deck');
  });
});

describe('upgradeCard', () => {
  it('replaces the old def ID with the new one, preserving zone', () => {
    const cards = [
      makeCard('c1', 'academic', 'hand'),
      makeCard('c2', 'academic', 'deck'),
    ];
    const result = upgradeCard(cards, 'academic', 'advancedAcademic');
    expect(result.every(c => c.defId === 'advancedAcademic')).toBe(true);
    expect(result.find(c => c.id === 'c1')?.zone).toBe('hand'); // zone preserved
  });

  it('leaves cards with other def IDs unchanged', () => {
    const cards = [makeCard('c1', 'lobbying', 'hand')];
    const result = upgradeCard(cards, 'academic', 'advancedAcademic');
    expect(result[0].defId).toBe('lobbying');
  });
});

// ---------------------------------------------------------------------------
// Standing action restrictions
// ---------------------------------------------------------------------------

describe('getActiveRestrictions', () => {
  const restrictions: StandingActionRestriction[] = [
    { actionId: 'build', expiresAfterTurn: 5 },
    { actionId: 'recruit', expiresAfterTurn: 3 },
    { actionId: 'trade', expiresAfterTurn: 8 },
  ];

  it('returns only restrictions active on the current turn', () => {
    const active = getActiveRestrictions(restrictions, 4);
    expect(active.map(r => r.actionId)).toContain('build');
    expect(active.map(r => r.actionId)).not.toContain('recruit');
    expect(active.map(r => r.actionId)).toContain('trade');
  });

  it('includes restrictions that expire exactly this turn', () => {
    const active = getActiveRestrictions(restrictions, 5);
    expect(active.map(r => r.actionId)).toContain('build');
  });

  it('returns empty when all restrictions have expired', () => {
    expect(getActiveRestrictions(restrictions, 10)).toHaveLength(0);
  });
});

describe('isActionRestricted', () => {
  it('returns true for a currently restricted action', () => {
    const r: StandingActionRestriction[] = [{ actionId: 'build', expiresAfterTurn: 5 }];
    expect(isActionRestricted('build', r, 4)).toBe(true);
  });

  it('returns false for an unrestricted action', () => {
    const r: StandingActionRestriction[] = [{ actionId: 'build', expiresAfterTurn: 5 }];
    expect(isActionRestricted('recruit', r, 4)).toBe(false);
  });

  it('returns false when the restriction has expired', () => {
    const r: StandingActionRestriction[] = [{ actionId: 'build', expiresAfterTurn: 3 }];
    expect(isActionRestricted('build', r, 4)).toBe(false);
  });
});
