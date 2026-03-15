# Future Phases - NOT ready to be implemented

This is a list of future requirements for the game but they are not to be implemented until a specific plan is created. This list is not ordered.

- UI visual flare:
  - Visual flare/animation/effect when the player takes actions such as building a facility, playing a card etc
  - The game is just too dark, the colour scheme is too muted
  - On the HUD, highlight resources which have a negative income
- Card rework:
  - More cards, gated by technologies and eras
  - Animate reshuffle of cards at the start of each turn (clearer that new cards have been dealt)
  - Fix the height of the action had to be the height of a banked card
  - Prevent the action card bar from ever having a scrollbar
- Climate
  - The climate scaling is too harsh and tile damage happens far too early
  - Irradiated damage shouldn't exist without nuclear facilities
  - Climate bar tooltip should show summary of pollution generators and mitigations
- The Signal:
  - Some events conflict and cannot appear at the same time (e.g. signal interference / signal breakthrough)
  - Signal should not be decoded before era 3
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
  - Some maps are too restrictive as they don't have sufficient tiles of various types, especially urban tiles. Need a way to create more urban tiles (which is realistic anyway)
  - It's too easy to fill up the map and have nothing to do. I have only destroyed facilities in a funding emergency.
  - Could each hex contain multiple facilities? Divide the hex into 3 or 6? Some facilities may span multiple sectors.
  - Need meaningful action cards for the first few turns; not just building. Actually, should building a facility cost an action? Yes.
- Earth era content pass
  - Technologies shouldn't require Computing until integrated circuits have been unlocked.
  - Technologies are too dependent on Computing but there are very few ways of getting Computing research
- LEO era content pass
  - Map improvement actions such as sea walls
- Asteroid era content pass
  - Map improvement actions such as reforestation, radiation cleanup, floating cities
- Game art:
  - Low poly or pixel art, clear colour coding (e.g. mines will be brown, research facilities blue, funding generators yellow )
  - Show building icons on hex map?
  - Generic profile pictures for board members
  - Flavour text for board members
- Tech tree dependencies:
  - Most technologies will have prerequisite technologies that must be researched first
  - Clicking on a discovered or in progress technology in the tech tree should show more information
  - The Discovered/In Progress/Rumoured/Unknown legend at the bottom should be part of the HTML modal and not the Phaser canvas
  - Once a technology is discovered, do not show the progress bars, freeing up space for the events/facilities/actions it unlocks
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
  - The funding crisis event mitigation does strange things when you don't actually have the funds
  - Tooltips can go off the bottom of the map
  - Can I disable the back button, or at least warn of game loss?



## FACILITY IDEAS:

Era 1:

- Coal Power Station (+funding, + climate)
- Petrochemical Refinery (+funding, +climate)
- Industrial Port (+funding, +materials, +climate)

Era 2:


Era 3:
