// =============================================================================
// SIGNAL — Standing Action Definitions
// Persistent toolbar actions always available to the player.
// =============================================================================

import type { StandingActionDef } from '../engine/types';

export const STANDING_ACTIONS: StandingActionDef[] = [
  {
    id: 'build',
    name: 'Build',
    description: 'Construct a facility on the map.',
    cost: { materials: 20 },
    actionKey: 'build',
  },
  {
    id: 'recruit',
    name: 'Recruit',
    description: 'Hire a new board member.',
    cost: { funding: 15, politicalWill: 10 },
    actionKey: 'recruit',
  },
  {
    id: 'trade',
    name: 'Trade',
    description: 'Exchange resources with a bloc.',
    cost: { politicalWill: 5 },
    actionKey: 'trade',
  },
  {
    id: 'survey',
    name: 'Survey',
    description: 'Survey new territory or asteroid nodes.',
    cost: { materials: 5 },
    actionKey: 'survey',
  },
  {
    id: 'negotiate',
    name: 'Negotiate',
    description: 'Conduct diplomatic negotiations with a bloc.',
    cost: { funding: 10, politicalWill: 8 },
    actionKey: 'negotiate',
  },
  {
    id: 'emergencyAppeal',
    name: 'Emergency Appeal',
    description: 'Burn political capital for emergency operational funding. Spend 20 Will, gain 30 Funding.',
    cost: { politicalWill: 20 },
    actionKey: 'emergencyAppeal',
  },
];
