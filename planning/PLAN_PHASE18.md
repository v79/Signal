# Phase 18 — Actions & Cards Rework

## Goal

Fix broken game mechanics (event countering), add meaningful constraints to card play (action cap), rebalance bank cost, improve phase legibility, and address the Earth-era death-spiral problem. No new tech content or art; this phase is about making the existing systems work correctly and feel fair.

## Context

From `FUTURE_PHASES.md` items this phase addresses:

> - **Actions rework:** What is the point of the draw/action/bank phases? There should be a cap on actions taken in a turn. How are Events countered? (Doesn't seem to be working)
> - **Card rework:** A better bank, shown to the side of the cards. Bank can store up to two cards, at a cost of Will (not Funding). There is no limit to the number of cards that can be played, given sufficient resources.
> - **Further Earth era content:** Funding is hard to come by. Negative events happen too frequently. There's no way of recovering from a funding/materials death spiral.

Out of scope for Phase 18:

- More cards / tech-gated cards
- Card/hand animations (deal-in, play, bank slide)
- Tech tree dependencies
- Narrative elements
- LEO / Asteroid era content

---

## Current State (pre-Phase 18)

**fullCounter resolution — broken at store level.** `CardDef.countersEventTag` (e.g. `'scandal'`, `'interference'`) is matched against `EventDef.tags`. The engine function `playCardAsCounter()` in `cards.ts` exists and is tested. However, `game.svelte.ts::playCard()` never calls it — playing a counter card applies only the card's resource/field effect; the event is never resolved. The EventZone hint "Counter with a matching card." leads nowhere.

**Action cap — not implemented.** `GameState` has no `actionsThisTurn` field. An unlimited number of cards can be played each turn if resources allow.

**Bank cost — 1 Funding/turn per banked card.** FUTURE_PHASES specifies this should change to **Will**.

**Phase legibility — weak.** The current phase is shown only in `PhaseControls`. Players don't clearly see which actions are unavailable and why during each phase.

**Earth era balance — skewed negative.** `selectNewEvents` has no early-turn dampening. HQ upkeep relief is minimal. No recovery option from a resource death spiral.

---

## Tasks

### 18.1 — Fix fullCounter event countering ✅ PRIORITY

**Problem:** Playing a card with `countersEventTag` does nothing to active `fullCounter` events.

**Mechanic (to preserve from GDD):** Playing a card is the counter action — you play it for its normal effect and it *also* clears a matching event. The player should not need to press a separate "counter" button. The card is the response.

**Implementation:**

**`src/lib/stores/game.svelte.ts` — `playCard()`:**

After the existing card-play logic, add a counter-check:

```typescript
// After applying card effect and moving card to discard:
const def = cardDefs.get(card.defId);
if (def?.countersEventTag) {
  const tag = def.countersEventTag;
  const matched = _state.activeEvents.find(
    (e) =>
      !e.resolved &&
      eventDefs.get(e.defId)?.responseTier === 'fullCounter' &&
      (eventDefs.get(e.defId)?.tags ?? []).includes(tag),
  );
  if (matched) {
    _state.activeEvents = _state.activeEvents.map((e) =>
      e.id === matched.id ? { ...e, resolved: true, resolvedWith: 'counter' as const } : e,
    );
    const eventName = eventDefs.get(matched.defId)?.name ?? matched.defId;
    const newsItem: NewsItem = {
      id: crypto.randomUUID(),
      turn: _state.turn,
      text: `${eventName} countered by ${def.name}.`,
      category: 'event-gain',
    };
    _state.player = {
      ..._state.player,
      newsFeed: [..._state.player.newsFeed, newsItem],
    };
  }
}
```

This requires importing `EVENT_DEFS` into `game.svelte.ts` (it likely already imports `CARD_DEFS`; add `EVENT_DEFS` alongside it).

**`src/lib/components/EventZone.svelte` — counter-hint text:**

The existing hint "Counter with a matching card." should name the tag explicitly:

```svelte
{:else if def.responseTier === 'fullCounter'}
  <span class="counter-hint">
    Counter with a <strong>{counterTag(def)}</strong> card.
  </span>
```

Add a helper:

```typescript
function counterTag(def: EventDef): string {
  // derive the expected tag from known fullCounter events
  // Events' tags list the category; we display the first non-'crisis' tag
  return def.tags.find((t) => t !== 'crisis') ?? def.tags[0] ?? '?';
}
```

**`src/lib/components/CardHand.svelte` — counter indicator:**

Cards in hand that match an active `fullCounter` event should show a visible indicator so the player knows they hold a counter card.

Add a prop `activeEventTags: string[]` (derived from active fullCounter events in the parent). In `CardHand.svelte`, derive `canCounter` per card:

```svelte
{@const canCounter = activeEventTags.includes(def?.countersEventTag ?? '')}
```

Apply a `class:can-counter={canCounter}` to the card element and add a CSS badge: a small amber label "COUNTER" at the top of the card.

**`src/routes/+page.svelte`:**

Derive and pass `activeEventTags`:

```svelte
const counterableTags = $derived(
  gs.activeEvents
    .filter((e) => !e.resolved && EVENT_DEFS.get(e.defId)?.responseTier === 'fullCounter')
    .flatMap((e) => EVENT_DEFS.get(e.defId)?.tags ?? []),
);
```

Pass as `activeEventTags={counterableTags}` to `<CardHand>`.

**Data gap — `blockadeGeopolitical`:** This fullCounter event has tags `['diplomatic', 'crisis']` but no card in `CARD_DEFS` has `countersEventTag: 'diplomatic'`. Add at least one `diplomatic` counter card to `src/data/cards.ts` (e.g., "Back-Channel Negotiation" — `countersEventTag: 'diplomatic'`, effect: `{ resources: { politicalWill: -5 } }`).

**Acceptance:**
- Playing a scandal card while `politicalScandalMinor` is active resolves the event as 'counter'
- Playing an interference card while `signalInterference` is active resolves it
- Cards that can counter active events display a visible badge in the hand
- EventZone shows the required card tag in the counter hint
- News feed records the counter with `category: 'event-gain'`

---

### 18.2 — Per-turn action cap

**Design:** Card plays are limited to **3 per turn** (default). This creates meaningful decisions: with 4–5 cards drawn, the player always has at least one unplayed card to bank or discard. Standing actions do not count toward this cap (they are gated by resources and construction queue).

**`src/engine/types.ts`:**

Add to `GameState`:

```typescript
actionsThisTurn: number;   // card plays used this turn; reset to 0 on draw phase
maxActionsPerTurn: number; // default 3; board members may modify
```

**`src/engine/state.ts` — `createGameState()`:**

Initialise both fields:

```typescript
actionsThisTurn: 0,
maxActionsPerTurn: 3,
```

**`src/engine/turn.ts` — `executeDrawPhase()`:**

Reset counter at the start of each new hand:

```typescript
return {
  ...state,
  actionsThisTurn: 0,
  player: { ...updatedPlayer },
  phase: 'action',
};
```

**`src/lib/stores/game.svelte.ts` — `playCard()`:**

Add a guard at the top of `playCard()`:

```typescript
if (_state.actionsThisTurn >= _state.maxActionsPerTurn) return; // cap reached
```

After successfully playing the card, increment:

```typescript
_state = { ..._state, actionsThisTurn: _state.actionsThisTurn + 1 };
```

**`src/lib/components/CardHand.svelte`:**

Pass `actionsThisTurn` and `maxActionsPerTurn` as props. Show a small counter in the hand header: `ACTIONS {actionsThisTurn}/{maxActionsPerTurn}`. When cap is reached, grey out the play buttons and show "Action limit reached" tooltip.

**Board member interaction (future):** The Director of Operations buff is a natural +1 to `maxActionsPerTurn`. No changes needed now — the field in `GameState` is already available.

**Acceptance:**
- After 3 card plays, play buttons are disabled for the remainder of the action phase
- The action counter is visible in the card hand
- Counter resets to 0 at the start of each draw phase
- `npm run test:run` passes (add a test for the cap guard in `cards.ts` or as a turn integration test)

---

### 18.3 — Bank cost: Funding → Will

**Current:** Banked cards cost 1 Funding per banked card per turn (applied during World Phase via `computeBankDecay`).

**Change:** Cost is 1 **Political Will** per banked card per turn. This makes banking a strategic trade-off against Will stability rather than an always-bad cash drain during funding crises.

**`src/engine/resources.ts` — `computeBankDecay()` / `applyResourceDeltas()`:**

Find the bank decay computation and change the affected resource from `funding` to `politicalWill`.

**`src/lib/components/CardHand.svelte`:**

Update the display text from `−1 Fund/turn` to `−1 Will/turn`.

**`src/engine/resources.test.ts`:**

Update the bank decay test to assert that `politicalWill` is reduced (not `funding`).

**Acceptance:**
- Banking a card reduces Political Will by 1/turn during World Phase
- Funding is unaffected by banking
- Card hand shows "−1 Will/turn" label on banked cards

---

### 18.4 — Phase legibility

**Problem:** Players don't know which actions are valid in the current phase, and why some buttons are greyed out.

**`src/lib/components/PhaseControls.svelte`:**

Add a one-line phase description beneath the advance button that changes per phase:

| Phase | Description shown |
|-------|-------------------|
| `event` | "New events arriving — review the event zone." |
| `draw` | "Drawing cards…" |
| `action` | "Play cards or use standing actions." |
| `bank` | "Bank up to 2 cards for next turn." |
| `world` | "Processing world events…" |

This is a static string lookup — no engine change needed.

**`src/lib/components/CardHand.svelte`:**

When `phase !== 'action'`, show a single line "Cards can be played during the Action phase." instead of greyed buttons, so the player understands the constraint rather than seeing unhelpful disabled UI.

**Acceptance:**
- Phase description is visible and correct throughout the turn cycle
- Out-of-phase card hand shows an explanatory message, not just disabled buttons

---

### 18.5 — Earth era early-game balance

**Problems:**
1. Negative events fire too frequently in turns 1–5 before the player has any resource buffer.
2. No recovery mechanism when funding and materials both approach zero.

**Fix 1 — Early event dampening:**

**`src/engine/events.ts` — `selectNewEvents()`:**

Apply a dampening factor to event selection probability in the first 5 turns:

```typescript
// Reduce event spawn probability in early turns
const earlyGameFactor = turn <= 5 ? 0.4 : 1.0;
```

Use `earlyGameFactor` as a multiplier on the spawn roll. This means roughly 40% of the normal event rate in turns 1–5, ramping to full rate from turn 6 onward. The exact threshold and factor can be tuned during play-testing.

**Fix 2 — Emergency Measures standing action:**

Add a new standing action to `src/data/standingActions.ts`:

```typescript
{
  id: 'emergencyFundraiser',
  name: 'Emergency Appeal',
  description: 'Burn political capital for emergency operational funding.',
  cost: { politicalWill: 20 },
  effect: { funding: 30 },
  phases: ['action'],
  availableFromTurn: 1,
}
```

This gives a recoverable exit from the death spiral: trade Will (which regenerates) for Funding. It is expensive enough (20 Will) that it is not a routine action, but available when needed.

**`src/engine/turn.ts` or `src/lib/stores/game.svelte.ts`:**

Wire the standing action effect into the store's `useStandingAction()` handler if it is not already handled generically. It should apply `effect.funding` to `player.resources.funding` and deduct `cost.politicalWill`.

**Note on event frequency data:** Two events currently have `countdownTurns: 1` (`coastalFlooding`) — these expire and apply their effect the same turn they arrive, giving no response window. Consider raising `countdownTurns` to 2 for these events, or ensuring they are excluded from early-turn selection.

**Acceptance:**
- Starting a new game, no negative event fires before turn 3 (probabilistic — run 5 seeds)
- "Emergency Appeal" standing action appears in the action phase and costs 20 Will / yields 30 Funding
- Playing Emergency Appeal is recorded in the news feed

---

## File Change Summary

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `actionsThisTurn`, `maxActionsPerTurn` to `GameState` |
| `src/engine/state.ts` | Initialise new fields in `createGameState()` |
| `src/engine/turn.ts` | Reset `actionsThisTurn` in `executeDrawPhase()`; early event dampening in `selectNewEvents()` |
| `src/engine/events.ts` | `earlyGameFactor` multiplier in `selectNewEvents()` |
| `src/engine/resources.ts` | Bank decay from Funding → Will |
| `src/engine/resources.test.ts` | Update bank decay test |
| `src/engine/cards.test.ts` | Add action cap integration test |
| `src/data/cards.ts` | Add "Back-Channel Negotiation" diplomatic counter card |
| `src/data/standingActions.ts` | Add "Emergency Appeal" standing action |
| `src/lib/stores/game.svelte.ts` | Import `EVENT_DEFS`; add counter-check in `playCard()`; add action-cap guard; increment `actionsThisTurn` |
| `src/lib/components/CardHand.svelte` | Add `activeEventTags`, `actionsThisTurn`, `maxActionsPerTurn` props; counter badge; action counter display; phase message |
| `src/lib/components/EventZone.svelte` | Improve counter-hint to name the required tag |
| `src/lib/components/PhaseControls.svelte` | Add per-phase description line |
| `src/routes/+page.svelte` | Derive `counterableTags`; pass new props to `CardHand` and `PhaseControls` |

No changes to Phaser scenes. No new test files needed (add tests to existing files).

---

## Acceptance Checklist

- [x] Playing a scandal card while a Procurement Scandal event is active resolves the event
- [x] Playing an interference card while Signal Interference is active resolves it
- [x] Counter cards in hand display a visible badge when a matching fullCounter event is active
- [x] EventZone counter hint names the required card tag (e.g. "Counter with a SCANDAL card")
- [x] Event counter is recorded in the news feed with `category: 'event-gain'`
- [x] Card play is limited to 3 per turn; play buttons disabled after cap reached
- [x] Action counter `{used}/{max}` visible in card hand area
- [x] Counter resets to 0 on each new draw phase
- [x] Banking a card costs 1 Will/turn (not Funding)
- [x] CardHand displays "−1 Will/turn" on banked cards
- [x] Phase description line visible in PhaseControls
- [x] Card hand shows explanatory message when phase is not 'action'
- [x] Emergency Appeal standing action available; costs 20 Will, yields 30 Funding
- [x] Early turns (1–5) see noticeably fewer negative events
- [x] `npm run lint` — 0 errors
- [x] `npm run test:run` — all tests pass
- [x] `npm run test:e2e` — all tests pass

---

## Implementation Order

1. **18.1** — Counter mechanic (highest visible impact; fixes broken feature)
2. **18.3** — Bank cost to Will (small, isolated change; do early)
3. **18.2** — Action cap (requires `GameState` change; do after counter so tests are stable)
4. **18.4** — Phase legibility (pure UI, no engine; do after store changes settle)
5. **18.5** — Earth era balance (do last; requires play-testing to tune numbers)
