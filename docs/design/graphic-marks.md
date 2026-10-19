# Graphic marks

Three new drawn elements, chosen from a longer brainstorm, each in the timing-tower look
(`docs/style/timing-tower.md`). **The mockup is `docs/design/graphics-mockup.html`**: open it
in a browser. Its sections 4, 5 and 7 are this design; 1, 2, 3 and 8 (gap bars, places
gained, form strip, pit board) were not chosen and stay in it only as drawn examples.

- DECIDED: **no new hue and no new voice.** Teal means "won the thing on screen" and is the
  only colour a mark adds; team colours go through `legible()`.
- DECIDED: **every figure is derived on read** from result rows (`CLAUDE.md`), never kept.

## Title stars

A small teal star per championship after a name, on the driver and team page headings and
in the era champions list, where the count builds row by row (★, ★★, ★★★).

- DECIDED: stars count titles up to and including the season on screen.
- OPEN: **the shape.** The mockup draws two: (A) a row of stars, (B) a trophy and `×3`. The
  home mark is already a yellow five-point star (`HomeAdvantage.tsx`); A leans on size and
  hue to stay apart, B avoids the clash. Needs a choice before building.
- OPEN: **drivers' and constructors' titles** both get stars, or only the driver's.
- PROPOSED: before *historical career records* a run counts only titles it has simulated;
  that item adds the opening balance, which the star then includes.

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
