import type {
  CardInstance,
  CardDef,
  CardEffect,
  CounterEffect,
  Era,
} from './types';
import type { Rng } from './rng';

const ERA_ORDER: Record<Era, number> = { earth: 0, nearSpace: 1, deepSpace: 2 };

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
export function drawCards(cards: CardInstance[], rng: Rng, handLimit = HAND_LIMIT): CardInstance[] {
  const handCount = cards.filter((c) => c.zone === 'hand').length;
  const toDraw = Math.max(0, handLimit - handCount);
  if (toDraw === 0) return cards;

  // Recycle discard into deck if needed
  let working = cards;
  const deckCount = working.filter((c) => c.zone === 'deck').length;
  if (deckCount < toDraw) {
    working = working.map((c) => (c.zone === 'discard' ? { ...c, zone: 'deck' as const } : c));
  }

  // Shuffle all deck cards and pick the first N with unique defIds.
  // This prevents drawing two copies of the same card definition in one hand.
  const deckCards = working.filter((c) => c.zone === 'deck');
  const shuffledDeck = rng.shuffle([...deckCards]); // copy before shuffle — shuffle mutates
  const seenDefIds = new Set<string>();
  // Also exclude defIds already in hand (from banked cards returned to hand, etc.)
  for (const c of working) {
    if (c.zone === 'hand') seenDefIds.add(c.defId);
  }
  const drawSet = new Set<string>();
  for (const c of shuffledDeck) {
    if (drawSet.size >= toDraw) break;
    if (seenDefIds.has(c.defId)) continue;
    seenDefIds.add(c.defId);
    drawSet.add(c.id);
  }

  return working.map((c) =>
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
  const card = cards.find((c) => c.id === cardId);
  if (!card || card.zone !== 'hand') return { cards, effect: null };

  const effect = cardDefs.get(card.defId)?.effect ?? null;
  const updated = cards.map((c) => (c.id === cardId ? { ...c, zone: 'discard' as const } : c));
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
  const card = cards.find((c) => c.id === cardId);
  if (!card || (card.zone !== 'hand' && card.zone !== 'bank')) {
    return { cards, counterEffect: null };
  }

  const counterEffect = cardDefs.get(card.defId)?.counterEffect ?? null;
  const updated = cards.map((c) =>
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
  const bankedCount = cards.filter((c) => c.zone === 'bank').length;
  if (bankedCount >= BANK_LIMIT) {
    throw new Error(`Bank is full (limit: ${BANK_LIMIT}). Discard a banked card first.`);
  }

  return cards.map((c) =>
    c.id === cardId && c.zone === 'hand'
      ? { ...c, zone: 'bank' as const, bankedSinceTurn: currentTurn }
      : c,
  );
}

/**
 * Return a card from the bank to the hand.
 * Called during the action or bank phase when the player wants to retrieve a banked card.
 */
export function unbankCard(cards: CardInstance[], cardId: string): CardInstance[] {
  return cards.map((c) =>
    c.id === cardId && c.zone === 'bank'
      ? { ...c, zone: 'hand' as const, bankedSinceTurn: null }
      : c,
  );
}

/**
 * Discard all cards still in hand at the end of the Bank Phase.
 * Called after the player has had the opportunity to bank up to BANK_LIMIT cards.
 */
export function discardHand(cards: CardInstance[]): CardInstance[] {
  return cards.map((c) => (c.zone === 'hand' ? { ...c, zone: 'discard' as const } : c));
}

// ---------------------------------------------------------------------------
// Deck evolution — adding and upgrading cards
// ---------------------------------------------------------------------------

/**
 * Add new card instances to the deck. Called when a technology is
 * discovered or a project completed that unlocks new cards.
 * IDs must be pre-generated by the caller (use `${defId}-t${turn}`).
 */
export function addCardsToDeck(cards: CardInstance[], newCards: CardInstance[]): CardInstance[] {
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
  return cards.map((c) => (c.defId === oldDefId ? { ...c, defId: newDefId } : c));
}

// ---------------------------------------------------------------------------
// Card retirement — obsolescence by tech or era
// ---------------------------------------------------------------------------

/**
 * Move cards that have become obsolete into the 'retired' zone so they can
 * no longer be drawn. Only cards in 'deck' or 'discard' are retired; cards
 * already in 'hand' or 'bank' are left so the player keeps what they drew.
 *
 * Safe to call every world phase — already-retired cards are skipped and
 * the result is idempotent given the same inputs.
 *
 * Returns the updated card list and the def IDs of cards newly retired this
 * call (for news generation by the caller).
 */
export function retireObsoleteCards(
  cards: CardInstance[],
  cardDefs: Map<string, CardDef>,
  allDiscoveredTechIds: string[],
  currentEra: Era,
): { cards: CardInstance[]; retiredDefIds: string[] } {
  const retiredDefIds: string[] = [];
  const updated = cards.map((c) => {
    if (c.zone !== 'deck' && c.zone !== 'discard') return c;
    const def = cardDefs.get(c.defId);
    if (!def) return c;
    const obsoleteByTech = def.obsoletedByTech && allDiscoveredTechIds.includes(def.obsoletedByTech);
    const obsoleteByEra =
      def.obsoletedByEra !== undefined &&
      ERA_ORDER[currentEra] >= ERA_ORDER[def.obsoletedByEra];
    if (obsoleteByTech || obsoleteByEra) {
      if (!retiredDefIds.includes(c.defId)) retiredDefIds.push(c.defId);
      return { ...c, zone: 'retired' as const };
    }
    return c;
  });
  return { cards: updated, retiredDefIds };
}

