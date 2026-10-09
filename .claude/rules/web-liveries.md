---
paths:
  - "apps/web/src/lib/livery.ts"
  - "apps/web/src/components/TeamBadge.tsx"
  - "apps/web/src/components/Liveries.tsx"
  - "apps/web/src/components/livery.test.tsx"
---

# Web app — team colours

How a livery reaches the page. What a livery *is* and how a team's eras are indexed is
`.claude/rules/team-eras.md`; the rest of the reveal's drawing rules are
`.claude/rules/web-display.md`.

**A livery is four values and a rule about where they come from.** A team carries a
default `primaryColor` / `secondaryColor1` / `secondaryColor2` / `badgeStripes` in
`teams.json`; a season's entry may override all four, never some — `validateSeedData`
rejects a partial override rather than merging one. `lib/livery.ts` is the only place
that rule is applied, so a badge, a card's corner and whatever uses colour next cannot
disagree about what a team looks like in a given year. It sits beside `names.ts` rather
than in `@alt-hist/data` because **nothing in the engine reads a livery** — this is
display, like `entryName` is.

**Which season's colours apply travels by context**, the same way the engine supply
does and for the same reason: a result row knows a `teamId` and not a year. `SeasonView`
wraps its body in `Liveries year={world.year}` and components call `useLivery()`. The
default is "no season", which resolves every team to its default livery — a sensible
answer outside a season, and what keeps every DOM-less test renderable. `SeasonGrid`
again does not use the context: it is handed `seasonYear` and calls `liveryFor`
directly.

## The badge

**It is a CSS gradient on a `span`, never an SVG.** `TeamBadge` draws the primary colour
as a disc with up to two diagonal stripes across it, and the stripes **butt together with
no gap** — one sash split in two, not two marks. One stripe spans exactly what two would,
so a team is not made louder by splitting its sash. The `span` matters: several tests
count the flags in a table by counting `<svg>`, and a vector badge beside every flag
would double that count into what looks like a flag bug. It is `aria-hidden`, because the
team is named in the same row.

**It is scaled and centred to the row, not to the name.** 1.5em by default and vertically
centred against the whole two-line block — the badge belongs to the entry, driver and team
together, rather than to the line of text it starts beside, so it is deliberately larger
than the flag next to it. The stripes are narrow enough that the primary colour stays
the dominant one; note when tuning that a 135° axis runs about 1.41x the disc's
diameter, so a sash reads wider than its percentage suggests.

It sits in a **column of its own** beside the two text lines rather than inside the
first, so the team line keeps its one fixed inset; an arithmetic indent was tried and
put a literal `+1em` in the class list, which the classification's "no gap on a
retirement" test reads as a gap.

**It is opted into per call site**, via `badge` on `DriverName` and `TeamName`. It is
worn by the race sheet, the starting grid, both champion boxes, the calendar's poles and
winners, both championship tables on the summary, the roll of honour, and every team card
on the grid — the season's, the pre-season stage's and the editor's, which are one
`SeasonGrid`.

**A card's badge comes from `LiveryBadge`, not `TeamBadge`.** `SeasonGrid` resolves
liveries from the year it is handed rather than from the `Liveries` context, which is
what lets the editor preview a draft the world has never seen, so it cannot use the
component that reads that context. `LiveryBadge` takes the colours and draws the same
shape. In a card header it is cut to `size-3.5`: there it sits in a line of text beside a
0.75rem flag, and at its row size it would read as the card's subject.

**Nothing that only appears after a click wears one.** An expansion repeating the screen
the reader just left is noise rather than detail, so a badge marks the row you can see,
not the panel it opens. Two components are used *both* ways and therefore take a `badge`
prop rather than deciding for themselves: `RaceClassification` (the race screen, versus a
round opened out of the calendar) and `StandingsTable` via `SeasonStandings` (the season
summary, versus a year opened out of the roll of honour). Both default to **off**, so a
new call site has to ask.

**The one exception is the grid card's own team panel**, by the author's call: its header
repeats flag, badge and name in the card's order, because a name written one way
everywhere else reads as a different component when it loses its marks on opening. That
is the argument for repeating a *mark*, and it does not reopen the rule above — a panel
listing rows for other teams still badges none of them.

**Count badges by `BADGE_SHAPE`, never by `aria-hidden`.** The badge is decorative and
hidden, but so are chevrons, layout spacers and the theme toggle — a count of
`aria-hidden` is right only in a tree that happens to contain none of them, which is
exactly how such a test passed while measuring the wrong thing. The exported class string
is the marker, the same way `NAME_TARGET` is in `SeasonGrid`.

**The size is not part of `BADGE_SHAPE`** — `DEFAULT_SIZE` is applied beside it. Folded
together, a call site that overrode the size through `className` lost the marker to
tailwind-merge's conflict resolution, and every badge count silently stopped seeing it.

## The grid card's corner

**A grid card wears its team's sash in its top-right corner** (`LiveryCorner` in
`TeamBadge.tsx`), over the tile's header band. It is the badge's own rule (`sash`) laid
along a 45° axis, so a corner shows exactly the stripes the badge does. Like the badge
and the car it is **the livery as authored**, a picture of the team's colours rather
than a surface. It is two clipped triangles, 72px on a side: `CORNER_SHAPE` filled in
`--color-border`, the card outline's colour, and inside it `CORNER_SASH`, the same
triangle with its diagonal moved 1.5px in. So a ~1px line of the border colour runs
along the cut, touching the sash; it is what draws the corner when the livery matches
the card. **Not a gradient line**: drawn as a hard stop at the clip edge, the two
anti-alias differently and leave a 1px gap. The overall chip sits over the sash on a
`bg-card` plate ringed in the border colour, since the chip's own fills are tints.
Corners are counted by `CORNER_SHAPE`, as badges are by `BADGE_SHAPE`.

## A team colour drawn as a line goes through `legible()`

A livery is authored against a racing car, not against this palette, so a team colour
drawn as a line on a theme surface (the standings charts) can vanish: white on the light
theme, near-black on the dark. `legible()` pulls it a fixed distance toward
`--color-foreground`, by definition the far end of the live theme from its background, so
it follows a light/dark switch with no JavaScript and no per-theme branch. Keep the mix
off 100%: at full strength it is the raw colour again and the guarantee is gone silently,
which is why a test asserts it.

**Do not reach for `oklch(from ...)` to do this.** Clamping the lightness into a band is
more precise, keeps chroma and hue intact, and was tried — but relative colour syntax is
newer than everything else this app relies on, and where it is missing the whole
declaration is invalid and the colour silently disappears. A test asserts the string
contains no `oklch(from`. `color-mix` is the same baseline as the rest of the app.
