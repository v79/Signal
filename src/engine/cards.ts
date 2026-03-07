import type {
  CardInstance,
  CardDef,
  CardEffect,
  CounterEffect,
  StandingActionRestriction,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum cards in hand at the start of a Draw Phase. */
export const HAND_LIMIT = 5;

/** Maximum cards held in the bank between turns (GDD §13.3). */
export const BANK_LIMIT = 2;

// ---------------------------------------------------------------------------
// Draw Phase
// ---------------------------------------------------------------------------

/**
 * Draw cards from the deck into the hand up to `handLimit`.
 * If the deck has fewer cards than needed, the discard pile is recycled
 * into the deck and shuffled before drawing.
 *
 * PRNG call: one `rng.shuffle()` call per draw operation.
 * This always consumes the same number of RNG calls regardless of whether
 * a recycle was needed, keeping the PRNG stream stable.
 */
export function drawCards(
  cards: CardInstance[],
  rng: Rng,
  handLimit = HAND_LIMIT,
): CardInstance[] {
  const handCount = cards.filter(c => c.zone === 'hand').length;
  const toDraw = Math.max(0, handLimit - handCount);
  if (toDraw === 0) return cards;

  // Recycle discard into deck if needed
  let working = cards;
  const deckCount = working.filter(c => c.zone === 'deck').length;
  if (deckCount < toDraw) {
    working = working.map(c => c.zone === 'discard' ? { ...c, zone: 'deck' as const } : c);
  }

  // Shuffle all deck card IDs and pick the first N
  const deckIds = working.filter(c => c.zone === 'deck').map(c => c.id);
  const shuffled = rng.shuffle([...deckIds]); // copy before shuffle — shuffle mutates
  const drawSet = new Set(shuffled.slice(0, toDraw));

  return working.map(c =>
    c.zone === 'deck' && drawSet.has(c.id) ? { ...c, zone: 'hand' as const } : c,
  );
}

// ---------------------------------------------------------------------------
// Action Phase — playing cards
// ---------------------------------------------------------------------------

/**
 * Play a card from hand as an action. Moves the card to discard and
 * returns its effect. Returns null effect if the card isn't in hand or
 * has no def.
 */
export function playCardFromHand(
  cards: CardInstance[],
  cardId: string,
  cardDefs: Map<string, CardDef>,
): { cards: CardInstance[]; effect: CardEffect | null } {
  const card = cards.find(c => c.id === cardId);
  if (!card || card.zone !== 'hand') return { cards, effect: null };

  const effect = cardDefs.get(card.defId)?.effect ?? null;
  const updated = cards.map(c =>
    c.id === cardId ? { ...c, zone: 'discard' as const } : c,
  );
  return { cards: updated, effect };
}

/**
 * Play a card as a counter during the Event Phase.
 * The card may come from hand or bank. Moves it to discard.
 * Returns null if the card isn't found or has no counter effect.
 */
export function playCardAsCounter(
  cards: CardInstance[],
  cardId: string,
  cardDefs: Map<string, CardDef>,
): { cards: CardInstance[]; counterEffect: CounterEffect | null } {
  const card = cards.find(c => c.id === cardId);
  if (!card || (card.zone !== 'hand' && card.zone !== 'bank')) {
    return { cards, counterEffect: null };
  }

  const counterEffect = cardDefs.get(card.defId)?.counterEffect ?? null;
  const updated = cards.map(c =>
    c.id === cardId ? { ...c, zone: 'discard' as const, bankedSinceTurn: null } : c,
  );
  return { cards: updated, counterEffect };
}

// ---------------------------------------------------------------------------
// Bank Phase
// ---------------------------------------------------------------------------

/**
 * Move a card from hand to bank. Throws if the bank is already full.
 * Records the current turn so bank decay can be computed.
 */
export function bankCard(
  cards: CardInstance[],
  cardId: string,
  currentTurn: number,
): CardInstance[] {
  const bankedCount = cards.filter(c => c.zone === 'bank').length;
  if (bankedCount >= BANK_LIMIT) {
    throw new Error(`Bank is full (limit: ${BANK_LIMIT}). Discard a banked card first.`);
  }

  return cards.map(c =>
    c.id === cardId && c.zone === 'hand'
      ? { ...c, zone: 'bank' as const, bankedSinceTurn: currentTurn }
      : c,
  );
}

/**
 * Remove a card from the bank back to discard (e.g. to make room for another).
 */
export function unbankCard(cards: CardInstance[], cardId: string): CardInstance[] {
  return cards.map(c =>
    c.id === cardId && c.zone === 'bank'
      ? { ...c, zone: 'discard' as const, bankedSinceTurn: null }
      : c,
  );
}

/**
 * Discard all cards still in hand at the end of the Bank Phase.
 * Called after the player has had the opportunity to bank up to BANK_LIMIT cards.
 */
export function discardHand(cards: CardInstance[]): CardInstance[] {
  return cards.map(c => c.zone === 'hand' ? { ...c, zone: 'discard' as const } : c);
}

// ---------------------------------------------------------------------------
// Deck evolution — adding and upgrading cards
// ---------------------------------------------------------------------------

/**
 * Add new card instances to the deck. Called when a technology is
 * discovered or a project completed that unlocks new cards.
 * IDs must be pre-generated by the caller (use `${defId}-t${turn}`).
 */
export function addCardsToDeck(
  cards: CardInstance[],
  newCards: CardInstance[],
): CardInstance[] {
  return [...cards, ...newCards];
}

/**
 * Replace an obsolete card with its upgraded version in-place.
 * The upgraded card inherits the zone and position of the old card
 * so players don't lose banked cards mid-run.
 */
export function upgradeCard(
  cards: CardInstance[],
  oldDefId: string,
  newDefId: string,
): CardInstance[] {
  return cards.map(c =>
    c.defId === oldDefId ? { ...c, defId: newDefId } : c,
  );
}

// ---------------------------------------------------------------------------
// Standing action restrictions
// ---------------------------------------------------------------------------

/**
 * Return only the restrictions that are still active this turn.
 * Restrictions with `expiresAfterTurn < currentTurn` are dropped.
 */
export function getActiveRestrictions(
  restrictions: StandingActionRestriction[],
  currentTurn: number,
): StandingActionRestriction[] {
  return restrictions.filter(r => r.expiresAfterTurn >= currentTurn);
}

/**
 * Check whether a specific standing action is currently restricted.
 */
export function isActionRestricted(
  actionId: string,
  restrictions: StandingActionRestriction[],
  currentTurn: number,
): boolean {
  return getActiveRestrictions(restrictions, currentTurn).some(r => r.actionId === actionId);
}
