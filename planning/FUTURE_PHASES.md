# Future Phases - NOT ready to be implemented

This is a list of future requirements for the game but they are not to be implemented until a specific plan is created. This list is not ordered.

- UI visual flare:
  - Visual flare/animation/effect when the player takes actions such as building a facility, playing a card etc
  - The game is just too dark, the colour scheme is too muted
- Card rework:
  - More cards, gated by technologies and eras
  - Animate reshuffle of cards at the start of each turn (clearer that new cards have been dealt)
- The Signal:
  - Some events conflict and cannot appear at the same time (e.g. signal interference / signal breakthrough)
  - Signal should be decoded before era 3
- Political Will:
  - What is the difference between Global Will and Political Will?
  - Political Will should have a cap (100?)
  - Political Will is too easy to gain and too hard to spend (same as Materials)
  - Maybe a better name is Influence?
- Era Gates
  - We haven't yet given much thought to how to unlock and progress Eras.
- Competitor blocs
  - They are absent from the game so far.
- Earth map
  - Show the name of our player's Bloc somewhere in the HUD or map
  - Visualise neighbour adjacency bonuses/penalties - not the numbers, just indicate that they exist
  - Add panning and scrolling, constrained to bounds so the player can't lose the map entirely
  - Add a thematic loading text before the map renders
  - Map-specific events, such as coastalFlooding, should impact a specific tile, and should destroy any facility on that tile
  - A drop-down list of all facilities should be available, as an overview of what exists
  - Some facilities will pollute (increase climate degradation), a few will heal the climate, and some may prevent tile loss (sea walls)
  - Some maps are too restrictive as they don't have sufficient tiles of various types, especially urban tiles. Need a way to create more urban tiles (which is realistic anyway)
  - Climate pressure could change some tiles (forest -> arid), destroying any incompatible facilities
  - It's too easy to fill up the map and have nothing to do. Only destroyed facilities in a funding emergency.
  - Could each hex contain multiple facilities? Divide the hex into 3 or 6? Some facilities may span multiple sectors.
- Earth era content pass
  - Solar and wind farms available to early. Need a poluting power source before the mid-1990s. Need Technologies which unlock Solar and Wind power.
  - Technologies shouldn't require Computing until integrated circuits have been unlocked.
- LEO content pass
- Asteroid era content pass
- Game art:
  - Low poly or pixel art, clear colour coding (e.g. mines will be brown, research facilities blue, funding generators yellow )
  - Show building icons on hex map
  - Generic profile pictures for board members
  - Flavour text for board members
- Tech tree dependencies:
  - Most technologies will have prerequisite technologies that must be researched first
  - Draw connecting lines between discovered technologies and progressing technologies
  - Clicking on a discovered or in progress technology in the tech tree should show more information
  - The Discovered/In Progress/Rumoured/Unknown legend at the bottom should be part of the HTML modal and not the Phaser canvas
- News feed & ticker rework
  - The ticker is cute but not very functional
- Debug view and logs:
  - Write the full news feed log to a file, plus information about resources and science fields each turn, to aid with debugging
- Game menu:
  - Move the Import and Export options into the dropdown game menu; rename as Save and Load
- Committee/Board:
  - Make it more prominent, it's too easy to ignore
  - Don't offer people if you can't afford the recruitment cost
  - The Board moves to a tab in the main panel, [ Earth | Near Space | Asteroid Belt | ... | Board]
  - This gives a lot more room for the Board - use it! Add placeholders for art (headshot pictures). Add a summary of the gains and losses provided by the current board members.
- Climate management:
  - This is not fleshed out at all
  - Postponed phase 20.2 on climate pressure scaling event severity
  - Events frequency may be affected by the current Climate or Global Will scores
  - Events may impact a specific map tile or a specific facility - disabling, destroying, or boosting the facility for the duration



  BUGS:

  - Political will isn't reduced when accepting an event which is supposed to cost Will
