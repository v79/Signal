import type {
  EventDef,
  EventInstance,
  EventEffect,
  PlayerState,
  MapTile,
  StandingActionRestriction,
  Resources,
  FieldPoints,
  Era,
  PushFactor,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Event pool selection
// ---------------------------------------------------------------------------

/** Maximum number of new events that can land per turn. */
export const MAX_NEW_EVENTS_PER_TURN = 2;

/**
 * Filter the event pool to events eligible to fire given the current
 * game context: era, push factor, player's bloc, and events already active.
 */
export function getEligibleEvents(
  pool: EventDef[],
  era: Era,
  pushFactor: PushFactor,
  playerBlocId: string,
  activeEventDefIds: Set<string>,
): EventDef[] {
  return pool.filter(def => {
    if (activeEventDefIds.has(def.id)) return false;
    if (!def.eras.includes(era)) return false;
    if (def.pushFactors !== null && !def.pushFactors.includes(pushFactor)) return false;
    if (def.blocIds !== null && !def.blocIds.includes(playerBlocId)) return false;
    return true;
  });
}

/**
 * Select 0–MAX_NEW_EVENTS_PER_TURN events from the eligible pool using the
 * seeded RNG and create EventInstance objects for them.
 *
 * PRNG calls: one `rng.nextInt(0, MAX_NEW_EVENTS_PER_TURN)` for count,
 * then one `rng.pick()` per selected event.
 */
export function selectNewEvents(
  pool: EventDef[],
  era: Era,
  pushFactor: PushFactor,
  playerBlocId: string,
  activeEvents: EventInstance[],
  rng: Rng,
  arrivedTurn: number,
): EventInstance[] {
  const activeDefIds = new Set(activeEvents.map(e => e.defId));
  const eligible = getEligibleEvents(pool, era, pushFactor, playerBlocId, activeDefIds);
  if (eligible.length === 0) return [];

  const count = rng.nextInt(0, Math.min(MAX_NEW_EVENTS_PER_TURN, eligible.length));
  const selected: EventDef[] = [];
  const remaining = [...eligible];

  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) break;
    const idx = Math.floor(rng.next() * remaining.length);
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  return selected.map(def => ({
    id: `${def.id}-t${arrivedTurn}`,
    defId: def.id,
    arrivedTurn,
    countdownRemaining: def.countdownTurns,
    resolved: false,
    resolvedWith: null,
  }));
}

// ---------------------------------------------------------------------------
// Countdown tick
// ---------------------------------------------------------------------------

/**
 * Decrement countdowns for all unresolved events.
 * Events that reach 0 are marked as expired (resolved = true, resolvedWith = 'expired').
 * Their effects are applied separately by `applyExpiredEventEffects`.
 */
export function tickEventCountdowns(events: EventInstance[]): EventInstance[] {
  return events.map(event => {
    if (event.resolved) return event;
    const newCountdown = event.countdownRemaining - 1;
    if (newCountdown <= 0) {
      return { ...event, countdownRemaining: 0, resolved: true, resolvedWith: 'expired' as const };
    }
    return { ...event, countdownRemaining: newCountdown };
  });
}

/** Return events that expired this tick (countdown just reached 0). */
export function getJustExpiredEvents(events: EventInstance[]): EventInstance[] {
  return events.filter(e => e.resolved && e.resolvedWith === 'expired' && e.countdownRemaining === 0);
}

// ---------------------------------------------------------------------------
// Event resolution
// ---------------------------------------------------------------------------

/**
 * Mark an event as resolved with the given resolution type.
 * Does not apply effects — call `applyEventEffect` separately.
 */
export function resolveEvent(
  events: EventInstance[],
  eventId: string,
  resolution: Exclude<EventInstance['resolvedWith'], null>,
): EventInstance[] {
  return events.map(e =>
    e.id === eventId ? { ...e, resolved: true, resolvedWith: resolution } : e,
  );
}

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

export interface EventEffectResult {
  player: PlayerState;
  mapTiles: MapTile[];
}

/**
 * Apply an EventEffect to the player state and map.
 *
 * Handled in Phase 4:
 *   - resources delta
 *   - fields delta
 *   - standing action restrictions
 *
 * Deferred to later phases:
 *   - destroyTile (Phase 5 — map rendering)
 *   - eliminateBloc (Phase 7 — bloc simulation)
 *   - signalProgress (Phase 9 — signal track)
 *   - triggersEventId (requires event pool access — Phase 4 extended)
 */
export function applyEventEffect(
  effect: EventEffect,
  player: PlayerState,
  mapTiles: MapTile[],
  currentTurn: number,
): EventEffectResult {
  let updatedPlayer = { ...player };

  // Resources delta
  if (effect.resources) {
    const r = effect.resources;
    updatedPlayer = {
      ...updatedPlayer,
      resources: {
        funding: Math.max(0, player.resources.funding + (r.funding ?? 0)),
        materials: Math.max(0, player.resources.materials + (r.materials ?? 0)),
        politicalWill: Math.max(0, player.resources.politicalWill + (r.politicalWill ?? 0)),
      },
    };
  }

  // Field points delta
  if (effect.fields) {
    const f = effect.fields;
    const newFields = { ...player.fields } as FieldPoints;
    for (const k of Object.keys(f) as (keyof FieldPoints)[]) {
      newFields[k] = Math.max(0, (newFields[k] ?? 0) + (f[k] ?? 0));
    }
    updatedPlayer = { ...updatedPlayer, fields: newFields };
  }

  // Standing action restrictions
  if (effect.restrictActions && effect.restrictActions.length > 0) {
    const duration = effect.restrictionDuration ?? 1;
    const newRestrictions: StandingActionRestriction[] = effect.restrictActions.map(actionId => ({
      actionId,
      expiresAfterTurn: currentTurn + duration - 1,
    }));
    updatedPlayer = {
      ...updatedPlayer,
      activeEventRestrictions: [...player.activeEventRestrictions, ...newRestrictions],
    };
  }

  // destroyTile, eliminateBloc, signalProgress, triggersEventId — deferred
  return { player: updatedPlayer, mapTiles };
}

/**
 * Compute the effective effect for a resolution type, applying mitigation
 * if applicable.
 *
 * - 'counter': no negative effect (fully neutralised)
 * - 'accepted': positiveEffect (opportunity event accepted)
 * - 'mitigation': negativeEffect scaled by (1 - mitigationFactor)
 * - 'expired': full negativeEffect
 */
export function getEffectForResolution(
  def: EventDef,
  resolution: Exclude<EventInstance['resolvedWith'], null>,
): EventEffect | null {
  switch (resolution) {
    case 'counter':
      return null; // fully neutralised

    case 'accepted':
      return def.positiveEffect;

    case 'mitigation': {
      if (!def.mitigationFactor || !def.mitigationCost) return def.negativeEffect;
      const factor = 1 - def.mitigationFactor;
      return scaleEffect(def.negativeEffect, factor);
    }

    case 'expired':
      return def.negativeEffect;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scale numeric fields of an EventEffect by a factor (used for mitigation). */
function scaleEffect(effect: EventEffect, factor: number): EventEffect {
  const scaled: EventEffect = { ...effect };

  if (effect.resources) {
    const r: Partial<Resources> = {};
    for (const k of Object.keys(effect.resources) as (keyof Resources)[]) {
      r[k] = Math.round((effect.resources[k] ?? 0) * factor);
    }
    scaled.resources = r;
  }

  if (effect.fields) {
    const f: Partial<FieldPoints> = {};
    for (const k of Object.keys(effect.fields) as (keyof FieldPoints)[]) {
      f[k] = Math.round((effect.fields[k] ?? 0) * factor);
    }
    scaled.fields = f;
  }

  return scaled;
}
