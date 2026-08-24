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
  reaches it through `useEntryName()` — see the context note in `web-app.md`. Teams are
  still **sorted on the plain team name**, so a team does not move down the page for
  changing supplier.
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
  share the table itself. The control is the **name**, with the calendar's `▶` chevron
  and `aria-expanded`, rather than a separate button: one action does not deserve two
  tab stops. The chevron is a text glyph, not an SVG, because a test counts one flag
  per row by counting `<svg>`.
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
