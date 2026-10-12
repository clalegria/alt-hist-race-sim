---
paths:
  - "packages/data/src/arrange.ts"
  - "packages/data/src/people.ts"
---

# The grid's reseat rules

Three *rules* that reseat the **whole** field — fastest drivers in fastest teams, fastest
in slowest, or shuffled — behind the run setting *Who drives where*. This file owns the
rules themselves, in `packages/data/src/arrange.ts`, beside `carryOver.ts`, the same
kind of thing. **The setting around them** — where the reseat sits in the starting grid,
what the world keeps, how a hand edit sits on top — is `.claude/rules/teams-and-seats.md`.

## The rule

**Two orderings, paired index for index**: the seats ranked by the car in them, the
drivers the way the grid on screen ranks them — the overall it prints, racing settling a
tie — or shuffled. Whoever the pairing runs out of goes without, which is why it returns
a `LineupDraft`; only a grid that *already* had a hole in it can come back with one.

- **Both of a team's cars sit together in the ranking**, so the best pairing is the best
  *two* drivers rather than the best driver spread one per team.
- **The car, not the chassis**: `carOverall` folds the engine in, so a team running
  somebody else's engine is ranked on what it will actually race; the store reseats the
  cars the run races, rolls included.
- **A tie on the overall breaks on racing**, then on team id, or on driver name then id:
  `compareByRating` is the app's one ranking rule, so the car at the front of the list is
  the car the rule fills first, and two runs of a rule return the same grid.
- **The cast comes from the grid being reseated**, the kept teams' signings included, so
  the two ranked rules are their own fixed point.

## Who is in the running

`includeUnemployed` is whether drivers without a seat may be drawn on at all; **which of
them is the run's signing pool and nothing else** (`driverPool`, through
`seatingArrangement`), the pool the kept teams' empty seats sign from too, so the run has
one answer to who may be signed. It travels inside the `GridArrangement` as a snapshot,
so "aged 18 to 42" means the same thing in every year of an era.

`matchesFilters` reads the band against `ratedAge`, the age the ratings describe in
either mode, and `defaultDriverFilters` opens *only drivers racing that year* on under
`aged` and off under `peak`, where a grid of authored peaks is out of time on purpose.

**The seated half is never filtered**: a filter that could empty a seat would make "take
drivers without a drive" a way of *shrinking* the field. Nothing here *bars* anyone
either — a driver outside the pool can still be placed by hand in the grid editor.

The filters live in `packages/data/src/people.ts`, re-exported by
`apps/web/src/lib/people.ts`, so the reseat, the signings and the editor's list share one
`matchesFilters`.

## The dice

`random` takes an injected `Rng` and **throws without one**: a silent fallback to an
unshuffled grid would read as the setting doing nothing, and `Math.random()` here would
cost reproducibility. The store passes `createRng(seed)` off the season's own seed, a
separate generator from the one the races run on, discarded once the grid is made.

## Testing

`arrange.test.ts` covers the rules against synthetic teams, cars and drivers, like
`carryOver.test.ts` — seat counts preserved, nobody seated twice, the ranked rules
idempotent, the age band followed one year at a time, the seated half never filtered.
The randomised cases are property-shaped and **mutation-checked**: replacing
`rng.shuffle` with the list itself fails three, one of which exists purely to catch a
shuffle that never touches the first seat. Where a reseat *ends up* is the store's,
in `.claude/rules/teams-and-seats.md`.
