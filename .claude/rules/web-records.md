---
paths:
  - "apps/web/src/components/CareerStatistics.tsx"
  - "apps/web/src/lib/records.ts"
---

# Web app — the career statistics

The bottom half of the era's champions screen. The screen itself, the run it reads and
the roll of honour above it are `.claude/rules/web-era.md`. The display conventions every
table here follows are next door: the accent in `.claude/rules/web-display.md`, the badges
in `.claude/rules/web-liveries.md`, and how a name is fitted to a column in
`.claude/rules/web-names.md`.

Under the roll of honour, the same seasons read down the other axis: the roll says who
won each year, this says **who won the era**. Eight cards — championships, race wins,
podiums, poles — once for drivers and once for teams, two by two above a phone.

`lib/records.ts` derives them, and derives them **on render**: no counter is kept as the
run goes, which is the project's rule and also what keeps a loaded save adding up to
what it did before. Drivers and teams are one tally keyed differently, off
`championshipStandings` and `constructorStandings`, so the two lists cannot drift apart
— and **the champion of a season is the first row of its table**, the same thing
`lib/era.ts` reads, rather than a second derivation that could disagree with the roll of
honour above it.

`rankBy(records, metric)` is the card's order and is a pure rule, unit-tested against
synthetic careers. Three things it settles: **a zero is left out rather than listed** (a
record book is not a championship table, and a long era has hundreds of drivers who
never took a pole); **equal figures share a position** and the next row skips, printed
`=2`, with the rest of the cabinet — titles, wins, podiums, poles, then points — deciding
only which of them is printed first; and the order is **total**, ending on the id, so a
card never depends on the sort implementation or on the order the seasons were walked in.

**A driver is named alone — no team, and no badge.** A career total is the whole of a
driver's era and most of them drove for several teams in it, so labelling the row with
the last one attributes a decade of somebody else's cars to whoever was running them at
the end. `TEAM_LINE`, exported from `DriverName.tsx` beside `BADGE_SHAPE`, is how the
test asks whether the second line was drawn at all.

**A team is named as of the last season it appears in** — `lastYear` on the record. Its
name and its livery are eras, so a row spanning 1980 to 1994 has to be labelled as of
*some* year, and the one the reader has most recently seen it under is the least
surprising; that is a `Liveries` provider per row, as the roll of honour does per season.
There is deliberately **no `EntryNames`**: "Williams-Ford" names an entry and an entry is
a season, so a career that crossed three engine deals shows the plain team name.

## A lineage is one row that opens into its names

The other half of that: `tyrrell` won as Tyrrell, as BAR, as Brawn and as Mercedes, and
one row reading "Mercedes, 100 wins" is both the right total and a claim about a name
that did not exist for most of it. So a career carries **spells** — `CareerSpell`, one
per name, with the years and the same six figures — and the row opens into them, biggest
first.

Five rules, all in `lib/records.ts`:

- **A spell is a name the row was shown under**, so `careerRecords` names a team through
  its `teamNameOf`: history's by default, or the run's kept names, under which a lineage
  has one spell.
- **One spell per name, not per stretch.** `march` raced as March, then as Leyton House,
  then as March again, and that is *one* March: a name taken back is the same name, and
  two rows of it in one card is a split nobody reading a record book wants. The
  interruption is not lost — `segments` keeps the stretches, so the breakdown says
  "1970–1989, 1992–1996" rather than claiming years that belong to another row of the
  same expansion. `spellSpan` writes the segments; `spellRange` writes the same years end
  to end, which is what a *label* uses, where the job is telling two teams apart rather
  than being exact about the middle of one career. The tally therefore walks the seasons
  in **year order** and tracks which spell last season belonged to, since that is what a
  segment continues.
- **A row is named by the spell that won the most of the thing counted**, via
  `bestSpellBy` — not by the lineage's current name, which answers a different question.
  Eighty wins as Mercedes put the row at the top of a wins card as Mercedes; three titles
  taken as Tyrrell put the same lineage on the championships card as Tyrrell, whatever is
  painted on the garage today. The component never receives a name string: `labelsFor`
  returns a **year**, the row hands it to `Liveries`, and `TeamName` resolves both the
  name and the livery off it — one source for both.
- **That year is the last season the figure was actually *scored* in**, not the last
  season under the name — `scored` on the spell, one year per metric, set only by a
  season that moved that figure. The colours of a record are the colours it was won in:
  `toleman` raced as Renault from 2002 to 2011 and again from 2016 to 2020, and took its
  title in the middle of the first stretch, so a championships row drawn as of 2020 wears
  the livery of years it won nothing. The name is unaffected — the year stays inside the
  spell, so it resolves to the same name either way — and a spell that never scored the
  metric falls back to its own end, which no card shows anyway.
- **A name a second lineage ever held carries its years.** There are two Mercedes, two
  Renaults, two Hondas, two Aston Martins and three Lotuses in the seed data, and a row
  reading just "Mercedes" is ambiguous **whether or not the other one is on the same
  card**: the reader cannot tell which lineage it is by looking at it, and the other one
  existing is what makes the question live. So the test is against the *database* —
  `isSharedTeamName` in `lib/names.ts`, a set built once at module load from every
  identity era, so a lineage renaming itself into a collision is caught by authoring the
  season rather than by anyone remembering this rule. `labelsFor` takes it as a
  predicate and reads no seed data itself, which is what keeps its own tests synthetic.
  Not applied to drivers: two people sharing a name is a coincidence, not two eras of one
  organisation, and neither of them is "the 1954-55 one".
- **`spellsBy(record, metric)` drops the spells that contributed nothing**, for the same
  reason a card drops a career on zero: "as BAR, 0" is not a record. What is left still
  adds up to the row above it, and a lineage with one scoring name comes back as a single
  spell — which is how the row knows there is nothing to open.

**The shut row says it is an aggregate, twice**: the chevron the rest of the app uses for
a row that opens, and a muted line under the name reading "under 4 names", counting the
spells actually shown. The chevron alone does not say what is behind it; the count alone
would not be a control.

`RecordRow` is therefore **controlled**, like `ChampionRow`: the open rows live in
`RecordCard`, so both states render without a DOM and without a click. More than one may
be open at once — a spell list is three short rows, not two championship tables — which
is why the card holds a set rather than one id. The card's own `Show all` stays
uncontrolled and is only ever tested shut.

**A row's name now opens the career panel** — every season of that driver or lineage,
in `.claude/rules/web-careers.md`. On a lineage row that also expands, the chevron and
the name are therefore **two controls**: a name that opens a panel is already a button,
and the breakdown by name could not stay inside it. Read that file before touching the
name cell; `aria-expanded` alone no longer distinguishes the two, since Radix marks its
popover trigger with it as well.

The cut is at ten, opened by the shared `ShowAllButton` — extracted from
`CompactStandings`, which had the same footer button down to the class string.
