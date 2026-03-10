// =============================================================================
// SIGNAL — Narrative Definitions
// Opening sequence, era transitions, signal decode stages, win/lose endings.
//
// Design constraints (GDD §):
//   - The signal is an automated alien device. It has no personality or agenda.
//     All text must reflect this — it is machinery, not a mind.
//   - The wormhole is a fixed structure at the heliopause. It was not built by
//     humanity and cannot be replicated. The destination is never revealed.
//   - Setting: alt-history starting 1970, game ends ~2100.
// =============================================================================

import type { NarrativeDef } from '../engine/types';

// ---------------------------------------------------------------------------
// Opening sequence (shown before bloc selection on /newgame — skippable)
// ---------------------------------------------------------------------------

export const NARRATIVE_OPENING: NarrativeDef = {
  id: 'narrative-opening',
  title: 'Prologue',
  skippable: true,
  slides: [
    {
      text: 'July 1969. The first human footprints are pressed into lunar regolith. Mankind looks up and calls it a beginning.',
      imageColour: '#070d18',
    },
    {
      text: 'Twelve months later, a routine telemetry sweep of the outer solar system returns a result that cannot be explained. The signal does not match any known natural source. It is structured. It is repeating. It is very old.',
      imageColour: '#0a0f1a',
    },
    {
      text: 'The finding is classified within hours. A small working group is convened — physicists, mathematicians, and one political officer who will never be named in any public record.',
      imageColour: '#080c14',
    },
    {
      text: 'They determine that whatever is transmitting the signal has been doing so since before the first human city was built. It is not waiting for us. It is simply running.',
      imageColour: '#060a12',
    },
    {
      text: 'Your organisation is the result of that meeting. You have been given resources, latitude, and a single objective: decode the transmission — and decide what to do when you have.',
      imageColour: '#04080f',
    },
  ],
};

// ---------------------------------------------------------------------------
// Game help, shown after the opening sequence and before the first turn — skippable)
// ---------------------------------------------------------------------------

export const NARRATIVE_GAME_HELP: NarrativeDef = {
  id: 'narrative-game-help',
  title: 'The Game Experience',
  skippable: true,
  slides: [
    {
      text: 'Your goal is to decode the signal. The game is structured around that objective. Every decision you make should be in service of that goal.',
      imageColour: '#080808',
    },
    {
      text: 'On each turn you will be able to choose from a set of actions. Each action has a cost and an effect. Some actions will advance your signal decode progress. Others will improve your resources, your political position, or your scientific capabilities.',
      imageColour: '#0a0a0a',
    },
    {
      text: 'The signal is not the only thing you have to worry about. The world is changing around you. Climate change, political instability, economic crises — these are all real threats that can derail your programme if you do not manage them.',
      imageColour: '#0a0a0a',
    },
    {
      text: 'In the center of the game screen is a map of your bloc. You may build installations there to improve your capabilities. Your HQ is at the centre. On different tiles, you may build a research lab, a resource mine, a power station, or other more powerful installations.',
      imageColour: '#080808',
    },
    {
      text: 'At the bottom, there are a number of action cards that you may play in a turn - up to 3 cards. You may also bank cards for later use.',
      imageColour: '#0a0a0a',
    },
    {
      text: 'On the left, various events may help or hinder your progress. Some cards can help mitigate these events.',
      imageColour: '#080808',
    },
    {
      text: 'On the right, your scientific progress is tracked. The signal decode progress is the most important metric, but you also have a climate index, a political stability index, and a resource index. Keep an eye on all of them.',
      imageColour: '#0a0a0a',
    },
    {
      text: 'Technologies you research will be shown in the Tech Tree. Some technologies will unlock new actions, new installations, or new capabilities. Others will improve your existing ones.',
      imageColour: '#080808',
    },
    {
      text: 'The Board represents the committee who support your programme. Choose wisely to fill the positions.',
      imageColour: '#0a0a0a',
    }
  ],
};

// ---------------------------------------------------------------------------
// Era transitions
// ---------------------------------------------------------------------------

export const NARRATIVE_ERA_NEARSPACE: NarrativeDef = {
  id: 'narrative-era-nearspace',
  title: 'Era II — Near Space',
  slides: [
    {
      text: 'Your first orbital platform is operational. The boundary between Earth and space — once a hard ceiling of cost and politics — is now a threshold you cross routinely.',
      imageColour: '#080f20',
    },
    {
      text: 'The signal is clearer up here. Ground-based interference stripped away, the underlying structure becomes easier to isolate. Your analysts are cautiously optimistic.',
      imageColour: '#0a1228',
    },
    {
      text: 'A new operational era begins. Lunar access is within reach. So is the signal.',
      imageColour: '#060a1c',
    },
  ],
};

export const NARRATIVE_ERA_DEEPSPACE: NarrativeDef = {
  id: 'narrative-era-deepspace',
  title: 'Era III — Deep Space',
  slides: [
    {
      text: 'Your instruments now reach the outer solar system. The heliopause — the boundary where the sun\'s influence finally gives way to interstellar space — is no longer a theoretical limit. It is a destination.',
      imageColour: '#06080f',
    },
    {
      text: 'At these distances, light-speed delay makes real-time command impossible. Your deep space assets operate with considerable autonomy. You trust the systems you built.',
      imageColour: '#08060e',
    },
    {
      text: 'And then the probes confirm it. At the heliopause, something is waiting. A structure — vast, inert, and clearly artificial — that your instruments have no framework to classify.',
      imageColour: '#04050c',
    },
    {
      text: 'It is not a ship. It is not a station. Preliminary analysis suggests it has been there for approximately twelve thousand years. The signal originates from inside it.',
      imageColour: '#030409',
    },
  ],
};

// ---------------------------------------------------------------------------
// Signal decode stage narratives
// Triggered when eraStrength crosses a threshold (30% → structured, 70% → urgent)
// ---------------------------------------------------------------------------

export const NARRATIVE_SIGNAL_STRUCTURED: NarrativeDef = {
  id: 'narrative-signal-structured',
  title: 'Signal Analysis — Pattern Confirmed',
  slides: [
    {
      text: 'Decode progress has crossed a threshold. The signal is no longer merely anomalous — your team has isolated a repeating mathematical structure embedded in the transmission carrier wave.',
      imageColour: '#061210',
    },
    {
      text: 'It is not a message in any conventional sense. It is closer to a schema — a set of formal relationships that your mathematicians describe as "instructions for understanding instructions." The outer layers are becoming legible.',
      imageColour: '#081814',
    },
    {
      text: 'Whatever sent this did not assume a recipient species. It assumed a recipient capable of mathematics. The distinction matters.',
      imageColour: '#061210',
    },
  ],
};

export const NARRATIVE_SIGNAL_URGENT: NarrativeDef = {
  id: 'narrative-signal-urgent',
  title: 'Signal Analysis — Full Structure Revealed',
  slides: [
    {
      text: 'Decoding is nearly complete. The structure of the transmission is now fully mapped. At its core is a set of operational parameters — not for a device you would build, but for one that already exists.',
      imageColour: '#1a0a00',
    },
    {
      text: 'The structure at the heliopause is not a monument or a beacon. It is an interface. The signal is its activation sequence. It has been broadcasting the instructions to open it for twelve millennia, waiting for someone to send the correct response.',
      imageColour: '#1a0800',
    },
    {
      text: 'Your team has identified two or three candidate responses from the decoded parameters. The consequences of choosing incorrectly are not specified in the transmission. They may be trivial. They may not be.',
      imageColour: '#150600',
    },
    {
      text: 'The response window is open. This decision belongs to you.',
      imageColour: '#100400',
    },
  ],
};

// ---------------------------------------------------------------------------
// Victory narratives
// ---------------------------------------------------------------------------

export const NARRATIVE_VICTORY_WORMHOLE: NarrativeDef = {
  id: 'narrative-victory-wormhole',
  title: 'Outcome — Wormhole Activated',
  slides: [
    {
      text: 'The resonance pathway opens. Your transmitted response triggers a cascade of processes within the heliopause structure — processes that have been dormant for twelve thousand years.',
      imageColour: '#0a0520',
    },
    {
      text: 'The aperture is stable. Preliminary sensor sweeps show no hazardous radiation, no gravitational anomaly. Just a passage — circular, two kilometres in diameter — opening onto somewhere that is not the solar system.',
      imageColour: '#0d0828',
    },
    {
      text: 'There is no indication of what lies beyond. No return signal. No welcome. The structure performed its function and is now idle again.',
      imageColour: '#100a30',
    },
    {
      text: 'Humanity spends six months arguing about what to do next. This was always going to happen. The door is open. That is what you were asked to achieve.',
      imageColour: '#080518',
    },
  ],
};

export const NARRATIVE_VICTORY_ECOLOGICAL: NarrativeDef = {
  id: 'narrative-victory-ecological',
  title: 'Outcome — Ecological Restoration',
  slides: [
    {
      text: 'The climate stabilisation measures your organisation pioneered have been adopted globally. Climate pressure has fallen to levels not seen since the mid-twentieth century.',
      imageColour: '#051205',
    },
    {
      text: 'This was not the original objective. But the technologies developed in pursuit of the signal — renewable infrastructure, resource efficiency systems, global monitoring networks — turned out to be exactly what Earth needed.',
      imageColour: '#071507',
    },
    {
      text: 'The signal remains only partially decoded. Perhaps that is a project for the next generation — one that will inherit a planet worth leaving.',
      imageColour: '#051205',
    },
  ],
};

export const NARRATIVE_VICTORY_ECONOMIC: NarrativeDef = {
  id: 'narrative-victory-economic',
  title: 'Outcome — Economic Hegemony',
  slides: [
    {
      text: 'Your programme controls more of the global resource economy than any single nation. The technologies you developed and licensed have made your organisation effectively irreplaceable.',
      imageColour: '#14120a',
    },
    {
      text: 'Whether this constitutes a success is a matter of perspective. You have the resources to pursue the signal for as long as it takes. You have the political insulation to do so without interference.',
      imageColour: '#16140a',
    },
    {
      text: 'The signal work continues — now from a position of permanent institutional security. The wormhole question will be answered eventually. You can afford to wait.',
      imageColour: '#14120a',
    },
  ],
};

export const NARRATIVE_VICTORY_TERRAFORMING: NarrativeDef = {
  id: 'narrative-victory-terraforming',
  title: 'Outcome — Multi-World Presence',
  slides: [
    {
      text: 'The Lunar Surface installation is self-sustaining. Humanity is no longer a single-planet species. The question of what happens to Earth — to the signal, to the programme — is no longer existential in the way it once was.',
      imageColour: '#060a18',
    },
    {
      text: 'The signal research continues from both installations. The additional baseline — Earth and Moon, separated by 384,000 kilometres — has improved triangulation of the source structure significantly.',
      imageColour: '#080c1a',
    },
    {
      text: 'If something goes wrong at the heliopause, there will be survivors somewhere. You built that option into the plan from the beginning, even when it was not politically acceptable to say so.',
      imageColour: '#060a16',
    },
  ],
};

// ---------------------------------------------------------------------------
// Loss narratives
// ---------------------------------------------------------------------------

export const NARRATIVE_LOSS_CLIMATE: NarrativeDef = {
  id: 'narrative-loss-climate',
  title: 'Outcome — Climate Collapse',
  slides: [
    {
      text: 'The climate tipping point was crossed three turns ago. By the time the models confirmed it, the cascade was already irreversible.',
      imageColour: '#200800',
    },
    {
      text: 'The programme continues in a reduced form — there is still a building, still a mandate, still a signal. But the world it was built to act on behalf of is a different world now.',
      imageColour: '#1a0600',
    },
    {
      text: 'The signal keeps transmitting. It has been transmitting since before agriculture. It will transmit long after this.',
      imageColour: '#150400',
    },
  ],
};

export const NARRATIVE_LOSS_MISINTERPRETATION: NarrativeDef = {
  id: 'narrative-loss-misinterpretation',
  title: 'Outcome — Signal Misinterpretation',
  slides: [
    {
      text: 'The response was incorrect. The heliopause structure registered the transmission, processed it, and locked.',
      imageColour: '#18001a',
    },
    {
      text: 'There is no error message. No indication of what the correct response would have been. The structure is inert. The aperture did not open. Whatever process was initiated by the signal has concluded.',
      imageColour: '#140018',
    },
    {
      text: 'It is possible the window will open again in another twelve thousand years. Your organisation does not have a plan for that scenario.',
      imageColour: '#100015',
    },
  ],
};

export const NARRATIVE_LOSS_POLITICAL: NarrativeDef = {
  id: 'narrative-loss-political',
  title: 'Outcome — Political Collapse',
  slides: [
    {
      text: 'The mandate has been withdrawn. The committee vote was not close. The programme is to be "restructured" — a word that, in this context, means disbanded.',
      imageColour: '#0a0a12',
    },
    {
      text: 'The signal files are sealed and transferred to a department whose name suggests it does not deal with matters of this kind. Whether anyone there will know what to do with them is not your concern now.',
      imageColour: '#080810',
    },
    {
      text: 'Somewhere at the heliopause, the transmission continues. It has no opinion about any of this.',
      imageColour: '#06060e',
    },
  ],
};

export const NARRATIVE_LOSS_RESOURCE: NarrativeDef = {
  id: 'narrative-loss-resource',
  title: 'Outcome — Resource Exhaustion',
  slides: [
    {
      text: 'The accounts are empty. The materials warehouses are empty. The political capital — spent on crises, on compromises, on keeping the lights on — is gone.',
      imageColour: '#120a00',
    },
    {
      text: 'The core team stays on without pay for eleven days, running final analysis on the partial decode data. Then the building loses power and they go home.',
      imageColour: '#0e0800',
    },
    {
      text: 'The signal data is stored on a server that someone remembers to keep running for another six years, in case it becomes relevant again. It does not.',
      imageColour: '#0a0600',
    },
  ],
};

// ---------------------------------------------------------------------------
// Lookup maps — keyed by VictoryCondition / LossCondition string
// ---------------------------------------------------------------------------

export const VICTORY_NARRATIVES: Record<string, NarrativeDef> = {
  wormhole: NARRATIVE_VICTORY_WORMHOLE,
  ecologicalRestoration: NARRATIVE_VICTORY_ECOLOGICAL,
  economicHegemony: NARRATIVE_VICTORY_ECONOMIC,
  terraforming: NARRATIVE_VICTORY_TERRAFORMING,
};

export const LOSS_NARRATIVES: Record<string, NarrativeDef> = {
  climateCollapse: NARRATIVE_LOSS_CLIMATE,
  signalMisinterpretation: NARRATIVE_LOSS_MISINTERPRETATION,
  politicalCollapse: NARRATIVE_LOSS_POLITICAL,
  resourceExhaustion: NARRATIVE_LOSS_RESOURCE,
};
