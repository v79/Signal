# Future Phases - NOT ready to be implemented

This is a list of future requirements for the game but they are not to be implemented until a specific plan is created. This list is not ordered.

- **UI visual flare:**
  - Visual flare/animation/effect when the player takes actions such as building a facility, playing a card etc
  - The game is just too dark, the colour scheme is too muted
  - On the HUD, highlight resources which have a negative income
- **Card rework:**
  - More cards, gated by technologies and eras
  - Animate reshuffle of cards at the start of each turn (clearer that new cards have been dealt)
  - Fix the height of the action had to be the height of a banked card
  - Prevent the action card bar from ever having a scrollbar
  - The only card I ever bank counters scandal. Need other options worth banking.
- **Research:**
  - What to do once all the tech for an era has been researched?
- **Climate:**
  - The climate scaling is too harsh and tile damage happens far too early
  - Irradiated damage shouldn't exist without nuclear facilities
  - Climate bar tooltip should show summary of pollution generators and mitigations
- **The Signal:**
  - Some events conflict and cannot appear at the same time (e.g. signal interference / signal breakthrough)
  - Signal should not be decoded before era 3
- **Political Will:**
  - What is the difference between Global Will and Political Will?
  - Political Will should have a cap (100?)
  - Political Will is too easy to gain and too hard to spend (same as Materials)
  - Maybe a better name is Influence?
- **Era Gates**
  - See `planning/DESIGN_ERA_TRANSITIONS.md` for design discussion.
  - Era 1→2 gate: Permanent Orbital Station (multi-stage landmark project), guided by Board proposal event triggered on Orbital Mechanics tech discovery. Orbital Telescope Array as a smaller warm-up Scientific Project.
  - Era 2→3 gate: Lunar Base Establishment or Deep Space Transit (TBD).
- **Projects**
  - Projects need to be visible on the Maps
  - The Facilities that support projects (space launch centre) need to be visually distinct
- **Competitor blocs**
  - They are absent from the game so far.
  - Phase 26F was to introduce pressure events (first to orbital, etc) but nothing around other blocs has been implemented at all
- **Earth map**
  - Some maps are too restrictive as they don't have sufficient tiles of various types, especially urban tiles. Need a way to create more urban tiles (which is realistic anyway)
  - It's too easy to fill up the map and have nothing to do. I have only destroyed facilities in a funding emergency.
  - There's special logic to animate the building of the Orbital Station stages on the map. This should be generalised to support any multi-stage landmark.
- **Earth era content pass**
  - More playtesting required; Computing remains a problem
- **Near Earth/LEO Map**
- **LEO era content pass**
  - Map improvement actions such as sea walls for Earth
- **Asteroid era content pass**
  - Map improvement actions such as reforestation, radiation cleanup, floating cities
- **Game art:**
  - Low poly or pixel art, clear colour coding (e.g. mines will be brown, research facilities blue, funding generators yellow )
  - Show building icons on hex map?
  - Generic profile pictures for board members
  - Flavour text for board members
- **Tech tree dependencies:**
  - Clicking on a discovered or in progress technology in the tech tree should show more information
  - Once a technology is discovered, do not show the progress bars, freeing up space for the events/facilities/actions it unlocks
  - When the Narrative event for a technology discovery is shown, it should detail the cards, events, facilities that it unlocks/deprecates
- **News feed & ticker rework**
  - The ticker is cute but not very useful
- **Debug view and logs:**
  - Write the full news feed log to a file, plus information about resources and science fields each turn, to aid with debugging
- **Game menu:**
- **Steering Committee (formerly Board):**
  - See `planning/DESIGN_STEERING_COMMITTEE.md` for full design discussion.
  - Some board members 'auto counter' negative events. But I don't think this is implemented.
- **Climate management:**
  - This is not fleshed out at all
  - Postponed phase 20.2 on climate pressure scaling event severity
  - Events frequency may be affected by the current Climate or Global Will scores
  - Events may impact a specific map tile or a specific facility - disabling, destroying, or boosting the facility for the duration
  - It should not really be possible to lose the game by climate disaster in the Earth era, unless you try really really hard
  - Player should get a list of the biggest polluters
- **Next Turn / Phase Control**
  - Proper, aligned layout.


## BUGS:





## FACILITY IDEAS:

Era 1:

- Petrochemical Refinery (+funding, +climate)

Era 2:


Era 3:
