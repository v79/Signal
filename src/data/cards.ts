// =============================================================================
// SIGNAL — Card Definitions
// All action hand cards and their counter effects.
// =============================================================================

import type { CardDef } from '../engine/types';

export const CARD_DEFS: Map<string, CardDef> = new Map([
  ['lobbying', {
    id: 'lobbying',
    name: 'Political Lobbying',
    description: 'Rally political support for the programme.',
    flavourText: 'The corridors of power must be navigated carefully.',
    era: 'earth',
    effect: { resources: { politicalWill: 5 } },
    counterEffect: {
      countersEventTag: 'interference',
      additionalCost: { politicalWill: 10 },
      fullNeutralise: true,
    },
    upgradesFrom: null,
  }],
  ['emergencyProcurement', {
    id: 'emergencyProcurement',
    name: 'Emergency Procurement',
    description: 'Rush order for critical materials.',
    flavourText: 'No time for the usual channels.',
    era: 'earth',
    effect: { resources: { materials: 15, funding: -10 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['publicAppeal', {
    id: 'publicAppeal',
    name: 'Public Outreach',
    description: 'Broadcast the mission to the public.',
    flavourText: 'The people deserve to know what is at stake.',
    era: 'earth',
    effect: { resources: { politicalWill: 8, funding: 5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['academicConference', {
    id: 'academicConference',
    name: 'Academic Conference',
    description: 'Host international researchers.',
    flavourText: 'The best minds of a generation, gathered.',
    era: 'earth',
    effect: { fields: { physics: 8, mathematics: 6 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['coalitionBuilding', {
    id: 'coalitionBuilding',
    name: 'Coalition Building',
    description: 'Coordinate with allied pressure groups.',
    flavourText: 'There is strength in numbers.',
    era: 'earth',
    effect: { resources: { politicalWill: 12 } },
    counterEffect: {
      countersEventTag: 'scandal',
      additionalCost: { politicalWill: 5 },
      fullNeutralise: false,
    },
    upgradesFrom: null,
  }],
  ['peerReview', {
    id: 'peerReview',
    name: 'Peer Review',
    description: 'Independent validation of research findings accelerates credibility.',
    flavourText: 'Extraordinary claims require extraordinary evidence.',
    era: 'earth',
    effect: { fields: { physics: 5, mathematics: 5, computing: 3 } },
    counterEffect: {
      countersEventTag: 'scandal',
      additionalCost: {},
      fullNeutralise: false,
    },
    upgradesFrom: null,
  }],
  ['industrialContracts', {
    id: 'industrialContracts',
    name: 'Industrial Contracts',
    description: 'Secure long-term supply agreements with manufacturing partners.',
    flavourText: 'Stability is purchased, not guaranteed.',
    era: 'earth',
    effect: { resources: { materials: 20, funding: -5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['mediaBlitz', {
    id: 'mediaBlitz',
    name: 'Media Blitz',
    description: 'Launch a coordinated public communications campaign.',
    flavourText: 'The narrative must be controlled before it controls us.',
    era: 'earth',
    effect: { resources: { politicalWill: 15, funding: -8 } },
    counterEffect: {
      countersEventTag: 'scandal',
      additionalCost: { funding: 5 },
      fullNeutralise: true,
    },
    upgradesFrom: null,
  }],
  ['orbitDeploy', {
    id: 'orbitDeploy',
    name: 'Orbital Deployment',
    description: 'Fast-track a satellite to low Earth orbit.',
    flavourText: 'The higher the vantage, the further the reach.',
    era: 'nearSpace',
    effect: { resources: { materials: -15 }, fields: { engineering: 10 }, signalProgress: 5 },
    counterEffect: null,
    upgradesFrom: null,
  }],
  ['signalFilter', {
    id: 'signalFilter',
    name: 'Noise Filtering Algorithm',
    description: 'Advanced computational filtering strips cosmic background from the signal.',
    flavourText: 'Pattern emerges from chaos.',
    era: 'nearSpace',
    effect: { fields: { computing: 8, mathematics: 6 }, signalProgress: 8 },
    counterEffect: {
      countersEventTag: 'interference',
      additionalCost: {},
      fullNeutralise: true,
    },
    upgradesFrom: 'lobbying',
  }],

  // ---------------------------------------------------------------------------
  // Cards unlocked by Era 1 technologies (Phase 14)
  // ---------------------------------------------------------------------------

  ['softwareGrant', {
    id: 'softwareGrant',
    name: 'Software Development Grant',
    description: 'Fund a dedicated software research initiative.',
    flavourText: 'Code is the new slide rule.',
    era: 'earth',
    effect: { fields: { computing: 10, mathematics: 5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],

  ['globalBroadcast', {
    id: 'globalBroadcast',
    name: 'Global Broadcast',
    description: 'Transmit programme achievements via satellite to a worldwide audience.',
    flavourText: 'Every nation watches. Every parliament takes note.',
    era: 'earth',
    effect: { resources: { politicalWill: 10, funding: 8 } },
    counterEffect: {
      countersEventTag: 'interference',
      additionalCost: { politicalWill: 8 },
      fullNeutralise: false,
    },
    upgradesFrom: null,
  }],

  ['computerModellingRun', {
    id: 'computerModellingRun',
    name: 'Computer Modelling Run',
    description: 'Run a large-scale simulation to accelerate theoretical research.',
    flavourText: 'The machine works while the team sleeps.',
    era: 'earth',
    effect: { fields: { physics: 10, mathematics: 8, computing: 5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],

  ['digitalCoordination', {
    id: 'digitalCoordination',
    name: 'Digital Coordination Network',
    description: 'Link research teams across facilities via digital networks.',
    flavourText: 'Shared data multiplies faster than any single laboratory could.',
    era: 'earth',
    effect: { fields: { computing: 8, socialScience: 6, mathematics: 4 } },
    counterEffect: null,
    upgradesFrom: null,
  }],

  ['biomedicalAdvance', {
    id: 'biomedicalAdvance',
    name: 'Biomedical Advance',
    description: 'Apply sequencing breakthroughs to programme health and longevity research.',
    flavourText: 'Keeping our people operational is also an engineering problem.',
    era: 'earth',
    effect: { fields: { biochemistry: 12, socialScience: 5 } },
    counterEffect: null,
    upgradesFrom: null,
  }],

  ['openSourceResearch', {
    id: 'openSourceResearch',
    name: 'Open-Source Research Platform',
    description: 'Release non-classified findings to accelerate global scientific progress.',
    flavourText: 'The signal affects everyone. The response should too.',
    era: 'earth',
    effect: { fields: { computing: 10, socialScience: 8, mathematics: 6 } },
    counterEffect: null,
    upgradesFrom: null,
  }],

  ['signalDeconvolution', {
    id: 'signalDeconvolution',
    name: 'Signal Deconvolution Run',
    description: 'Apply digital telemetry techniques to isolate signal from background noise.',
    flavourText: 'The pattern was always there. We simply lacked the tools to see it.',
    era: 'earth',
    effect: { signalProgress: 8, fields: { physics: 5, computing: 5 } },
    counterEffect: {
      countersEventTag: 'signal',
      additionalCost: {},
      fullNeutralise: false,
    },
    upgradesFrom: null,
  }],
]);
