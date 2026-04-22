import type {
  EventDef,
  EventInstance,
  EventEffect,
  PlayerState,
  MapTile,
  FieldPoints,
  Era,
  PushFactor,
  FacilityDef,
  FacilityInstance,
  BlocState,
  SignalState,
} from './types';
import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Event pool selection
// ---------------------------------------------------------------------------

/** Maximum number of new events that can land per turn. */
export const MAX_NEW_EVENTS_PER_TURN = 2;

/** Tags where at most one event may fire per turn (same-turn mutual exclusivity). */
const EXCLUSIVE_TURN_TAGS = new Set(['signal', 'espionage']);

/**
 * Filter the event pool to events eligible to fire given the current
 * game context: era, push factor, player's bloc, and events already active.
 *
 * If `hasCrisisActive` is true, all crisis-tagged events are excluded so
 * that at most one crisis can be active at a time.
 */
export function getEligibleEvents(
  pool: EventDef[],
  era: Era,
  pushFactor: PushFactor,
  playerBlocId: string,
  activeEventDefIds: Set<string>,
  hasCrisisActive: boolean,
  climatePressure: number,
  blocs: BlocState[] = [],
  recentlyFiredDefIds: Set<string> = new Set(),
): EventDef[] {
  return pool.filter((def) => {
    if (activeEventDefIds.has(def.id)) return false;
    if (!def.eras.includes(era)) return false;
    if (def.pushFactors !== null && !def.pushFactors.includes(pushFactor)) return false;
    if (def.blocIds !== null && !def.blocIds.includes(playerBlocId)) return false;
    if (hasCrisisActive && def.tags.includes('crisis')) return false;
    if (def.minClimate != null && climatePressure < def.minClimate) return false;
    // NPC bloc gating: skip if associated bloc is the player, eliminated, or below will threshold
    if (def.npcBlocId) {
      if (def.npcBlocId === playerBlocId) return false;
      const bloc = blocs.find((b) => b.defId === def.npcBlocId);
      if (!bloc || bloc.eliminated) return false;
      if (def.blocMinWill != null && bloc.will < def.blocMinWill) return false;
      if (recentlyFiredDefIds.has(def.id)) return false;
    }
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
  climatePressure: number,
  blocs: BlocState[] = [],
): EventInstance[] {
  const activeDefIds = new Set(activeEvents.map((e) => e.defId));
  const hasCrisisActive = activeEvents.some(
    (e) => !e.resolved && (pool.find((d) => d.id === e.defId)?.tags ?? []).includes('crisis'),
  );
  // Diplomatic/bloc events that fired within the last 10 turns are put on cooldown.
  const recentlyFiredDefIds = new Set(
    activeEvents
      .filter((e) => arrivedTurn - e.arrivedTurn < 10)
      .map((e) => e.defId),
  );
  const eligible = getEligibleEvents(pool, era, pushFactor, playerBlocId, activeDefIds, hasCrisisActive, climatePressure, blocs, recentlyFiredDefIds);
  if (eligible.length === 0) return [];

  const rawCount = rng.nextInt(0, Math.min(MAX_NEW_EVENTS_PER_TURN, eligible.length));
  // Limit to at most 1 event in the first 8 turns so the player can establish a base.
  const count = arrivedTurn <= 8 ? Math.min(rawCount, 1) : rawCount;
  const selected: EventDef[] = [];
  const remaining = [...eligible];

  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) break;
    const totalWeight = remaining.reduce((sum, def) => sum + def.weight, 0);
    if (totalWeight <= 0) break;
    let threshold = rng.next() * totalWeight;
    let chosen = remaining[remaining.length - 1];
    for (const def of remaining) {
      threshold -= def.weight;
      if (threshold < 0) {
        chosen = def;
        break;
      }
    }
    selected.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
    // Remove events that share an exclusive tag with the chosen event so that
    // at most one event per exclusive tag can fire in the same turn.
    for (const tag of chosen.tags) {
      if (EXCLUSIVE_TURN_TAGS.has(tag)) {
        const toRemove = remaining.filter((d) => d.tags.includes(tag));
        for (const d of toRemove) remaining.splice(remaining.indexOf(d), 1);
      }
    }
  }

  return selected.map((def) => ({
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
  return events.map((event) => {
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
  return events.filter(
    (e) => e.resolved && e.resolvedWith === 'expired' && e.countdownRemaining === 0,
  );
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
  return events.map((e) =>
    e.id === eventId ? { ...e, resolved: true, resolvedWith: resolution } : e,
  );
}

// ---------------------------------------------------------------------------
// Effect application
// ---------------------------------------------------------------------------

export interface EventEffectResult {
  player: PlayerState;
  mapTiles: MapTile[];
  signal?: SignalState;
}

/**
 * Apply an EventEffect to the player state and map.
 *
 * @param rng - Seeded RNG used for dynamic tile selection (`tileTypeTarget`).
 * @param facilityDefs - Used to honour `climateImmune` on tile-destroying effects.
 * @param signal - Optional signal state; required for effects with `signalProgress`.
 */
export function applyEventEffect(
  effect: EventEffect,
  player: PlayerState,
  mapTiles: MapTile[],
  currentTurn: number,
  rng: Rng,
  facilityDefs: Map<string, FacilityDef>,
  signal?: SignalState,
): EventEffectResult {
  let updatedPlayer = { ...player };
  let updatedTiles = mapTiles;

  // Resources delta
  if (effect.resources) {
    const r = effect.resources;
    updatedPlayer = {
      ...updatedPlayer,
      resources: {
        funding: player.resources.funding + (r.funding ?? 0),
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

  // Dynamic tile targeting: pick a random non-destroyed tile of the target type,
  // excluding tiles that host any climate-immune facility.
  if (effect.tileTypeTarget) {
    const status = effect.destroyTileStatus ?? 'flooded';
    const candidates = updatedTiles.filter((t) => {
      if (t.type !== effect.tileTypeTarget) return false;
      if (t.destroyedStatus !== null) return false;
      // Sea walls protect coastal tiles from flooding
      if (status === 'flooded' && t.seaWallProtected) return false;
      if (t.facilitySlots.some((id) => {
        if (!id) return false;
        const inst = updatedPlayer.facilities.find((f) => f.id === id);
        return inst ? facilityDefs.get(inst.defId)?.climateImmune === true : false;
      })) return false;
      return true;
    });
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(rng.next() * candidates.length)];
      const destruction = destroyTileAndFacility(updatedTiles, updatedPlayer, chosen, status, facilityDefs, rng);
      updatedTiles = destruction.tiles;
      updatedPlayer = destruction.player;
    }
  }

  // Fixed tile targeting: destroy a specific tile by coordKey
  if (effect.destroyTile) {
    const { coordKey, status } = effect.destroyTile;
    const target = updatedTiles.find(
      (t) => `${t.coord.q},${t.coord.r}` === coordKey,
    );
    if (target && target.destroyedStatus === null) {
      const destruction = destroyTileAndFacility(updatedTiles, updatedPlayer, target, status, facilityDefs, rng);
      updatedTiles = destruction.tiles;
      updatedPlayer = destruction.player;
    }
  }

  // signalProgress: apply delta directly, bypassing era stall caps
  let updatedSignal = signal;
  if (effect.signalProgress != null && updatedSignal) {
    updatedSignal = {
      ...updatedSignal,
      decodeProgress: Math.max(0, Math.min(100, updatedSignal.decodeProgress + effect.signalProgress)),
    };
  }

  // eliminateBloc, triggersEventId — deferred
  return { player: updatedPlayer, mapTiles: updatedTiles, signal: updatedSignal };
}

/** Destroy a tile and remove one random non-immune facility slot from it. */
function destroyTileAndFacility(
  tiles: MapTile[],
  player: PlayerState,
  target: MapTile,
  status: import('./types').TileDestroyedStatus,
  facilityDefs: Map<string, FacilityDef>,
  rng?: Rng,
): { tiles: MapTile[]; player: PlayerState } {
  const tileCoordKey = `${target.coord.q},${target.coord.r}`;

  // Collect unique non-immune facility instances on this tile
  const seen = new Set<string>();
  const candidates: FacilityInstance[] = [];
  for (const id of target.facilitySlots) {
    if (id && !seen.has(id)) {
      seen.add(id);
      const f = player.facilities.find((fac) => fac.id === id);
      if (f && facilityDefs.get(f.defId)?.climateImmune !== true) candidates.push(f);
    }
  }

  // Pick one victim at random
  let victimId: string | null = null;
  if (candidates.length > 0) {
    const idx = rng ? Math.floor(rng.next() * candidates.length) : 0;
    victimId = candidates[idx].id;
  }

  // Mark tile destroyed, clear the victim's slots, clear pending action
  const updatedTiles = tiles.map((t) => {
    if (`${t.coord.q},${t.coord.r}` !== tileCoordKey) return t;
    const newSlots = t.facilitySlots.map((s) =>
      s === victimId ? null : s,
    ) as [string | null, string | null, string | null];
    return { ...t, destroyedStatus: status, facilitySlots: newSlots, pendingActionId: null };
  });

  // Remove victim from facilities list and cancel pending construction
  let updatedPlayer = player;
  if (victimId) {
    updatedPlayer = {
      ...player,
      facilities: player.facilities.filter((f) => f.id !== victimId),
      constructionQueue: player.constructionQueue.filter((a) => a.coordKey !== tileCoordKey),
    };
  }

  return { tiles: updatedTiles, player: updatedPlayer };
}

/**
 * Compute the effective effect for a resolution type, applying mitigation
 * if applicable.
 *
 * - 'counter': no negative effect (fully neutralised)
 * - 'accepted': positiveEffect (opportunity event accepted)
 * - 'mitigation': null — mitigationCost already deducted; no residual effect
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

    case 'mitigation':
      // The mitigationCost deducted in mitigateEvent() is the player's total
      // reduced penalty. No additional residual effect is applied.
      return null;

    case 'expired':
      return def.negativeEffect;
  }
}

// ---------------------------------------------------------------------------
// News text helpers
// ---------------------------------------------------------------------------

/**
 * Summarise an EventEffect as a compact human-readable string for the news feed.
 * e.g. "Materials -35" or "Funding -10, Political Will -25"
 */
export function formatEffectForNews(effect: EventEffect): string {
  const parts: string[] = [];
  if (effect.resources) {
    const r = effect.resources;
    if (r.funding != null && r.funding !== 0)
      parts.push(`Funding ${r.funding > 0 ? '+' : ''}${r.funding}`);
    if (r.materials != null && r.materials !== 0)
      parts.push(`Materials ${r.materials > 0 ? '+' : ''}${r.materials}`);
    if (r.politicalWill != null && r.politicalWill !== 0)
      parts.push(`Political Will ${r.politicalWill > 0 ? '+' : ''}${r.politicalWill}`);
  }
  if (effect.fields) {
    const total = Object.values(effect.fields).reduce((s, v) => s + (v ?? 0), 0);
    if (total > 0) parts.push('research fields +');
    else if (total < 0) parts.push('research fields −');
  }
  if (effect.signalProgress != null && effect.signalProgress !== 0)
    parts.push(`Signal ${effect.signalProgress > 0 ? '+' : ''}${effect.signalProgress}`);
  return parts.length > 0 ? parts.join(', ') : 'no immediate effect';
}

// ---------------------------------------------------------------------------
// Helpers
