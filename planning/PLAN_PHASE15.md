# Phase 15 - Bloc and map reset

**DRAFT PLAN** - review and rewrite this as a comprehensive implementation plan.

## Changes required

- The hex grid map must reflect the real-world maps for each bloc, as stylised hex maps
- Each bloc must have a fixed HQ facility in an urban area at game start. The HQ will provide a trickle of FUNDING and WILL by default. In Authoritarian blocs, this may also provide a trickle of MATERIALS; for Democratic blocs it will provide a trickle of Society and Computing research.
- Hovering over a hex should show a preview of the existing facilities on that grid, and a summary of the resources it generates and costs each turn
- Clicking on a hex with a facility should offer the option to delete the facility
- Building and deleting facilities may take a number of turns, with more complex/expensive facilities taking longer to build.
- An "ongoing actions" UI element showing the progress of facility construction/deconstruction, and later for standing actions