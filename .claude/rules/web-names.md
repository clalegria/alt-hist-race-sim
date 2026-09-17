---
paths:
  - "apps/web/src/lib/names.ts"
  - "apps/web/src/components/DriverName.tsx"
  - "apps/web/src/components/TeamName.tsx"
  - "apps/web/src/components/FittedName.tsx"
  - "apps/web/src/components/EntryNames.tsx"
  - "apps/web/src/components/CompactStandings.tsx"
  - "apps/web/src/components/Flag.tsx"
---

# Web app — naming a driver, a team and an entry

Every table in the app names the same people, so the rules live in one place and every
table reaches them through `DriverName` / `TeamName`. Which *era's* name a team is in is
`.claude/rules/team-eras.md`; the tables themselves are `.claude/rules/web-display.md`.

**A team is named as an entry: "Williams-Ford".** The hyphen says who *supplied* the
engine, so a works team keeps its bare name — Renault building its own is not a
"Renault-Renault", and neither is Ferrari. Compared on the names, not the ids: the same
manufacturer can be a team in one season and only a supplier in another. `entryName` in
`lib/names.ts` owns the rule. Teams are still **sorted on the plain team name**, so a
team does not move down the page for changing supplier.

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

## A driver's name shortens before it is cut

Where the room runs out the name becomes "M. Schumacher" and only then "M. Schum…",
because an ellipsis eats the surname — the half that identifies the driver — while
initials eat the half a reader supplies themselves. `shortName` in `lib/names.ts` is the
pure rule (the surname starts at the first lowercase particle, or at the last word;
suffixes stay put; every given name is initialised, so "J.M. Fangio"), and `FittedName`
measures the fit against an invisible probe carrying the full name — the visible text
cannot answer it, since once shortened it fits by definition.

**The first measurement is not trusted on its own**: it runs before Archivo has loaded,
and the font swap moves every text width without moving the layout, so the probe is
observed alongside the box and the fit is taken again on the next frame and on
`document.fonts.ready`. The comparison carries no slack, either — a browser draws the
ellipsis on half a pixel of overflow, and the ellipsis then eats two or three characters.
All three were real: a sweep of column widths in a headless browser left a handful of
rows a run showing a name that was then truncated, and it is why "Alessandro Zanardi"
would shorten or not depending on the page load.

**Its caller must give it the width it may use** (`flex-1`, or a block in a column): the
box's own width *is* the room, so a content-sized box would report the short name's width
and never widen back. That is why the grid's age chip sits at the right of the row rather
than beside the name. Two drivers collapsing onto one short form — both Schumachers do —
is accepted; the full name is the element's `title`. With no DOM the effect never runs
and the full name renders, which is what every static test still sees.

**The provisional standings fit their names to the sidebar; the classification does
not.** Both draw the same `DriverName` / `TeamName`, and `tight` is what separates them.
The sidebar sits beside a race result in a column that cannot grow, so a sixties entry —
"Lola-Coventry Climax", and that decade is full of them — sized the name column until the
card scrolled sideways. Under `tight` the driver shortens to initials, the team line ends
in an ellipsis, and both carry the full text as a `title`. The mechanism is the pair
`w-full max-w-0` on the cell: in an auto-layout table that is the only way a cell claims
the slack *and* refuses to be sized by what is inside it. The full classification is the
opposite deal — its name column takes the slack and **wraps**, which costs a line of
height and loses no letters — so it does not opt in, and the two must not be unified
without deciding which behaviour wins.

## Flags

**Flags** go beside every driver and team everywhere they are named, via the shared
`DriverName` / `TeamName` pair so they cannot end up in some tables and not others.
SVGs from `country-flag-icons`, **all of them**, via `import * as` in
`components/Flag.tsx`. Emoji flags were tried first and **do not render on Windows at
all**. The hand-kept subset that followed was ~240 kB cheaper and made every new
nationality, team base or race country an edit to that file — a manual step that goes
missing — so the whole set is imported and a new country just works. `Flag.test.tsx`
still checks the seed data against it, which now catches a bad code rather than a missing
import.
