// =============================================================================
// SIGNAL — Technology Definitions (Era 1: Earth, 1970–2010)
// Static definitions for all researchable technologies in Era 1.
// Era 2 (Near Space) and Era 3 (Asteroid Belt) techs are deferred to
// Phase 15 and Phase 16 content passes respectively.
//
// Field threshold design (40-turn Era 1):
//   Tier 1 (~30–60 pts):   turns 5–12   (years 1975–1982)
//   Tier 2 (~75–120 pts):  turns 12–22  (years 1982–1992)
//   Tier 3 (~120–160 pts): turns 22–34  (years 1992–2004)
//   Tier 4 (~180–200 pts): turns 30–40  (years 2000–2010) — Era 2 gate
// =============================================================================

import type { TechDef } from '../engine/types';

export const TECH_DEFS: Map<string, TechDef> = new Map([
  // ---------------------------------------------------------------------------
  // Tier 1 — Foundation Technologies (1975–1982)
  // ---------------------------------------------------------------------------

  [
    'integratedCircuits',
    {
      id: 'integratedCircuits',
      name: 'Integrated Circuit Arrays',
      rumourText:
        'Miniaturised components are being tested that may replace entire banks of discrete transistors.',
      baseRecipe: { engineering: 40, computing: 25 },
      recipeVariance: 0.2,
      requiresSimultaneous: false,
      unlocksCards: ['softwareGrant'],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-integratedCircuits',
        title: 'Discovery — Integrated Circuit Arrays',
        slides: [
          {
            text: 'The entire logic stack has been miniaturised onto a single substrate. Processing power that filled a room now fits in a package smaller than a fingernail.',
          },
          {
            text: 'Signal analysis algorithms that previously required dedicated hardware can now run on compact, field-deployable units. The programme\'s analytical capacity has increased substantially.',
          },
        ],
      },
    },
  ],

  [
    'rocketGuidanceSystems',
    {
      id: 'rocketGuidanceSystems',
      name: 'Precision Rocket Guidance',
      rumourText:
        'Navigation accuracy beyond the atmosphere may soon allow reliable orbital insertion on first attempt.',
      baseRecipe: { physics: 35, mathematics: 30, engineering: 40 },
      recipeVariance: 0.15,
      requiresSimultaneous: false,
      unlocksCards: [],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-rocketGuidanceSystems',
        title: 'Discovery — Precision Rocket Guidance',
        slides: [
          {
            text: 'Orbital insertion on first attempt is now reliable. The mathematics of mid-course trajectory correction has been reduced to a procedure rather than an art.',
          },
          {
            text: 'Payload delivery to precise orbital positions is now achievable. Future deep-space probe placement can be calculated to within acceptable margins from the outset.',
          },
        ],
      },
    },
  ],

  [
    'satelliteCommunications',
    {
      id: 'satelliteCommunications',
      name: 'Satellite Communications',
      rumourText:
        'A relay station in orbit could link every ground facility on the globe simultaneously.',
      baseRecipe: { physics: 45, engineering: 50 },
      recipeVariance: 0.2,
      requiresSimultaneous: false,
      unlocksCards: ['globalBroadcast'],
      unlocksProjects: [],
      unlocksFacilities: ['deepSpaceArray'],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-satelliteCommunications',
        title: 'Discovery — Satellite Communications',
        slides: [
          {
            text: 'An orbital relay now links every ground facility simultaneously. Data that previously required physical transfer across continents arrives in seconds.',
          },
          {
            text: 'An unexpected side effect: signal readings taken through the relay are cleaner than anything recorded from the ground. The atmosphere, it turns out, was obscuring more than we understood. Deep Space Array construction is now viable.',
          },
        ],
      },
    },
  ],

  [
    'microprocessors',
    {
      id: 'microprocessors',
      name: 'Microprocessor Architecture',
      rumourText:
        'A single chip carrying a complete instruction set has been demonstrated in prototype form.',
      baseRecipe: { computing: 55, mathematics: 40 },
      recipeVariance: 0.2,
      requiresSimultaneous: false,
      unlocksCards: ['computerModellingRun'],
      unlocksProjects: [],
      unlocksFacilities: ['computingHub'],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-microprocessors',
        title: 'Discovery — Microprocessor Architecture',
        slides: [
          {
            text: 'A complete instruction set on a single chip, manufactured at scale. The cost of computation has dropped by two orders of magnitude.',
          },
          {
            text: 'Pattern-matching algorithms that previously required purpose-built hardware can now run on clusters of standard components. High-performance computing facilities are now a realistic capital investment.',
          },
        ],
      },
    },
  ],

  // ---------------------------------------------------------------------------
  // Tier 2 — Orbital Era Technologies (1982–1992)
  // ---------------------------------------------------------------------------

  [
    'personalComputing',
    {
      id: 'personalComputing',
      name: 'Personal Computing',
      rumourText:
        'Desktop machines with sufficient power for scientific calculation may reach civilian researchers within years.',
      baseRecipe: { computing: 80, socialScience: 45 },
      recipeVariance: 0.25,
      requiresSimultaneous: false,
      unlocksCards: ['digitalCoordination'],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-personalComputing',
        title: 'Discovery — Personal Computing',
        slides: [
          {
            text: 'Scientific-grade computation is now available to individual researchers. The bottleneck of centralised processing has been removed.',
          },
          {
            text: 'Distributed analysis across the entire research staff is now possible. Problems that previously required weeks of scheduled mainframe time can be explored in parallel, in parallel, by anyone with a terminal.',
          },
        ],
      },
    },
  ],

  [
    'geneticSequencing',
    {
      id: 'geneticSequencing',
      name: 'Genetic Sequencing Technology',
      rumourText:
        'The chemical language of DNA is almost legible — automated reading may be possible within a decade.',
      baseRecipe: { biochemistry: 75, computing: 55 },
      recipeVariance: 0.25,
      requiresSimultaneous: false,
      unlocksCards: ['biomedicalAdvance'],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-geneticSequencing',
        title: 'Discovery — Genetic Sequencing Technology',
        slides: [
          {
            text: 'The chemical language of DNA is now readable at speed. Automated sequencing has reduced a decade of laboratory work to a matter of hours.',
          },
          {
            text: 'The team notes, without irony, that decoding a structured biological information system is not entirely unlike decoding a structured electromagnetic transmission. Pattern recognition is pattern recognition, whatever the substrate.',
          },
        ],
      },
    },
  ],

  [
    'globalPositioningNetwork',
    {
      id: 'globalPositioningNetwork',
      name: 'Global Positioning Network',
      rumourText:
        'A constellation of precision timing satellites could yield metre-accuracy navigation across the entire planet.',
      baseRecipe: { mathematics: 85, physics: 65, computing: 60 },
      recipeVariance: 0.15,
      requiresSimultaneous: false,
      unlocksCards: [],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-globalPositioningNetwork',
        title: 'Discovery — Global Positioning Network',
        slides: [
          {
            text: 'Metre-accuracy positioning across the entire planet, derived from a constellation of precision timing satellites. Navigation has been solved.',
          },
          {
            text: 'The precise orbital baselines established by the network have an additional use: improved triangulation of the outer solar system transmission source. The signal origin has been refined to within a 200,000-kilometre radius of the heliopause boundary.',
          },
        ],
      },
    },
  ],

  [
    'roboticsAutomation',
    {
      id: 'roboticsAutomation',
      name: 'Robotics and Remote Automation',
      rumourText:
        'Articulated machines capable of sustained remote operation in hostile environments have passed field trials.',
      baseRecipe: { engineering: 90, computing: 70 },
      recipeVariance: 0.2,
      requiresSimultaneous: false,
      unlocksCards: [],
      unlocksProjects: [],
      unlocksFacilities: ['asteroidMiner'],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-roboticsAutomation',
        title: 'Discovery — Robotics and Remote Automation',
        slides: [
          {
            text: 'Articulated machines capable of sustained autonomous operation in radiation, vacuum, and extreme temperatures have passed all field trials. The outer solar system becomes accessible without risking personnel.',
          },
          {
            text: 'Asteroid extraction becomes a viable materials source. What previously required a human crew can now be handled by equipment that does not need to come home.',
          },
        ],
      },
    },
  ],

  // ---------------------------------------------------------------------------
  // Tier 3 — Digital Age & Signal Foundations (1992–2004)
  // ---------------------------------------------------------------------------

  [
    'internetProtocols',
    {
      id: 'internetProtocols',
      name: 'Global Internetwork Protocols',
      rumourText:
        'A common packet-routing standard may allow every research facility on Earth to share data in real time.',
      baseRecipe: { computing: 130, mathematics: 95 },
      recipeVariance: 0.2,
      requiresSimultaneous: false,
      unlocksCards: ['openSourceResearch'],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-internetProtocols',
        title: 'Discovery — Global Internetwork Protocols',
        slides: [
          {
            text: 'A common packet-routing standard now connects every research facility on Earth in real time. Data that previously required scheduled courier transfer moves instantaneously and continuously.',
          },
          {
            text: 'Signal analysis that previously required weeks of data aggregation now completes overnight. The global research network is, for the first time, functioning as a single instrument.',
          },
        ],
      },
    },
  ],

  [
    'digitisedTelemetry',
    {
      id: 'digitisedTelemetry',
      name: 'Digitised Space Telemetry',
      rumourText:
        'Standardised digital transmission formats for deep-space probes would dramatically improve the precision of signal analysis.',
      baseRecipe: { physics: 120, computing: 100, mathematics: 85 },
      recipeVariance: 0.15,
      requiresSimultaneous: false,
      unlocksCards: ['signalDeconvolution'],
      unlocksProjects: [],
      unlocksFacilities: [],
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-digitisedTelemetry',
        title: 'Discovery — Digitised Space Telemetry',
        slides: [
          {
            text: 'Standardised digital transmission formats have transformed the probe feed data. Error correction and compression have dropped the noise floor to levels that were previously theoretical.',
          },
          {
            text: 'The signal now stands out more clearly than it ever has before. Features of the transmission that were previously indistinguishable from instrument noise are now unambiguously present. The outer structure is becoming legible.',
          },
        ],
      },
    },
  ],

  [
    'signalPatternAnalysis',
    {
      id: 'signalPatternAnalysis',
      name: 'Signal Pattern Analysis',
      rumourText:
        'The transmission is not random. The interval structure repeats at a period inconsistent with any known pulsar or natural source.',
      baseRecipe: { computing: 150, mathematics: 125, physics: 100 },
      recipeVariance: 0.1,
      requiresSimultaneous: true,
      unlocksCards: [],
      unlocksProjects: [],
      unlocksFacilities: [],
      // Gated: only enters the rumour pool once signal.eraStrength >= 'structured'.
      signalDerived: true,
      narrative: {
        id: 'narrative-tech-signalPatternAnalysis',
        title: 'Discovery — Signal Pattern Analysis',
        slides: [
          {
            text: 'The transmission is not random. The interval structure encodes a repeating mathematical schema — not a message in any conventional sense, but a formal system for constructing one.',
          },
          {
            text: 'Whatever designed this signal did not assume a recipient species. It assumed a recipient capable of mathematics. The outer layers are now fully mapped. What remains is decoding the operational core.',
          },
        ],
      },
    },
  ],

  // ---------------------------------------------------------------------------
  // Tier 4 — Era 2 Gate (2000–2010)
  // ---------------------------------------------------------------------------

  [
    'orbitalMechanics',
    {
      id: 'orbitalMechanics',
      name: 'Applied Orbital Mechanics',
      rumourText:
        'Sustained human habitation in low orbit is within theoretical reach — the mathematics is there; the engineering must follow.',
      baseRecipe: { physics: 200, mathematics: 140 },
      recipeVariance: 0.15,
      requiresSimultaneous: true,
      unlocksCards: [],
      unlocksProjects: [],
      unlocksFacilities: ['orbitalPlatform', 'lunarMine'],
      // Simultaneous requirement: the player must invest in both physics AND mathematics.
      // Neglecting mathematics for physics leaves the Near Space era permanently locked.
      signalDerived: false,
      narrative: {
        id: 'narrative-tech-orbitalMechanics',
        title: 'Discovery — Applied Orbital Mechanics',
        slides: [
          {
            text: 'The mathematical framework for sustained human presence in low Earth orbit is complete. Trajectory planning, station-keeping, re-entry corridors — the theory is settled. The remaining work is engineering.',
          },
          {
            text: 'Orbital platform construction and lunar operations are now viable. The programme is no longer Earth-bound. Near Space access opens.',
          },
        ],
      },
    },
  ],
]);
