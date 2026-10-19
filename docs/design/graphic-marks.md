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

Built as `Podium`, at the head of the race page's classification card: the top three on
stepped blocks in 2-1-3 order, each with its large car, badge, flag, name and team.

- DECIDED: the table below still lists the top three. The gap and points share a line.
- DECIDED: the race page only, which exists only once its race is revealed; a round opened
  from the calendar keeps its whole table.
- PROPOSED: fewer than three classified finishers draws only the blocks that have a driver.
- OPEN: phone width. Built as three columns with the large car shrunk to two thirds and
  names wrapping; the author is to judge it.
