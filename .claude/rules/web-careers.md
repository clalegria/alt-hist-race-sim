---
paths:
  - "apps/web/src/components/SeasonHistory.tsx"
  - "apps/web/src/lib/history.ts"
  - "apps/web/src/components/history.test.tsx"
---

# Web app — the career panel

The reading of a run that hangs off a *name*. The roll of honour says who won each year
(`.claude/rules/web-era.md`); the career statistics say who won the era
(`.claude/rules/web-records.md`); this says what **one** name did in **every** year of
it. Select a driver or a team anywhere in a run — the champions screen, the standings
and the sidebar, the classification, the calendar's poles and winners, the qualifying
grid, a team's race by race, the people pages — and a panel opens listing their
seasons:

```
1986   Williams                    4th
       55 pts · 4 wins · 7 podiums · 3 poles
```

A team's lines carry its constructors' championship and, under it, who drove for it —
each named with where *they* finished the drivers' table, since a team third overall
says nothing about whether one car scored all of it.

**Same affordance as the grid editor's ratings panel**, deliberately: that screen
already teaches "select a name, get a panel", and a second gesture for the same idea
would be a second thing to learn. `HISTORY_TARGET` is `NAME_TARGET`'s sibling rather
than a reuse of it — the grid's is sized for a full-width button in a card row, these
sit in table cells that are already padded.

## What it is derived from

`lib/history.ts`, on render, off `championshipStandings` and `constructorStandings` —
**results are the source of truth and statistics are derived**, the same rule
`lib/records.ts` follows and the reason a loaded save adds up to what it did before.
Nothing is stored.

**A place is the row's index in the table the engine already ordered.** So first place
on a panel is the same first place the roll of honour crowns, rather than a second
derivation that could disagree with the screen the panel was opened from — a test
asserts they agree. Note this is the *opposite* of what `rankBy` does with the same
figures on a record card: a championship separates equal totals by countback, a record
book lets them share a position.

**A team's lineup comes off the drivers' table, not `world.field`.** The field is who
was *entered*, and a car that never made a round is not part of what the team did that
year. It arrives in championship order for free, which is the order the line wants.

**One walk of the run for every page.** `SeasonHistoryProvider` sits in `RunFrame`
(`App.tsx`) over `revealed(run).years` and tallies once per change to the run; a panel
opened from a record card is opened from a tree that already drew forty rows, and
tallying seventy-odd worlds per click would be forty tallies of the same results. The
cursor's own year is in it, cut at the cursor: **a year in progress crowns nobody**, and
its line reads "3rd after round 5" (`placeLabel`, `isTitle`). The provider also carries
`pageOf`, so **in an era the panel's heading carries the page icon** (`PageLink`) to that
driver's or team's page, and each year line one to that year's season page
(`.claude/rules/web-people-pages.md`); a one-year run has no people
pages and passes none. The default is **no run in scope** — the
same empty default `EntryNames` and `Liveries` carry — and a name with nothing behind
it renders as **plain text, not as a control that opens an empty panel**. That is what
every component rendered on its own gets, which is what keeps the existing DOM-less
tests seeing the markup they were written against.

## Wiring a name

Wrap the name's markup in `DriverHistory` / `TeamHistory`. **A driver's block is one
trigger, its team line included**: it opens the driver, and a team's panel is reached
from the constructors' table — two triggers per row would double the tab stops on a
thirty-car sheet.

Outside a run the wrapper renders its children and **drops its `className`**, so a call
site keeps its own layout box and puts the trigger inside it. Where the name is fitted
to its room (`FittedName`, `tight`), the trigger takes `HISTORY_FILL`: a button is sized
to its content, and a fitted name inside one would measure the short form and stay on
it.

## Two things the panel must not do

**It must not grow with the career.** An era runs 1950–2026 and a forty-season career
would open a panel taller than the window, first year off the top, no way back to it.
The cap (`max-h-80 overflow-y-auto`) is on the **list**, not on the panel, so the
heading naming whose career it is stays put while the years scroll under it.

**It must not repeat the row it opened from** — inside the list. No badges, no
liveries, nothing that only restates the row the reader just left, which is the rule
from `web-liveries.md`. A zero is left out of a season's figures for the same reason a
career on zero is left off a record card: "12 pts · 0 wins · 0 podiums · 0 poles" forty
times over buries the four lines the panel was opened for.

**The heading is the exception, and carries a flag.** A floating panel has to say whose
it is on its own terms, and every table in this app names a driver or a team with the
flag beside them — the panel would be the one place they appear without it. A driver's
nationality, a team's base as of its last season in the run, resolved from the same
year the heading's name is. No badge: the flag identifies, the badge decorates.

**First place takes `STANDOUT_TEXT`, wherever it appears on the panel** — the season's
own position, and any driver who won the drivers' championship on a team's lineup line.
One accent meaning "won the thing", not a second idea for the same fact. That is why
`lineupOf` returns *parts* rather than a joined string: an accent cannot be applied to
the middle of a sentence the component was handed pre-joined.

## The two-control row

A row that opens in place — a record card's lineage row into its **spells**, a
championship table's row into its race by race — had the name itself as the disclosure
button. A name cannot be both a button and the trigger of another one, so those rows
carry **two controls**: the chevron keeps the breakdown by name, the
name opens the career. The file-tree split, and the only arrangement that leaves both
reachable.

It costs the second tab stop `DisclosureButton`'s own note argues against, so it is
opted into per call site — `label` on that component, which draws the chevron alone
and names it, since the row's text is no longer inside the button to do that job. Rows
that do not expand keep the single control the rest of the app has.

**`aria-expanded` no longer tells the two apart**: Radix marks its own popover trigger
with it. Tell them apart by `aria-haspopup="dialog"`, which is what the tests do — an
assertion that merely looked for `aria-expanded` passed with the chevron deleted.

## Testing

Split in two, because **Radix does not render a popover's contents while it is shut**
(the limit `web-app.md` records). So:

- **What a panel says** is tested in `lib/history.ts`, which is where it is decided —
  `figuresLine`, `lineupOf` and `ordinal` are pure and live there rather than in the
  component for exactly this reason, the same split as `spellSpan` in `lib/records.ts`.
  The derivation itself is checked against **worlds that were actually simulated**, by
  asserting relationships between two walks of the same results (the panel's years are
  the years the championship tables name them in; a team's lineup is the drivers whose
  standing carries its id), never a figure or a name.
- **What a screen offers** is tested in the markup: how many names became panel
  triggers, and that a lineage row still carries its chevron beside one.

`DriverName` renders **spans, not divs** — a `<button>` may only contain phrasing
content, and this is what puts one around the whole two-line block. `flex` is a
display; the layout is unchanged.
