---
paths:
  - "apps/web/src/lib/highlight.ts"
  - "apps/web/src/lib/results.ts"
  - "apps/web/src/components/QualifyingResults.tsx"
  - "apps/web/src/components/RaceClassification.tsx"
  - "apps/web/src/components/SeasonView.tsx"
  - "apps/web/src/components/SeasonStandings.tsx"
  - "apps/web/src/components/StandingsTable.tsx"
  - "apps/web/src/components/RaceByRace.tsx"
  - "apps/web/src/components/DisclosureButton.tsx"
  - "apps/web/src/components/CompactStandings.tsx"
  - "apps/web/src/components/TitleBanner.tsx"
---

# Web app — display rules

How the reveal is drawn: the sessions, their tables and the accent that runs through
them.

## The accent

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

## The sessions

- **Qualifying is drawn as a starting grid**, not a table: two columns, odd left, even
  right, the right column set back half a row. Rows are a fixed height and even slots
  shift by exactly half of it via `translate-y`, which moves them visually without
  changing layout height — so car N sits at `(N − 1) × step / 2` and P1→P2 spacing
  equals P2→P3. **A margin would grow the row it sits in and bunch each pair
  together.** Two numbers control this and must stay in that 2:1 ratio; a test parses
  both out of the markup and fails if they drift. Below `sm` the stagger drops to one
  column. Cars outside the cut are listed apart — they never form up, and slotting
  them in would put the wrong drivers on the wrong side.
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
  breakdown belongs to the season page — after one round it is all zeroes.
- **Actions live in a sticky header, repeated at the foot**, and every stage change
  scrolls to the top — otherwise stepping on from a race means scrolling past two
  28-row tables, then landing mid-page in the next session.

## The standings' expandable rows

**Every row of the season page's championship tables opens into its own season.**
`StandingsTable` owns the toggle and `RaceByRace` draws the panel, so the drivers' and
constructors' tables get the expansion from one place — the same reason they share the
table itself. The **pair** of them is `SeasonStandings`, which the era's roll of honour
opens a year into as well: one answer to "the championship, as this app draws it", rather
than a copy per screen. The control is the **chevron**, the shared `DisclosureButton`
drawn alone with a `label`, because the name beside it opens the career panel — the
two-control row in `.claude/rules/web-careers.md`. One component for it, because the
calendar and the roll of honour open the same way and three copies of the markup drifted.
The chevron is a text glyph, not an SVG, because a test counts one flag per row by
counting `<svg>`. For the same reason **the page icon** (`PageLink`, the one way from a
name or a year to its page) is drawn by the stylesheet as a mask over `currentColor`
(`.page-link-icon` in `index.css`), not as markup. It sits beside the chevron, never
inside it: a link cannot go inside a button.

A driver's panel is a row per round; **a team's is a row per _car_** — one, two or three
of them — with the round columns written once and blanked on the cars beneath, so a
three-car round does not read as three races. Those cars are ordered by **where their
drivers finished the championship, not that race**: race order sounds obvious and reads
badly, because the same two names swap places round after round and a reader following
one of them has to find the name again every line. Rounds a competitor did not enter are
**left out rather than shown as blanks**, which keeps the gap visible in the round numbers
once the market can sign a driver mid-season. Both come from `lib/results.ts`, which walks
the same result rows the standings do — a test asserts the panel's points add up to the
total on the row above it, since two walks over one set of results have no excuse to
disagree.

**Each round's name carries the page icon to its race** (`useRacePage`, given a `year`),
once per round and in a one-year run too: every round listed is one the gate revealed.

**The status column speaks only when something went wrong.** A season is mostly finishes,
and a column reading "Finished" fourteen times says nothing the position beside it has
not; retirements, their cause, and non-qualifications are what a reader opens the panel
for. The full classification still labels every car, because there a finish is one row
among twenty-eight rather than the whole page.

The panel is **deliberately unaccented**: `lib/highlight.ts` means "won the thing on
screen", and a season with five wins in it would put five of them on a page whose accent
is the champion. A win is marked by weight. A retirement's status is `text-loss`, the red
of something gone wrong, never the accent (`web-styling.md`).
