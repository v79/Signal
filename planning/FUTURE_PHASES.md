# Future Phases - NOT ready to be implemented

This is a list of future requirements for the game but they are not to be implemented until a specific plan is created. This list is not ordered.

- UI rework:
  - Visual flare/animation/effect when the player takes actions such as building a facility, playing a card etc
- Standing actions need fleshing out with an updated UI:
  - Actions may take multiple turns to complete
  - Smaller, multi-row panel for standing actions
- Card rework:
  - More cards, gated by technologies and eras
  - Animate reshuffle of cards at the start of each turn (clearer that new cards have been dealt)
  - A better bank, shown to the side of the cards
- LEO technology content pass
- Asteriod era technology content pass
- Game art:
  - Low poly or pixel art, clear colour coding (e.g. mines will be brown, research facilities blue, funding generators yellow )
  - Show building icons on hex map
  - Generic profile pictures for board members
  - Flavour text for board members
- Tech tree dependencies
  - Most technologies will have prerequisite technologies that must be researched first
  - Draw connecting lines between discovered technologies and progressing technologies
  - Clicking on a discovered or in progress technology in the tech tree should show more information
  - When a technology is researched, a narrative popup should be shown on the main game screen
  - Unlocked technologies may provide a passive resource gain (but may not, and may be restricted to the current era)
  - The Discovered/In Progress/Rumoured/Unknown legend at the bottom should be part of the HTML modal and not the Phaser canvas
- Interface for narrative story elements
  - Opening sequence to set the scene
  - Era transitions
  - Major landmarks
  - Special events
  - Win/lose events
  - Modal User interface to show story text with optional images. Next button to progress through the story text. Close/skip button.
  - Support for narrative choices - up to 3 options that will trigger in-game actions
- News feed & ticker rework
  - The ticker is cute but not very functional
  - The news feed does not have enough space on smaller screens
- Debug view and logs
  - Write the full news feed log to a file, plus information about resources and science fields each turn, to aid with debugging
