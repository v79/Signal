// =============================================================================
// SIGNAL — Help topics
// Plain-English reference copy shown by HelpModal. Keyed by tab id used in
// MapContainer.svelte and the right-column panels in +page.svelte.
// =============================================================================

export interface HelpTopic {
  /** Heading shown at the top of the modal. */
  title: string;
  /** Paragraph blocks. Each entry is rendered as a separate <p>. */
  body: string[];
}

export type HelpTopicId =
  | 'earth'
  | 'space'
  | 'belt'
  | 'projects'
  | 'board'
  | 'blocs'
  | 'techTree';

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  earth: {
    title: 'Earth Map',
    body: [
      "The Earth map is your home territory — a hex grid of tiles your bloc controls. Each tile has a type (urban, industrial, coastal, highland, forested, arid, or agricultural) and three slots that can host facilities. Most facilities take one slot; large ones (like the Space Launch Centre) take two or three.",
      "Every facility has restrictions on which tile types it can be placed on. Click a tile to see the build options it accepts. Facilities produce a mix of research field points, funding, and materials each turn.",
      "Adjacency matters. Some facilities boost or penalise their neighbours — for example, a Research Lab next to a Public University strengthens both. Hover the tile glyphs to see which adjacencies apply.",
      "Facilities cost actions to construct. Demolition is also an action. Tiles can be flooded, dustbowled, or irradiated by events; a destroyed tile is permanently lost.",
    ],
  },
  space: {
    title: 'Near Space Map',
    body: [
      "Near Space replaces tile-and-adjacency thinking with launch logistics. Instead of a hex grid, you see a small set of fixed orbital nodes — Low Earth Orbit, Lagrange points, and lunar surface sites — each with a launch cost in materials.",
      "Building anything in Near Space requires a working Space Launch Centre on Earth (and other capacity sources, like Fuel Depots and Lunar Launch Facilities). The LAUNCH CAPACITY widget at the top of this tab shows how many supply units you've got and how many are committed.",
      "Each space facility consumes 1 or more capacity per turn while supplied. If you run out of capacity, open the ASSETS panel and toggle facilities off — mothballed facilities stop producing, but stop consuming too. Some lunar facilities are mutually exclusive within a chain (e.g. Mine vs Habitat at the same node).",
    ],
  },
  belt: {
    title: 'Asteroid Belt',
    body: [
      "The Asteroid Belt unlocks in Era 3 — well after the Moon Colony programme reaches its final stage. It's a sparse network of nodes (asteroids, Jovian moons, transit points, and the heliopause) connected by transit edges you must establish before you can use them.",
      "Detailed help for this view will land alongside the Era 3 content pass. For now: prospecting reveals a node's material yield, and the heliopause is where the alien signal originates.",
    ],
  },
  projects: {
    title: 'Projects',
    body: [
      "Projects are large undertakings that take several turns to complete. They sit alongside facilities in your strategic toolkit but produce different effects.",
      "There are three project types. CONTRACTS are short-term commercial or political deals — pure one-off rewards (funding, materials, political will). SCIENTIFIC projects produce ongoing research per turn after completion, like a permanent research bonus. LANDMARKS are era-defining undertakings — the Orbital Station programme opens Near Space; the Moon Colony programme opens the Asteroid Belt.",
      "To initiate a project, open the ONGOING ACTIONS panel on the right. Available projects are listed below your active construction queue. Each project has prerequisites — required techs, facilities, or earlier project stages — and consumes funding and materials up front, with optional per-turn upkeep while it runs.",
    ],
  },
  board: {
    title: 'Steering Committee',
    body: [
      "Your Steering Committee is a small set of named characters who fill role slots: Chief Scientist, Director of Engineering, Head of Finance, Political Liaison, Director of Operations, and others. Roles unlock as your programme grows.",
      "Each member brings one or two buffs — and a debuff. Characters are trade-offs, not free upgrades. They also age, retire, resign, and die. When a slot empties, a candidate pool is offered for recruitment; refusing to fill seats during the grace period leaves your programme weaker.",
      "Some cards in your hand require a specific role to be filled before they can be played. If you're seeing useful cards greyed out, check whether the matching role is sitting empty. AI board members become available in Era 3.",
    ],
  },
  blocs: {
    title: 'Blocs',
    body: [
      "Other blocs are not AI competitors — they are simulated presences that advance under simple rules each World Phase. You don't fight them directly. Instead, you watch what they do via the news ticker, the diplomatic event cards they generate, and this panel.",
      "Each bloc has a will profile (democratic or authoritarian — affecting volatility), a victory bias (which kind of programme they're racing toward), and a starting field profile. A bloc can decline, merge with a neighbour, or be eliminated entirely via narrative events.",
      "Use this view to gauge who is ahead and what kind of pressure to expect. If a rival bloc is racing toward the wormhole, expect competitive events; if one is collapsing, expect refugees and destabilisation cards.",
    ],
  },
  techTree: {
    title: 'Research Database',
    body: [
      "You never research a technology directly. Field points accumulate from facilities and played cards, and each tech has a recipe of field thresholds it needs to meet before it discovers itself. The tree shows which techs are visible, what they need, and what they unlock.",
      "Techs move through four visibility stages. RESTRICTED (unknown) means the tech is hidden — no name, no recipe, just a placeholder node. The tech exists in the run, but you have no information about it.",
      "UNCONFIRMED (rumour) reveals the tech's name and a flavour hint, but not its recipe. Something is on the horizon; you can't yet tell exactly what it costs to bring in.",
      "IN PROGRESS shows the full recipe and a per-field progress bar. You can see exactly which fields it's waiting on. Your facility output continues to feed it automatically each turn.",
      "DISCOVERED is the final state — the tech is yours. Its unlocks (cards, facilities, projects, tile actions) become available immediately. The recipe stays visible for reference but progress bars stop updating.",
      "A few signal-derived techs sit at SIGNAL HIDDEN until your decoding progresses. These remain locked even if their recipe could be met — you need the signal strength first.",
    ],
  },
};
