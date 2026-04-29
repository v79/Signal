# Plan Phase 39 – New Start Experience

## Problem Statement

Playtesting has shown that new players don't always know what to do at the start of the game. And even experienced players miss or forget some options, especially when new facilities are unlocked. Players also often forget to populate the standing committee/board. When moving between Eras, there's little indication that a new map has been opened up, other than the removal of the little padlock icon. When the major Era transition projects become available (like the spaceLaunchCentre), an event is triggered. However, this does not build the corresponding facility, which means it's often forgotten until the player realises they have reached a stalemate point without it.

## Suggestions

- At the start of the game, each bloc's map should be populated with at least three existing facilities
  - Likely a science facility (research lab, observatory, university)
  - An income generator (coal power station, coastal port)
  - A resource mine
- Different blocs will likely have different starting facility combinations?
- A '?' Help button for each tab (earth, nearSpace, board, blocs, projects, others to follow) with more detailed guidance on how to play this part of the game
  - The '?' should likely be in the top right corner of each tab panel

### spaceLaunchCentre placement

- When the player is presented with the spaceLaunchCentre project, they should be prompted to place it on the map. The usual placement rules will apply.
- This process should be generalised for all 'infrastructure' projects (such as cern)
- If the player does not place the spaceLaunchCentre on the map, this should be treated as a defer action, to be returned to after three turns (or whatever the default number of turns is)
  - Add this general process to the GDD documentation


## Toasts

- Introduce a new non-blocking toast component to display messages to the player
- The toast component should be configured to permanent (until dismissed) or to auto-dismiss after a number of turns
- Toasts should be reserved for events that unlock new player capability or require attention, never for ambient world activity: new facility type unlocked, board seat opened, tile destroyed, project becomes available
- Toasts should have a Title, a single line of text, and a glyph representing the type of message. Toasts should also have a coloured border based on the type of message.
- Toasts should be able to be dismissed by the player
- Toasts may contain an optional link that will take the player to the relevant tab panel (earth, nearSpace, asteroid belt, blocs, board, projects, others to follow)

### Research log

- We need to remove the research log from the right hand column. It repeats information that is already available in the news ticker component and the space could be better used.
- The 'showing promise' section must remain, as this provides actionable information for the player (namely, which science fields are progressing current technologies and which are holding them back)
- 