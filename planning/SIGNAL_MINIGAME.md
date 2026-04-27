❯ I'd like to introduce a minigame to progress the signal past the current thresholds, which are 33% and 80% I think. Let's come up with
some ideas for a minigame. I am thinking a jigsaw/shape fitting game where the player has to arrange variously shaped pieces
together. The pieces could represent each of the six science fields. If the player hasn't cummulatively researched enough across all
the fields, they would not have all the right pieces (or right shaped- or sized- pieces) to complete the puzzle. The overall shape of
the puzzle would be randomized by the starting game seed. This would be drawn on a phaserJS component. This is just an idea, do not
write code at this stage!

● Like the concept — a jigsaw fits the "assembling a fragmented signal" metaphor cleanly, and the seeded shape gives every run a unique
decode moment. Two design questions worth pinning down before you go further:

Skill challenge or meaningful representation? The GDD principle is that research is never a direct action — by extension, the player
shouldn't fail the minigame because they're bad at puzzles. Cleanest split: research determines which pieces you have and roughly how
well they fit (snap tolerance, edge clarity, hint visibility), but solving it is always tractable. Insufficient research means missing
pieces → an incomplete decode → a partial reward or a worse wormhole-climax option later, not a hard wall.

What does "not enough research" look like on screen? A few options with very different feels:
- Missing pieces — gaps in the final image, visually obvious where you fell short (which fields you neglected). Most legible.
- Wrong-shape pieces — you have a Physics piece but it's jagged where it should be smooth; forces compromises. More tactile but harder
  to read.
- Ghosted/low-contrast pieces — pieces present but hard to distinguish, requiring fiddling. Punishes the player's eyes, which I'd
  avoid.

I'd lean toward missing pieces, with each of the 6 fields contributing N pieces proportional to cumulative investment (so a
high-Physics / low-Biochem run gets a Physics-rich but biochem-shaped-hole result).

One thing to consider as a refinement: rather than a freeform jigsaw, a hex-tile mosaic would echo the Earth map aesthetic and make
seed-driven shape generation trivial (it's just a hex region with field-coloured tiles). Pieces become small hex clusters. Easier to
draw in Phaser, easier to read at a glance, and reinforces visual identity across the three eras.

The 33% and 80% triggers also raise a question: same minigame twice, or escalating? Second pass could use the first pass's solved image
as the "frame" and require fitting an inner layer — visually showing the signal becoming clearer. Worth deciding now since it shapes
the data model.