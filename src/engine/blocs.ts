import type { BlocDef, BlocState, NewsItem } from './types';
import { tickWill } from './resources';
import { ZERO_FIELDS } from './state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Passive resource income for every active bloc per turn. */
const PASSIVE_INCOME = { funding: 5, materials: 3 };

/**
 * Passive field accumulation per turn, scaled by will (0–1).
 * Blocs with higher will invest more effectively in research.
 */
const PASSIVE_FIELDS = { physics: 1, mathematics: 1 };

/** Will below this → any bloc is at collapse risk regardless of profile. */
const ABSOLUTE_COLLAPSE_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BlocSimResult {
  updatedBlocs: BlocState[];
  newNewsItems: NewsItem[];
  eliminatedBlocIds: string[];
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Create runtime BlocState instances from content definitions.
 * Blocs start at 70% of their will ceiling.
 */
export function initialiseBlocStates(blocDefs: BlocDef[]): BlocState[] {
  return blocDefs.map((def) => ({
    defId: def.id,
    resources: { ...def.startingResources },
    fields: { ...ZERO_FIELDS, ...def.startingFields },
    will: Math.round(def.willCeiling * 0.7),
    era: 'earth' as const,
    eliminated: false,
    eliminatedTurn: null,
    completedProjectIds: [],
  }));
}

// ---------------------------------------------------------------------------
// Per-turn simulation
// ---------------------------------------------------------------------------

/**
 * Simulate one World Phase tick for all NPC blocs.
 *
 * Per bloc (non-eliminated):
 *   1. Passive resource income
 *   2. Will drift (uses same tickWill as player)
 *   3. Passive field accumulation proportional to will
 *   4. Elimination check (authoritarian collapse or resource exhaustion)
 *   5. News items for significant events
 *
 * Called by executeWorldPhase in turn.ts.
 */
export function simulateBlocs(
  blocs: BlocState[],
  blocDefs: Map<string, BlocDef>,
  turn: number,
): BlocSimResult {
  const updatedBlocs: BlocState[] = [];
  const newNewsItems: NewsItem[] = [];
  const eliminatedBlocIds: string[] = [];

  for (const bloc of blocs) {
    if (bloc.eliminated) {
      updatedBlocs.push(bloc);
      continue;
    }

    const def = blocDefs.get(bloc.defId);
    if (!def) {
      updatedBlocs.push(bloc);
      continue;
    }

    // 1. Passive resource income
    const newResources = {
      funding: Math.max(0, bloc.resources.funding + PASSIVE_INCOME.funding),
      materials: Math.max(0, bloc.resources.materials + PASSIVE_INCOME.materials),
      politicalWill: bloc.resources.politicalWill,
    };

    // 2. Will drift — map BlocDef's willCollapsThreshold (typo in type) to WillConfig field
    const newWill = tickWill(bloc.will, {
      willProfile: def.willProfile,
      willCeiling: def.willCeiling,
      willCollapseThreshold: def.willCollapsThreshold,
    });

    // 3. Passive field accumulation (integer, scaled by will)
    const willFactor = newWill / 100;
    const newFields = {
      ...bloc.fields,
      physics: bloc.fields.physics + Math.round(PASSIVE_FIELDS.physics * willFactor),
      mathematics: bloc.fields.mathematics + Math.round(PASSIVE_FIELDS.mathematics * willFactor),
    };

    // 4. Elimination checks
    const authoritarianCollapse =
      def.willProfile === 'authoritarian' && newWill < def.willCollapsThreshold;
    const universalCollapse = newWill < ABSOLUTE_COLLAPSE_THRESHOLD;
    const resourceExhaustion = newResources.funding === 0 && newResources.materials === 0;

    if (authoritarianCollapse || universalCollapse || resourceExhaustion) {
      eliminatedBlocIds.push(bloc.defId);
      updatedBlocs.push({
        ...bloc,
        resources: newResources,
        fields: newFields,
        will: newWill,
        eliminated: true,
        eliminatedTurn: turn,
      });
      const reason = resourceExhaustion
        ? 'resource exhaustion'
        : 'a catastrophic collapse of political will';
      newNewsItems.push({
        id: `${turn}-elim-${bloc.defId}`,
        turn,
        text: `${def.name} has dissolved following ${reason}. The geopolitical map is redrawn.`,
      });
      continue;
    }

    // 5. Periodic status news (staggered by a simple hash of defId so blocs don't all report at once)
    const phase = def.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
    if (turn % 5 === phase) {
      const statusText = describeBloc(def.name, newWill, newResources.funding);
      if (statusText) {
        newNewsItems.push({ id: `${turn}-status-${bloc.defId}`, turn, text: statusText });
      }
    }

    updatedBlocs.push({
      ...bloc,
      resources: newResources,
      fields: newFields,
      will: newWill,
    });
  }

  return { updatedBlocs, newNewsItems, eliminatedBlocIds };
}

// ---------------------------------------------------------------------------
// Merger detection
// ---------------------------------------------------------------------------

/**
 * Scan for pairs of weakened blocs that might merge.
 * Returns news items hinting at diplomatic convergence.
 * Full merger resolution is deferred to Phase 11.
 */
export function checkBlocMergers(
  blocs: BlocState[],
  blocDefs: Map<string, BlocDef>,
  turn: number,
): NewsItem[] {
  const weak = blocs.filter((b) => !b.eliminated && b.will < 30 && b.resources.funding < 25);
  if (weak.length < 2) return [];

  const [a, b] = weak;
  const defA = blocDefs.get(a.defId);
  const defB = blocDefs.get(b.defId);
  if (!defA || !defB) return [];

  return [
    {
      id: `${turn}-merger-${a.defId}-${b.defId}`,
      turn,
      text: `Intelligence reports: ${defA.name} and ${defB.name} are exploring closer diplomatic ties.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeBloc(name: string, will: number, funding: number): string | null {
  if (will > 70 && funding > 60) return null; // no news when stable
  if (will < 20) return `${name} is in political turmoil. Stability cannot be guaranteed.`;
  if (funding < 15)
    return `${name} faces a severe funding shortfall. International observers are concerned.`;
  if (will < 40) return `${name} reports declining public support for its current leadership.`;
  return null;
}
