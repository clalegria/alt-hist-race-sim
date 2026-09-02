---
paths:
  - "packages/engine/src/season/**"
---

# Season model

`simulateSeason(field, calendar, rng, raceConstants?, model?)` runs the same field once
per entry in `calendar` and returns `{ races }` — nothing else. A race's index in that
array is its round number.

**The calendar, not a round count.** Each entry is a `RoundContext` — the host country,
which turns home advantage on — and its length is how many races the year has, so a
season of `n` featureless rounds is `n` empty objects. This is the seam every later
circuit feature hangs off, rather than each one growing a parameter of its own; an empty
calendar is a `RangeError`.

**The loop stamps `seasonProgress` on every round** — 0 at the opener, 1 at the finale,
from the array index, written over anything the caller supplied. That is what makes a
car's `developmentTrend` mean anything, and it is why a season feels development and a
lone `simulateRace` does not. See `.claude/rules/car-development.md`.

**One RNG threaded through the whole year**, not re-seeded per race, so a season is
a single continuous stream and round 7 depends on everything drawn before it.
Changing an early round changes the rest of the year. That is the honest behaviour,
and it means a bug report needs one seed rather than fourteen.

The race model goes in as a parameter (`RaceModel`, defaulting to score-and-sort),
so the season loop never reaches for `simulateRace` directly and a richer race model
drops in without touching it.

The field is fixed for the whole season. Mid-season seat changes belong to the
market; when it exists, this loop takes a field per round instead of one for the year.

## Standings are derived, never accumulated

`championshipStandings(season, points)` and `constructorStandings(season, points)`
build their tables from the stored results on read. Nothing anywhere
keeps a running points total — that would be a second source of truth waiting to
disagree with the first. Order is points, then countback (most wins, then most
seconds, and so on down, as 1980 did), then driver id so the order is total and never
depends on the sort implementation.

Both tables are the same tally keyed differently, so they cannot drift apart. A
constructor scores with **both** cars — the rule from 1979 onward, and the only one
this sim needs, since it starts in 1980 and runs forward. That makes a team's
`starts`, `wins` and `podiums` per car rather than per race (a two-car team that
finished all fourteen rounds with both cars has 28 starts), while `poles` stays per
race because only one car starts from pole.

## The points scale is a property of the season, not a constant

`PointsScale` is a plain `readonly number[]`, best first, and it is **authored per
year** in `packages/data/src/seasons/<year>.json` as `points`. Its *length* is how many
places score, so 1950's 8-6-4-3-2 and 2010's 25-18-15-12-10-8-6-4-2-1 are the same code
with a different array.

**Nothing has a default.** `pointsForPosition`, both standings functions and both
clinch functions take the scale as a required argument, because a season quietly scored
on another era's table produces a plausible championship and no error at all. The web
world carries it (`World.points`, straight off the seed file, the same reason `field`
is stored) and the components take it as a prop; `validateSeedData` rejects a season
with no scale, a negative entry, or a scale that pays a lower place more than a higher
one.

Which scale a year pays is history and belongs in that year's file: 8-6-4-3-2 through
the fifties, 8-6-4-3-2-1 in 1960, 9-6-4-3-2-1 from 1961, 10 for a win from 1991, eight
scorers from 2003, and ten places from 2010.

**The array is the whole rule** (author's call). No dropped scores, no point for
fastest lap, no sprint points, no half points for a race stopped early — every race
counts and a finishing position is the only thing that scores. 1980 counted each
driver's best five results from the first seven races and best five from the last
seven, so real totals are lower than every-race totals — Jones scored 71 gross against
67 counted. Here every race counts, and a simulated Jones season lands around 72.

## A title is settled the moment nobody can reach the leader

`season/titles.ts`, which is why a champion can be crowned with rounds still to run.
*While rounds remain* the comparison is strict: a challenger able to *equal* the
leader has not been beaten, because a tie falls to countback and countback is a result
rather than a certainty. Every challenger is checked, not just the runner-up.

Once no rounds remain that reasoning inverts, and the function returns the leader
outright: countback has *happened*, the standings are sorted on it, and first place is
the champion however close the points are. The strict comparison alone never resolves
a season that ends level — seed 302280 finished with Piquet and Jones on 62 apiece and
crowned nobody, so the last round showed neither the title banner nor the accent on
the champion's row. Both tables get the same carve-out, and a web test renders that
seed's final round to keep it fixed.

The constructors' case is the one to get right. A driver's best round is the win; a
two-car team's is a one-two, so 15 points on the 1980 scale rather than 9. Each team
is measured by its own car count — `cars` on `ConstructorStanding`, the most it
entered in any round — because with unequal entries the biggest remaining threat is
not always whoever is currently second. Treating every team as a single car declares
titles settled a round or two early, which looks like a rounding slip and is not.
