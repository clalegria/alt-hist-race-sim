---
paths:
  - "apps/web/src/components/**"
---

# Web app — display rules

How the reveal is drawn: the sessions, their tables and the accent that runs through
them. The **grid and its editor** are in `.claude/rules/web-grid.md`, which loads when
you open those files instead. The architecture both sit on — screens, the one store,
the reveal cursor, and how any of this is tested — is in `.claude/rules/web-app.md`,
which loads alongside this file.
- **A team is named as an entry: "Williams-Ford".** The hyphen says who *supplied* the
  engine, so a works team keeps its bare name — Renault building its own is not a
  "Renault-Renault", and neither is Ferrari. Compared on the names, not the ids: the
  same manufacturer can be a team in one season and only a supplier in another.
  `entryName` in `lib/names.ts` owns the rule, and everything downstream of a season
  reaches it through `useEntryName()` — see below. Teams are still **sorted on the plain
  team name**, so a team does not move down the page for changing supplier.
- **A driver's name shortens before it is cut.** Where the room runs out the name
  becomes "M. Schumacher" and only then "M. Schum…", because an ellipsis eats the
  surname — the half that identifies the driver — while initials eat the half a reader
  supplies themselves. `shortName` in `lib/names.ts` is the pure rule (the surname
  starts at the first lowercase particle, or at the last word; suffixes stay put; every
  given name is initialised, so "J.M. Fangio"), and `FittedName` measures the fit
  against an invisible probe carrying the full name — the visible text cannot answer
  it, since once shortened it fits by definition. **The first measurement is not trusted on its own**: it
  runs before Archivo has loaded, and the font swap moves every text width without
  moving the layout, so the probe is observed alongside the box and the fit is taken
  again on the next frame and on `document.fonts.ready`. The comparison carries no
  slack, either — a browser draws the ellipsis on half a pixel of overflow, and the
  ellipsis then eats two or three characters. All three were real: a sweep of column
  widths in a headless browser left a handful of rows a run showing a name that was
  then truncated, and it is why "Alessandro Zanardi" would shorten or not depending on
  the page load. **Its caller must give it the width
  it may use** (`flex-1`, or a block in a column): the box's own width *is* the room,
  so a content-sized box would report the short name's width and never widen back.
  That is why the grid's age chip now sits at the right of the row rather than beside
  the name. Two drivers collapsing onto one short form — both Schumachers do — is
  accepted; the full name is the element's `title`. With no DOM the effect never runs
  and the full name renders, which is what every static test still sees.
- **The provisional standings fit their names to the sidebar; the classification does
  not.** Both draw the same `DriverName` / `TeamName`, and `tight` is what separates
  them. The sidebar sits beside a race result in a column that cannot grow, so a
  sixties entry — "Lola-Coventry Climax", and that decade is full of them — sized the
  name column until the card scrolled sideways. Under `tight` the driver shortens to
  initials, the team line ends in an ellipsis, and both carry the full text as a
  `title`. The mechanism is the pair `w-full max-w-0` on the cell: in an auto-layout
  table that is the only way a cell claims the slack *and* refuses to be sized by what
  is inside it. The full classification is the opposite deal — its name column takes
  the slack and **wraps**, which costs a line of height and loses no letters — so it
  does not opt in, and the two must not be unified without deciding which behaviour
  wins.
- **One accent, defined once in `lib/highlight.ts`**: pole on the grid, the winner of
  a race, each champion on the summary, and the champion's row in the race sidebar
  from the round the arithmetic settles it. The banner announcing a title appears on
  that round *only* — repeating it turns the beat the season built to into a standing
  notice, and the row accent already carries the fact. A test asserts exactly one row
  or card carries the accent per view, since "make it look coherent" is the sort of
  thing that quietly stops being true.
- **Second and third get the same accent at half strength** (`PODIUM_ROW` /
  `PODIUM_TEXT`), and only in the race classification — a front row is not a podium
  and a championship table has no podium at all. The gradient is the design: the
  winner's fill (`bg-primary/10`, stronger than the bordered `STANDOUT_SURFACE`
  because a row has no border to carry the accent), a little under half of it, then
  nothing from fourth down. The two are **separate strings, neither a substring of
  the other**, because the accent tests tell rows apart by substring match —
  `PODIUM_TEXT` does contain `STANDOUT_TEXT`, so anything counting *that* has to
  account for it.
- **Qualifying is drawn as a starting grid**, not a table: two columns, odd left, even
  right, the right column set back half a row. Rows are a fixed height and even slots
  shift by exactly half of it via `translate-y`, which moves them visually without
  changing layout height — so car N sits at `(N − 1) × step / 2` and P1→P2 spacing
  equals P2→P3. **A margin would grow the row it sits in and bunch each pair
  together.** Two numbers control this and must stay in that 2:1 ratio; a test parses
  both out of the markup and fails if they drift. Below `sm` the stagger drops to one
  column. Cars outside the cut are listed apart — they never form up, and slotting
  them in would put the wrong drivers on the wrong side.
- **Every row of the summary's championship tables opens into its own season.**
  `StandingsTable` owns the toggle and `RaceByRace` draws the panel, so the drivers'
  and constructors' tables get the expansion from one place — the same reason they
  share the table itself. The **pair** of them is `SeasonStandings`, which the era's
  roll of honour opens a year into as well: one answer to "the championship, as this
  app draws it", rather than a copy per screen. The control is the **name**, via the
  shared `DisclosureButton` — `▶` chevron, `aria-expanded`, the name itself as the
  button — rather than a separate control: one action does not deserve two tab stops.
  One component for it, because the calendar and the era's roll of honour open the same
  way and three copies of the markup drifted. The chevron is a text glyph, not an SVG,
  because a test counts one flag per row by counting `<svg>`.
  A driver's panel is a row per round; **a team's is a row per _car_** — one, two or
  three of them — with the round columns written once and blanked on the cars beneath,
  so a three-car round does not read as three races. Those cars are ordered by **where
  their drivers finished the championship, not that race**: race order sounds obvious
  and reads badly, because the same two names swap places round after round and a
  reader following one of them has to find the name again every line. Rounds a
  competitor did not enter are **left out rather than shown as blanks**, which keeps the
  gap visible in the round numbers once the market can sign a driver mid-season. Both
  come from `lib/results.ts`, which walks the same result rows the standings do — a test
  asserts the panel's points add up to the total on the row above it, since two walks
  over one set of results have no excuse to disagree.
  **The status column speaks only when something went wrong.** A season is mostly
  finishes, and a column reading "Finished" fourteen times says nothing the position
  beside it has not; retirements, their cause, and non-qualifications are what a reader
  opens the panel for. The full classification still labels every car, because there a
  finish is one row among twenty-eight rather than the whole page.
  The panel is **deliberately unaccented**: `lib/highlight.ts` means "won the thing on
  screen", and a season with five wins in it would put five of them on a page whose
  accent is the champion. A win is marked by weight. Note when asserting this that
  `STANDOUT_TEXT` ("text-primary") is a substring of the `text-primary/80` a retirement's
  status carries, so only the row *fills* can be counted.
- **The classification wraps rather than scrolls.** It shares its row with the
  championship sidebar, so it gets about two thirds of the page — and with every column
  `whitespace-nowrap`, one long engine name ("Williams-Coventry Climax") or one long
  driver ("Heinz-Harald Frentzen") tipped the whole sheet into a horizontal scrollbar.
  The two prose columns wrap; the numeric ones must not, because a gap or a points total
  broken across lines is unreadable. Cell padding is tightened **per cell** rather than
  by a `[&_td]:px-2` variant on the table: the variant worked, but only by out-specifying
  the cell's own padding, so the winner was invisible in the markup and to the reader.
  Passing it through `cn` lets `twMerge` resolve it, which a test checks by asserting no
  `px-3` survives.
- **A race shows its result and the championship side by side**, standings cut to
  position/name/points and the top eight. Movement arrows come from running
  `championshipStandings` over one fewer race and comparing, which costs nothing
  because standings are derived. Round one shows none. Direction rides the glyph as
  well as the colour, with the count in a `title`, so it is not colour-only. The full
  breakdown belongs to the summary — after one round it is all zeroes.
- **Actions live in a sticky header, repeated at the foot**, and every stage change
  scrolls to the top — otherwise stepping on from a race means scrolling past two
  28-row tables, then landing mid-page in the next session.
- **Flags** go beside every driver and team everywhere they are named, via the shared
  `DriverName` / `TeamName` pair so they cannot end up in some tables and not others.
  SVGs from `country-flag-icons`, **all of them**, via `import * as` in
  `components/Flag.tsx`. Emoji flags were tried first and **do not render on Windows
  at all**. The hand-kept subset that followed was ~240 kB cheaper and made every new
  nationality, team base or race country an edit to that file — a manual step that
  goes missing — so the whole set is imported and a new country just works.
  `Flag.test.tsx` still checks the seed data against it, which now catches a bad code
  rather than a missing import.

## Charts

The season summary's **standings evolution charts** are `.claude/rules/web-charts.md`,
which loads on `StandingsEvolution.tsx` and `lib/evolution.ts`. Read it before adding
any chart: it is where Recharts, the axes, and the awkward business of getting a livery
colour into an SVG stroke are settled.

## Team colours

**A livery is four values and a rule about where they come from.** A team carries a
default `primaryColor` / `secondaryColor1` / `secondaryColor2` / `badgeStripes` in
`teams.json`; a season's entry may override all four, never some — `validateSeedData`
rejects a partial override rather than merging one. `lib/livery.ts` is the only place
that rule is applied, so a badge, a card outline and whatever uses colour next cannot
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

**The badge is a CSS gradient on a `span`, never an SVG.** `TeamBadge` draws the
primary colour as a disc with up to two diagonal stripes across it, and the stripes
**butt together with no gap** — one sash split in two, not two marks. One stripe spans
exactly what two would, so a team is not made louder by splitting its sash. The `span`
matters: several tests count the flags in a table by counting `<svg>`, and a vector
badge beside every flag would double that count into what looks like a flag bug. It is
`aria-hidden`, because the team is named in the same row.

**It is scaled and centred to the row, not to the name.** 1.5em and vertically centred
against the whole two-line block — the badge belongs to the entry, driver and team
together, rather than to the line of text it starts beside, so it is deliberately larger
than the flag next to it. The stripes are narrow enough that the primary colour stays
the dominant one; note when tuning that a 135° axis runs about 1.41x the disc'''s
diameter, so a sash reads wider than its percentage suggests.

**It is opted into per call site**, via `badge` on `DriverName` and `TeamName`. It is
worn by the race sheet, the starting grid, both champion boxes, the calendar's poles and
winners, both championship tables on the summary, and the roll of honour.

**Nothing that only appears after a click wears one.** An expansion repeating the screen
the reader just left is noise rather than detail, so a badge marks the row you can see,
not the panel it opens. Two components are used *both* ways and therefore take a `badge`
prop rather than deciding for themselves: `RaceClassification` (the race screen, versus a
round opened out of the calendar) and `StandingsTable` via `SeasonStandings` (the season
summary, versus a year opened out of the roll of honour). Both default to **off**, so a
new call site has to ask.

**Count badges by `BADGE_SHAPE`, never by `aria-hidden`.** The badge is decorative and
hidden, but so are chevrons, layout spacers and the theme toggle — a count of
`aria-hidden` is right only in a tree that happens to contain none of them, which is
exactly how such a test passed while measuring the wrong thing. The exported class string
is the marker, the same way `NAME_TARGET` is in `SeasonGrid`.

The
badge sits in a **column of its own** beside the two text lines rather than inside the
first, so the team line keeps its one fixed inset; an arithmetic indent was tried and
put a literal `+1em` in the class list, which the classification's "no gap on a
retirement" test reads as a gap.

**The grid's card is washed, not ringed**, and is still an experiment rather than a
convention: a diagonal gradient from the team's primary colour back to the plain card
surface, outlined in the first accent. The first attempt — a thick primary border with a
thin accent ring — put raw team colours straight onto the page, and a white outline was
simply invisible on the light theme.

**A team colour never reaches a surface as authored.** Mixing a colour toward a surface
it already matches produces no wash at all: white teams looked ungradiented on the light
theme and near-black ones on the dark theme, both reading as a card that had missed its
background. Every team colour therefore goes through `legible()` — a fixed pull toward
`--color-foreground` — before it is used for anything, the wash included. That is the
same one mechanism the outline uses; there is not a second idea here.

**Do not reach for `oklch(from ...)` to do this.** Clamping the lightness into a band is
more precise, keeps chroma and hue intact, and was tried — but relative colour syntax is
newer than everything else this app relies on, and where it is missing the whole
declaration is invalid and the wash silently disappears. That is indistinguishable from
the bug it was meant to fix, and it shipped that way once. A test asserts the string
contains no `oklch(from`. `color-mix` is the same baseline as the rest of the app.

**Team colours are mixed against theme tokens, never used raw on a surface.** A livery is
authored against a racing car, not against this palette, so any colour in it can collide
with whichever background the reader is on. `cardTint` mixes toward `--color-card` and
`cardOutline` pulls the accent a fixed distance toward `--color-foreground` — by
definition the far end of the live theme from its background — so both follow a
light/dark switch with no JavaScript and no per-theme branch. Keep the mix percentages
off 100%: at full strength the mix is the raw colour again and the guarantee is gone
silently, which is why a test asserts it.

## Naming a team, across every table

**Who is running whose engine travels by context, not by prop.** A result row records a
`teamId` and nothing else, but "Williams-Ford" has to be the same name in the standings,
the classification, the qualifying sheet and the summary or it reads as a bug. Threading
a map through `StandingsTable`, `CompactStandings`, `DriverName`, `QualifyingResults` and
the summary would be six pass-through props deep, so `SeasonView` wraps its body in
`EntryNames` and those components call `useEntryName()`. The map is built from
**`world.field`**, not the seed files — the field is the record of the grid as it was
actually raced. The default is empty, so a component rendered on its own shows plain
team names rather than throwing, which is what keeps every DOM-less test renderable.
`SeasonGrid` deliberately does *not* use the context: it reads the engine off the field
it is handed, which is what lets the editor preview a draft the world has never seen.
