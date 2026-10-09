---
paths:
  - "apps/web/src/lib/car-sprites.ts"
  - "apps/web/src/lib/car-sprites.test.ts"
  - "apps/web/src/components/TeamCar.tsx"
  - "apps/web/src/components/team-car.test.tsx"
  - "apps/web/src/lib/parade.ts"
  - "apps/web/src/lib/parade.test.ts"
  - "apps/web/src/components/HomeParade.tsx"
  - "apps/web/src/components/home-parade.test.tsx"
---

# Web app — the team car

A pixel-art car in a team's livery, one sprite per decade (1950s–2020s), chosen by
`carSpriteFor(year)`. Outside that range it falls back to the nearest decade, and
outside a season it uses the newest.

## Where it appears, and at what size

| Place | Size | Wheels |
|---|---|---|
| Both champion cards (season summary) | `large`, 3× | turning |
| The home screen's parade, behind the menu | `large`, 3× | turning |
| Every qualifying slot, from `sm` | `small`, 1× | still |
| Every race-sheet row, on the race screen and in a round opened from the calendar, from `md` | `small`, 1× | still |
| Every row of both championship tables on the season summary, from `sm` | `small`, 1× | still |
| The team panel on the grid and the grid editor, in place of the founding year | `small`, 1× | still |

**There are exactly two sizes, both whole multiples of the sprite** (`CAR_SIZES`), so
the pixels stay square and a car is the same size everywhere except the champion cards
and the parade. To make a car smaller or shorter, redraw it on a smaller canvas; don't
scale it. **Only the champion cards and the parade animate** (`animated`, off by
default). The race sheet and `SeasonStandings` take a `car` prop, off by default, so
each call site has to ask. The cars do **not** follow the badge's "nothing opened by a
click" rule: a round opened from the calendar draws them (the author's call), while the
roll of honour's tables do not.
The cars are hidden on narrow screens, where the name needs the space more.

**A car lines up with the others in its list.** In the race sheet and both standings
tables it has **a column of its own** (`CAR_COLUMN`), straight after the names: a table
sizes a column to its widest cell, so every car starts just past the longest name in
that table, whatever the season. A fixed width in the name cell was tried and a long
team name pushed its car out of line. The car column takes the spare width (`w-full`)
so the cars stay near the names, and the race sheet's names stop wrapping once it shows.
A test holds each car to a cell with no text in it. A qualifying slot is not a table:
its time has a fixed width (`w-[9ch]`) so that "pole" does not move that slot's car.

`TeamCar` reads the `Liveries` context for the colours and the year. `LiveryCar` takes
both directly, for `SeasonGrid`, which resolves liveries from its own year (the same
split as `TeamBadge`/`LiveryBadge`). The team panel is `w-80`, a little wider than a
driver's, because its header carries the car beside the name.

## Sprites are text

`lib/car-sprites.ts` holds each car as 14 strings of 48 characters, one character per
pixel. **A character names a role, not a colour** (`P` primary, `1`/`2` stripes, `h`
helmet, `o` outline and tyres; the full list is on `PixelRole`), so one drawing serves
every team. To redraw a car, edit its strings. The tests hold every sprite to the shared
canvas and the alphabet, keep every wheel on the ground row, and require one sprite per
decade in `SEASON_DECADES`. None of them checks what a car looks like.

**Wheels are not in the drawing.** `wheelRows` generates them from a size, a rim radius
and a rim material, and they are drawn over the body. Sizes are odd so the hub is one
pixel to turn about.

## Colour

The stripes follow the badge's rule: `1` and `2` take the accents only as far as
`badgeStripes` allows, and otherwise fall back to the primary, so a car never shows an
accent that its badge hides. The helmet always wears the first accent.

**The livery is drawn as authored**, as the badge and the grid card's corner are, not
pulled toward the theme as a chart's line is (`web-liveries.md`). It is a picture of a car, and a near-black outline, the same colour
in both themes, is what keeps a white car visible on the light theme and a black one
visible on the dark card.

## Drawing and motion

- It is an **inline SVG with one `<path>` per role**, built from runs of same-role
  pixels, with `crispEdges`. Fills go through `style`, because the shade is a
  `color-mix()` and an SVG `fill` attribute does not accept one.
- **Tests that count flags by counting `<svg>` must leave cars out.** They count with
  `svgsBesideCars` (`test-support.ts`), which recognises a car by its canvas. Folding cars
  into a count of flags would hide a missing flag behind an extra car.
- **On the champion cards it is parked in the bottom-right corner**: beside the words
  from `lg`, beneath them below that. The two cards stretch to one height, so each
  header fills its card and the car goes to the bottom, which lines the two cars up
  whatever the words above them do. The header's bottom rule is dropped (`border-b-0`,
  tested): with no body under it, it floated across the middle of the shorter card.
- **The wheels turn a quarter turn per step** (`--animate-wheel` in `index.css`,
  `steps(4)`). A quarter turn maps every pixel exactly onto another, and a smooth spin
  would blur them. A test requires every wheel to look the same after a quarter turn
  apart from its one spoke, which is what the eye follows. The animation is
  `motion-safe:`, so it stops for a reader who asks for reduced motion.

## The home screen's parade

Every `PASS_INTERVAL_MS` (the first after `FIRST_PASS_MS`), `HomeParade` sends
`PARADE_SIZE` cars across the home screen, left to right. Constants and picking are
`lib/parade.ts`; nothing in it touches the world, so it uses `Math.random()`, passed in.

- **Any team in any authored season**, drawn uniformly over every entry, in that season's
  livery (`liveryFor`) and decade's sprite. **Every car a different team**: a repeat moves
  the draw on to the next entry, so it ends for any random source.
- **Two formations, drawn per pass** (`FORMATIONS`): single file in one lane, or
  staggered across three. The author likes both, and the switching between them.
- **A speed, not a duration**: a car's time across is the window's width over
  `DRIVE_SPEED_PX_PER_S`, so the gaps are the same on a phone and a wide screen.
- **Behind the page where it can be seen, in front where it can't.** When a pass sets
  off, `HomeParade` measures every element marked `PARADE_COVER` (the mode cards, the
  resume card or its notice, the top nav), and `openLanes` keeps the lanes where every
  car of the formation has at least `MIN_VISIBLE_SHARE` of the window's width clear of
  them. One of those is drawn if there is one. A desktop's card rows qualify through the
  open sides; a phone's don't, so there it is the heading or the strip above the footer.
  With none in view (a phone scrolled into the cards), the pass runs **in front**, in
  the `FRONT_LANE_*` band. A new opaque surface on the home screen needs the mark.
- **Behind** is a fixed layer at the texture's own `z-index: -1`, later in the document,
  so it paints over the texture and under all content. **In front** is `z-30`: over the
  content, under the dialogs (`z-50`). The layer never takes a click.
- **A hidden game** (`ParadeGame`, `nextGame`), an experiment: a pointer on a car shows
  a tooltip of each car's `teamName` and year (`paradeLabel`), following the pointer; a
  press on a car stops the whole pass, wheels too, and pins it where pressed; the
  release flips the cars and turns them round, every time, until they leave by either
  side. A cancelled press resumes without turning; a new
  pass starts over. `Parade` watches the window, not the layer, checking the pointer
  every frame (cars move under a still one), and **the page wins the pointer**: a
  cover, anything clickable or with a role, any text under it, or an open dialog
  (`claimedByPage`). The drive stays the CSS animation, paused, played and turned
  (`reverse()`) through `getAnimations()` from where it is; the flip is on a wrapper
  inside the moving element. The pass ends on every drive's `finished`. Pointer behaviour needs a real
  browser; the tests reach the state machine, the hit test and the label.
- The drive is `--animate-drive` in `index.css`, `motion-safe:`, and the layer is
  `motion-reduce:hidden`. A pass is skipped while the tab is hidden and never overlaps
  the one before. `pnpm screenshots` runs with reduced motion, so it never shows one.
