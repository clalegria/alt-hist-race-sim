# Graphic marks

A new drawn element, chosen from a longer brainstorm, in the timing-tower look
(`docs/style/timing-tower.md`). **The mockup is `docs/design/graphics-mockup.html`**: open it
in a browser. Its section 7 is this design; 4 (title stars) is built as `TitleCount` and 5
as `LiveryBarcode`; 1, 2, 3 and 8 (gap bars, places gained, form strip, pit board) were not
chosen and stay in it only as drawn examples.

- DECIDED: **no new hue and no new voice.** Teal means "won the thing on screen" and is the
  only colour a mark adds; team colours go through `legible()`.
- DECIDED: **every figure is derived on read** from result rows (`CLAUDE.md`), never kept.

## Podium

On the race page heading, above the classification: the top three on stepped blocks in
2-1-3 order, each with its large car, flag, surname and team.

- DECIDED: the blocks are the position block grown. The winner's is filled teal, second and
  third have a teal number on the band colour.
- DECIDED: the classification table below is unchanged.
- PROPOSED: fewer than three classified finishers draws only the blocks that have a driver.
- OPEN: phone width, where three steps with large cars do not fit (*Phone layout* settles it).
- OPEN: a race in progress or not yet run shows no podium.
