# Layout Redesign Decision

This decision is a modification of Option D with some elements from Option B from the LAYOUT_OPTIONS document.

- Widen the right-hand column
- The Signal Track panel sits above the Research/Board tabs
- Use Tabs for [RESEARCH] and [BOARD]
- Move the Standing Actions into the same column as EventZone
- Keep the Phase Ctrl in the bottom right (it's a very common UI pattern from games such as Civilization). It can be made narrower (button over two lines is OK)
- The CardHand gets a bit more width
- The News Feed becomes a pop-up panel accessed by clicking on the NewsTicker


```
┌───────────────────────────────────────────────────┐ HUD
├───────────┬────────────────────┬──────────────────┤
| EventZone |                    | SignalTrack      |
|           |       Map (1fr)    ┬──────────────────┤
|           |                    | [RESEARCH][BOARD]|
│───────────│                    | tabs             |
| Standing  |                    | (others tabs?)   |
|           |                    |                  |
├───────────┴────────────────────┴──────────────────┤  NewsTicker
├───────────────────────────────────────────────────┤
| CardBank?           CardHand          | PhaseCtrl |
└───────────────────────────────────────────────────┘
```

I have not specified precise widths.
