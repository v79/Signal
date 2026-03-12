  # Phase 21 — Research rework
  
  Make field progress visible/legible, expose tech recipes (or at least proximity), lock signal decode to
  Asteroid era. This is the bigger design work.

  The science field progress bars are pretty but don't reflect my intention for the game.


  ## Intended tech tree and research approach:

  - Technologies require a mix of science fields to unlock. Most techs will need between 4 and 6 science fields
    - But some of these requirements may be very low, e.g. integrated circuits need lots of physics, computing, engineering points, and only a couple in society or biochemistry. You can't ignore any science field, but you can choose where to focus. HQ provides a trickle of research in all fields.
    - Era 1/Tier 1 technologies only need 3 fields, unless there's a strong thematic reason for more.
  - The science cost of each technology is slightly randomised between each playthough, within defined ranges [already implemented]
  - Science points for each field are gained each turn from facilities, events, action cards, passive and active bonuses from committee board members
  - Science points do not accummulate from turn to turn
  - Technologies have dependencies, forming a branching research graph/network.
  - Technologies are defined per era
  - Technologies are grouped by tier, with higher tiers having higher research costs
  - At the very start of the game, the Earth Era Tier 1 technologies will all be at Rumour level.
  - Science points are 'spent' each turn:
    - A technology is applicable for research if it:
      - Is at the Rumour stage or the Progress stage in the current Era
    - A technology reaches Rumour stage if:
      - Its prerequisite technologies are in Progress or are Researched
      - OR a breakthrough happens (see below)
    - A technology reaches the In Progress stage if:
      - All its required fields are at least 33% complete OR
      - At least 33% of its required fields are over 50% complete (or some split like this, numbers to be refined)
    - Available points are distributed across all applicable technologies
    - Each technology is guaranteed at least one point of research across all fields (scale this value by tier and era)
    - Then the remaining research points are distributed randomly across the applicable technologies
    - All points will be spent in each turn (if possible)
      - If it's not possible to spend research points because no techs still 'need' them, those points are effectively lost. We will playtest to see the impact of this.
  - Events and Action cards may impact research field progress:
    - Event example: A fire in Research Lab #2 destroyed records - the physics research for technology X has stalled this year and there has been no progress
    - Event example: A research paper shows that the scientists working on technology Y have been barking up the wrong tree. The biochemistry progress for that technology has fallen back [drop current progress by half but ensure this never drops progress to zero]
    - Action example: Animal Research Embargo - All biochemistry research output is cut in half for 3 turns, but gain +5 Will and +2 Society research for 3 turns [need better ideas - must have a strong benefit to harming research progress]
  - When a technology is in the Progress phase, the progress of its various field costs will be visible as progress bars
  - 'Breakthrough' Technologies
    - Some Tier 3 and Tier 4 will be marked as 'Breakthrough' Technologies, which have an alternative unlock/Rumour mechanism
    - A breakthrough technology may be revealed if certain combinations of facilities and science/resource incomes is met at the start of a turn
      - For instance, earning +20 Physics in a turn AND 3 active Computer Labs on the map in a turn could unlock and reveal Computational Modelling early
      - Or earning +15 Mathematics and +10 Social Sciences in a turn could unlock and reveal Game Theory early
    - Only 2 or 3 technologies will be Breakthroughs
    - It is always possible to unlock Breakthroughs through the normal tech tree progress path
    - Breakthroughs can never happen in tier 1 and tier 2
    - When a Breakthrough is unlocked, their should be a newsfeed event
    - In the Tech tree UI, indicate that a Breakthrough has been unlocked through the thresholds if that happens. If the tech is unlocked through the normal tech tree progressing, don't indicate that it is a Breakthrough tech (keeping the 'surprise' element of breakthrough for a future playthrough; no spoilers)
  
  ## The Signal

  The Signal decoding will be handled separately with their own progress/unlock mechanisms, tbc.

## Science progress visualisation

The right-hand column is to focus purely on the Signal, Research, and Technology progress. The Board is to move to a tab in the main gameplay map area.

At the top of the column is the Signal Progress Bar. Later, we will add a popup modal when this is clicked to access the Signal-specific gameplay elements (tbc).

The next row is the more prominant Tech Tree button, with a visual indicator when a new techology becomes Rumoured in this turn.

Below that, we show a summary of the 3 Technologies under most active research (In Progress). (SvelteKit, not a phaser.js tech tree). List each In Progress technology, and show progress bars for each of its sciences. Small, thin progress bars, not the same style as the phaser.js Tech Tree.

In the HUD, colour code the science output text - Physics blue, Mathematics pink, Biochemistry green, etc.

## Tech tree visualisation

A separate project phase to revisit the Tech Tree - the most pressing need is to add and show tech dependencies. This would be done by drawing arrows between the Technology nodes in the tree - I think curving splines rather than straight lines. The lines would go behind techs if there is an overlap. The line would terminate in an arrow.
