# Graphic marks

Two new drawn elements, chosen from a longer brainstorm, each in the timing-tower look
(`docs/style/timing-tower.md`). **The mockup is `docs/design/graphics-mockup.html`**: open it
in a browser. Its sections 5 and 7 are this design; 4 (title stars) is built as
`TitleCount`; 1, 2, 3 and 8 (gap bars, places gained, form strip, pit board) were not
chosen and stay in it only as drawn examples.

- DECIDED: **no new hue and no new voice.** Teal means "won the thing on screen" and is the
  only colour a mark adds; team colours go through `legible()`.
- DECIDED: **every figure is derived on read** from result rows (`CLAUDE.md`), never kept.

## Livery barcode

On the team page heading, under the three cars: one stripe per season over the team's whole
life, the primary colour over the first accent, read through `liveryFor()`.

- DECIDED: a stripe's hover names its year; decade ticks sit beneath.
- DECIDED: a teal caret marks the season on screen.
- PROPOSED: in a run the strip ends at the run's current season, so it never shows colours
  the run has not reached.
- OPEN: phone width. 60-odd stripes fit, but the tick labels need thinning.

## Podium

On the race page heading, above the classification: the top three on stepped blocks in
2-1-3 order, each with its large car, flag, surname and team.

- DECIDED: the blocks are the position block grown. The winner's is filled teal, second and
  third have a teal number on the band colour.
- DECIDED: the classification table below is unchanged.
- PROPOSED: fewer than three classified finishers draws only the blocks that have a driver.
- OPEN: phone width, where three steps with large cars do not fit (*Phone layout* settles it).
- OPEN: a race in progress or not yet run shows no podium.
