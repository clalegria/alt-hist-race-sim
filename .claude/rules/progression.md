---
paths:
  - "packages/engine/src/progression/**"
---

# Driver progression — the ageing curve

`ratingsForSeason(career, season, constants?)` turns an authored career into the
ratings a driver held in a given season.

**It is deterministic. There is no `Rng` parameter and none is coming without a
decision from the author**: per-run scatter is *none*, and the *random careers* run
setting planned in `docs/design/era-advanced.md` would be a separate path beside this one.
Same career in, same ratings out, in every seed, so a driver's curve can be reasoned
about from the authored numbers alone.

## One curve, read at the driver's own pace

**The population curve owns the shape; a driver's traits own the placement.** That
split is the whole model, and the thing to protect.

`CANONICAL_ABILITY` in `constants.ts` is a table of ability-as-a-fraction-of-peak
against age — what an average career looks like. Improvement peaking in the mid-teens
and easing from there into the plateau (it ramps *in* below that, so the very bottom of
the table is not its steepest part), flat from 28 to 33, a *gentle* slope from 35 into
the early forties (0.97 to 0.825 by 42), then a fall that never eases and keeps
steepening all the way down — one point a year at 35, seven a year at 53. It is
authored by hand, and it is the only thing that decides how much a year off peak costs.

**The table ends *on* its floor (0.1 at 55) rather than easing onto one, and that is
load-bearing.** A fall that keeps steepening has to cross zero, so any tail that lands
softly on a floor must decelerate to get there, and no single anchor fixes that — the
tail is zero-sum: pulling one point down steepens the segment to its left and flattens
the one to its right. Ending at the floor and letting `canonicalAbility` hold flat past
it is what buys the accelerating-decline property across the whole table. **Do not add
an anchor past 55 without re-deriving the tail**; it reintroduces the dip.

`canonicalAge(career, season)` maps a real age onto that curve in four segments, pinned
at three points — the driver's plateau start onto `canonical.plateauStart`, his peak
season onto `canonical.peak`, his plateau end onto `canonical.plateauEnd`. Peak at 30,
both traits at 5:

```
  real age           22   26   27   29   30   31   34   38   43
  8-season plateau   22   26   27   29   30   31   34   38   43   (the identity)
  3-season plateau   20   24   25   27   30   34   37   41   46
```

**The authored plateau is compressed onto the canonical one, not measured against it.**
That is what lets `peakSeasons` stay a literal count: a three-season plateau squeezes
the curve's own flat top into three real years, and the rise and fall pick up from its
edges. `developmentSpeed` and `declineSpeed` then set how fast the axis runs outside the
plateau, and nothing else — a rate **below 1 is the fast developer**, whose three real
years short of the plateau read as one and a half canonical years short. Nothing a
driver is authored with can make the fall steeper than the population's; that is the
point, and `stepDown` is where a genuine cliff belongs.

**A driver who peaks at 30 with a plateau as wide as the canonical one (8 seasons, for
27–34) and both traits at 5 is warped by the identity.** He *is* the canonical curve,
and a test pins it by deriving the width from the anchors rather than writing it down.

**Both plateau ends want to sit where the curve is already within about two percent of
peak**, which is why they are 27 and 34 rather than the shoulders at 25 and 35. Widen
them and every authored plateau reports back shorter than it was written, because its
outermost seasons land on ability no reader would call a peak; it also widens the step
into the peak season for anyone authored at `peakSeasons` 1 or 2, who has no season
before the peak inside the plateau at all.

## Age and experience are separate axes

Being new to the sport is not the same thing as being young, and the data authors both
(`birthYear`, `debutSeason`). A 28-year-old rookie sits on the plateau of the ability
curve and still does not know the job; a 21-year-old in his fourth season does.

`rookieSeasonPenalty` is the second axis. It lands in full in the debut season **and in
every season before it** — so the curve never rewards a driver for not having started —
then fades linearly. Both its size and its fade are scaled by `developmentSpeed`, so
"immediately competitive" is something a driver can be authored as: at 10 the relief
leaves 15% of it and it is gone by season two, at 1 it lands whole and takes five
seasons to clear.

**The fade is capped at the peak season**, whatever the trait says. A driver cannot
still be learning the job in the season he was at his best, and without the cap anyone
who peaks inside his first few seasons can never be rated his authored peak. Two tests
pin it, one in each package.

## The deficit is split three ways, and that is what makes the model interesting

`seasonDeficits` returns `{ development, decline, form }` rather than one number,
because each bucket hits the attributes through a different sensitivity table.

The age curve's shortfall goes to **development** before the peak season and to
**decline** after it — the same number meaning opposite things. Short of peak on the
way up is a driver who has not arrived; short of it on the way down is one who is
going. Inexperience joins development, a step down joins decline, and an off-form
season is **form**, which hits every attribute equally because a bad year is a bad year.

**Young drivers are fast but wild; old drivers are wise but slow.** In development, raw
pace arrives first (qualifying sensitivity 0.7) while consistency and composure are the
last things to come (both 1.25). In decline it inverts: one-lap pace goes first
(qualifying 1.3) and the judgement built over a career barely erodes (composure 0.75),
with racing, consistency and adaptability tracking the deficit as it is. Flatten either
table and a 40-year-old becomes a uniformly worse driver instead of a different one —
there are tests that fail on exactly that, using a peak with every attribute equal so
rounding cannot mask it.

**The profile tests read the ordering out of the sensitivity tables rather than naming
a pair.** They assert that a more sensitive attribute sits lower, that two the table
treats alike land on the same number, and that the attributes are not all equal — so a
change to a sensitivity cannot leave a test asserting a gap the table no longer makes.

## Gotchas

- **`peakSeasons` is a literal count and must stay one.** Author 7 and `peakWindow`
  returns seven seasons. **Never reintroduce a mapping between the authored value and
  the used one** — a nudge against a nominal width stretches the curve's flat top across
  far more seasons than were written. If the plateaus feel wrong, the anchors or the
  rates are the levers.
- **An even span puts its extra season after the peak**, since form is held on to longer
  than it takes to find. That is a choice, not a rounding accident, and a test pins it.
- **`peakSeasons` 1 gives both sides of the plateau zero width**, and the warp has one
  guard for it: with nothing before the peak the rise branch covers everything below,
  and with nothing after it the plateau branch returns the canonical peak directly.
  Removing either half divides by zero.
- **Seasons outside a career still return ratings.** The progression tool sweeps ages
  16–55 and a career is a window on a curve that exists either side of it. The curve
  never reads `finalSeason` (see `.claude/rules/seed-data.md`).
- **A narrow plateau brings decline forward in real time**, because the fall is measured
  in canonical years from the plateau end. A driver authored `peakSeasons` 2 reaches
  "canonical 40" at real age 37. This is not separable: if the population curve owns the
  shape of the fall, then where the plateau ends is where the fall begins. Width and
  onset are one lever, not two.
- **The curve is held flat beyond both ends of the anchor table**, which is what stops a
  swept lifetime bottoming out at the rating floor — a warped canonical age can land a
  long way off either end. A test pins it.
- **`developmentSpeed` and `declineSpeed` are on a 1–10 scale**, not the 1–100 the
  ratings use, and 5 is nominal. `traitRate` interpolates in two straight segments
  through the value at 1, 5 and 10 rather than one, precisely so 5 lands exactly on the
  nominal rate.
- Ratings are rounded to whole numbers and clamped to 1–100 at the end. Comparing two
  attributes of *different* peak values will therefore differ by a point through
  rounding alone — do not read a sensitivity difference off that. It also means a single
  season's fall past the plateau can round to the same integer as its neighbour's;
  shape tests measure over three seasons, not one.
- The curve is anchored to the authored peak: `ratingsForSeason(career, peakSeason)`
  returns the authored ratings exactly, and tests pin it in both packages. Any change
  that shifts the peak season's output is a bug, not a matter of taste.
- **The `Curve` column in `pnpm progression` is the canonical age.** It is the column to
  read when a career looks wrong: a 44-year-old who is still quick reads as 38, and one
  who is finished reads as 52.
