---
paths:
  - "packages/data/src/arrange.ts"
  - "packages/data/src/people.ts"
---

# The grid's bulk rules

Three *rules* that reseat the **whole** field in one press — fastest drivers in fastest
teams, fastest in slowest, or shuffled — behind three buttons in the grid editor. This
file owns the rules themselves, in `packages/data/src/arrange.ts`, beside `carryOver.ts`,
which is the same kind of thing and the precedent for most of what follows. **The app
around them** — the panel, what the world keeps, what an era does with one, and how a
hand edit ends it — is `.claude/rules/grid-arrangements-app.md`.

## The rule

**Two orderings, paired index for index**: the seats ranked by the car in them, the
drivers the way the grid on screen ranks them — the overall it prints, racing settling a
tie — or shuffled. Whoever the pairing runs out of
goes without, which is why it returns a `LineupDraft`; only a grid that *already* had a
hole in it can come back with one.

- **Both of a team's cars sit together in the ranking**, so the best pairing is the best
  *two* drivers rather than the best driver spread one per team. A team is one piece of
  machinery.
- **The car, not the chassis**: `carOverall` folds the engine in, so a team handed
  somebody else's engine is ranked on what it will actually race. That is why an engine
  change counts as a hand edit (below) and why the store re-applies the world's supply
  before re-running a rule.
- **A tie on the overall breaks on racing**, then on team id, or on driver name then id.
  Ratings are integers on a 1–100 scale and an overall is a rounded average of several of
  them, so ties are ordinary; `compareByRating` is the app's one ranking rule and the
  lists on screen order by it too, so the car the reader can see at the front is the car
  the rule fills first. The last-resort id keeps two presses from returning different
  grids.
- **The cast comes from the grid on screen**, not from the season, so pressing a rule
  twice means the same thing the second time and the two ranked rules are their own
  fixed point.

## Who is in the running

`includeUnemployed` is whether the pool may be drawn on at all; **which of it, when it
may, is the reserve list's own filters and nothing else.** The reader is already looking
at the drivers without a drive, narrowed the way they want it, with both counts printed
above it — so the checkbox can only sensibly mean *those* drivers. An eligibility rule of
this file's own would be the app disagreeing with the panel beside it: widening the age
band to 45 would add three names to the list and none to the grid. **Changing a filter
therefore re-runs the rule in force**, exactly as the checkbox does (`narrow` in
`GridStage` does both jobs); neither counts as a hand edit.

**The filters travel inside the `GridArrangement`**, as a snapshot rather than a
reference. A rule outlives the screen it was pressed on — an era re-applies it every
year, and "the drivers who were around, aged 18 to 42" must mean the same thing in 1983
without depending on where a slider is sitting three seasons later.

It also makes the two rating modes fall out for free. `defaultDriverFilters` already
opens the career filters **on** in `aged` mode — the drivers actually around that year,
and the only ones the mode has anything to say about, since the ageing curve clamps a
driver evaluated thirty years from their debut to the bottom of the scale — and **off**
in `peak` mode, where a grid of authored peaks is out of time on purpose and the field of
all-time greats is the point. `matchesFilters` reads the band against `ratedAge`, the age
the ratings on the row describe in either mode.

**The seated half is never filtered**: they are on the grid, and a filter that could
empty a seat would make "include the pool" a way of *shrinking* the field. Nothing here
*bars* anyone either — a driver the filters hide can still be placed by hand.

`packages/data/src/people.ts` exists for this. The filters lived in
`apps/web/src/lib/people.ts`, and a rule a season is run on cannot read the web app, so
they moved down with a re-export left behind — the arrangement `rating.ts` has — leaving
one `matchesFilters` rather than two answers to which drivers someone is playing with.

## The dice

`random` takes an injected `Rng` and **throws without one**: a silent fallback to an
unshuffled grid would read as the button doing nothing, and `Math.random()` here would
cost reproducibility. Two sources, and the split is the established one:

- **in the editor**, a fresh `createRng(randomSeed())` per press, so *Randomize grid*
  twice gives two grids. Choosing which stream to draw from is a reader's action, like
  choosing a seed — `lib/seed.ts`, never the engine;
- **in the store**, `createRng(seed)` off the season's own seed, so a re-rolled grid is
  reproducible from the number the season is. A separate generator from the one the
  races run on, discarded once the grid is made.

## Testing

`arrange.test.ts` covers the rules against synthetic teams, cars and drivers, like
`carryOver.test.ts` — seat counts preserved, nobody seated twice, the ranked rules
idempotent, the age band followed one year at a time (the case that was broken while the
rule carried its own eligibility rather than the panel's), the seated half never
filtered. The randomised cases are property-shaped and **mutation-checked**: replacing
`rng.shuffle` with the list itself fails three, one of which exists purely to catch a
shuffle that never touches the first seat.

Where an applied rule *ends up* is not tested here — that is the store, in
`.claude/rules/grid-arrangements-app.md`.
