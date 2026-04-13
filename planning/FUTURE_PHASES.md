# Future Phases - NOT ready to be implemented

This is a list of future requirements for the game but they are not to be implemented until a specific plan is created. This list is not ordered.

- **UI visual flare:**
  - Visual flare/animation/effect when the player takes actions such as building a facility, playing a card, etc
  - The game is just too dark, the colour scheme is too muted
- **Era 2: nearSpace:**
  - Starting a game in Era 2 breaks the LEO station; not a big concern
  - There isn't enough to do, there are no choices to make
  - It's probably possible to progress in Era 2 by doing nothing - we need some way of blocking tech progress if there are no Era 2 facilities built?
- **Card rework:**
  - More cards, gated by technologies and eras
  - Animate reshuffle of cards at the start of each turn (clearer that new cards have been dealt)
  - Fix the height of the action had to be the height of a banked card
  - Prevent the action card bar from ever having a scrollbar
  - Ensure duplicate cards are not drawn at the same time
  - Cards may be made obsolete by technology or era — mechanism implemented (`obsoletedByTech`/`obsoletedByEra`, `retireObsoleteCards()`); more cards need wiring up
  - I need a card which gives engineering research. Or possibly, building a facility could give an engineeering boost?
- **Events:**
  - Option to collapse an event panel to just its title, useful for timed events that are available for several turns
  - Bloc partnership events need to be clearer on the costs and benefits
  - The solar storm event is countered by political will. Which is a weird choice.
  - Limit to only one diplomatic event active at any time?
- **Research:**
  - What to do once all the tech for an era has been researched?
  - Each Era should have a tier 5 technology that represents the end of the era.
  - The game is based around the idea that the player cannot choose the next technology to research, but perhaps they could initiate a project to focus on a tech that is near completion, with a percentage chance of success.
- **Climate:**
  - Irradiated damage shouldn't exist without nuclear facilities
- **The Signal:**
  - Some events conflict and cannot appear at the same time (e.g. signal interference / signal breakthrough)
  - Move the wormhole response panel into a dedicated tab, then later replace the panel with the signal minigames.
- **Political Will:**
  - What is the difference between Global Will and Political Will?
  - Political Will is too easy to gain and too hard to spend (same as Materials)
  - Maybe a better name is Influence?
  - For how long should the player be allowed to stay in debt? A lose condition? But very hard to recover from a debt spiral.
- **Era Gates**
  - See `planning/DESIGN_ERA_TRANSITIONS.md` for design discussion.
  - Era 1→2 gate: Permanent Orbital Station (multi-stage landmark project), guided by Board proposal event triggered on Orbital Mechanics tech discovery. Orbital Telescope Array as a smaller warm-up Scientific Project.
  - Era 2→3 gate: Lunar Base Establishment or Deep Space Transit (TBD).
- **The Signal**
  - Signal mini-games and especially at the end with the Wormhole
  - Progress seems to jump from 33% to about 65% when the first signal tech is unlocked.
- **Projects**
  - Projects need to be visible on the Maps
  - The Facilities that support projects (space launch centre) need to be visually distinct
  - Once the orbital station has been built, we don't need the project programme panel any more
- **Competitor blocs**
  - First implementation in `planning/PLAN_PHASE28.md`
  - The middle-east bloc always collapses in every game; a bit racist.
- **Earth map**
  - Some maps are too restrictive as they don't have sufficient tiles of various types, especially urban tiles. Need a way to create more urban tiles (which is realistic anyway)
  - There's special logic to animate the building of the Orbital Station stages on the map. This should be generalised to support any multi-stage landmark.
  - The proposal to build the space launch centre costs money and time, but there's no subsequent prompt to actually build the thing
- **Earth era content pass**
  - More playtesting required; Computing and physics remain a problem
- **Near Earth/LEO Map**
  - Need more facilities to build (only Deep Space Relay & Orbital Solar Array exist)
  - Nodes can only have one facility type, which means it's not possible to build a lot of the facilities that exist. And no way to demolish facilities. Or even to know what the alternatives are.
    - The moon especially - doesn't make since to restrict it to one
- **LEO era content pass**
- **Asteroid era content pass**
  - Map improvement actions such as reforestation, radiation cleanup, floating cities
- **Game art:**
  - Low poly or pixel art, clear colour coding (e.g. mines will be brown, research facilities blue, funding generators yellow )
  - Show building icons on hex map?
  - Generic profile pictures for board members
  - Flavour text for board members
- **Tech tree dependencies:**
- **News feed & ticker rework**
  - The ticker is cute but not very useful
- **Debug view and logs:**
  - Write the full news feed log to a file, plus information about resources and science fields each turn, to aid with debugging
- **Game menu:**
- **Steering Committee (formerly Board):**
  - See `planning/DESIGN_STEERING_COMMITTEE.md` for full design discussion.
- **Climate management:**
  - This is not fleshed out at all
  - Postponed phase 20.2 on climate pressure scaling event severity
  - Events frequency may be affected by the current Climate or Global Will scores
  - Events may impact a specific map tile or a specific facility - disabling, destroying, or boosting the facility for the duration
  - It should not really be possible to lose the game by climate disaster in the Earth era, unless you try really really hard
  - Player should get a list of the biggest polluters
  - Terrain restoration actions should probably be gated by current climate damage %
  - The Space Launch Centre can be destroyed by climate damage, and it's possible to get into a situation where it cannot be rebuilt anywhere. Either the space launch centre needs to be immune to climate damage, or it needs to be more flexible in its placement.
- **Next Turn / Phase Control**
- **Architecture Review**
  - Review project structure, architecture, security, code duplication, etc
- **Game management**
  - Continue game after winning
  - DEV mode: start in a different Era (era unlocked, technologies for previous eras unlocked, but no facilities built)

## BUGS:

- Need a full review of the terrain manipulation actions. An entire phase required to fix this. Also a review of the tech tree.


## FACILITY IDEAS:

Era 1:

- Petrochemical Refinery (+funding, +climate) or Oil wells
- ~~Observatory (+physics, +computing, -funding) on Highland tiles only~~ ✅ implemented
- **Observatory signal bonus:** Once `spaceImaging` is discovered, the Observatory should also contribute Signal research each turn. Requires engine support for tech-conditional facility output (no such mechanism exists in `FacilityDef` yet — `fieldOutput` is static).

Era 2:


Era 3: