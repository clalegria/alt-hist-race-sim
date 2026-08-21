---
paths:
  - "packages/engine/src/progression/**"
---

# Driver progression — the ageing curve

`ratingsForSeason(career, season, constants?)` turns an authored career into the
ratings a driver held in a given season. Roadmap 1, and the thing that made driver
ratings tunable at all.

**It is deterministic. There is no `Rng` parameter and none is coming without a
decision from the author.** Same career in, same ratings out, in every seed. Two
consequences worth holding on to: a driver's curve can be reasoned about from the
authored numbers alone, and the *realize-once-and-store* invariant in `CLAUDE.md` is
currently vacuous — nothing is rolled, so nothing needs storing. It stays in force for
the day per-run scatter lands.

## Shape

```
 debut          plateau start   peak   plateau end
   |------ development ------|----- • -----|------ decline ------>
```

- **Development** runs debut → plateau start. The driver starts at a rookie level set
  by how much runway they have (`deficitPerDevelopmentSeason` per year, capped), and
  `developmentSpeed` 1–10 shapes the *route*, not the destination: high speed gives a
  concave curve that climbs fast then flattens, low speed a convex one that arrives
  late. Both land on the same plateau.
- **Plateau** is `peakSeasons` wide, centred on the peak season, with the extra season
  of an even span going *after* the peak. It is not flat: exactly 100% in the peak
  season, easing quadratically to `plateauEdgeDeficit` at the ends. "Only truly peak
  for one season, very close for several" is the whole point of the window.
- **Decline** starts at the plateau edge deficit so it is continuous, then grows as
  `years^declineExponent` — above 1, so decline accelerates.

## The deficit is split three ways, and that is what makes the model interesting

`seasonDeficits` returns `{ development, decline, form }` rather than one number,
because each bucket hits the five attributes through a different sensitivity table.

**Young drivers are fast but wild; old drivers are wise but slow.** In development,
raw pace arrives first (qualifying sensitivity 0.7) while consistency and composure
are the last things to come (1.25, 1.35). In decline it inverts: reflexes and one-lap
pace go first (qualifying 1.3) and the judgement built over a career barely erodes
(composure 0.5). Flatten both tables and a 40-year-old becomes a uniformly worse
driver instead of a different one — there are tests that fail on exactly that, using a
peak with all five attributes equal so rounding cannot mask it.

Authored events land in the semantically right bucket: the rookie-season penalty is
development, a steep decline is decline, an off-form season is form (and so hits every
attribute equally, because a bad year is a bad year).

## Gotchas

- **Seasons outside a career still return ratings.** Before the debut you get the
  driver's debut level, flat; long after, a heavily declined one. That is deliberate —
  the progression tool sweeps ages 18–50 and a career is a window on a curve that
  exists either side of it. Nothing filters by `finalSeason`; it is informational.
- **`developmentSpeed` and `declineSpeed` are on a 1–10 scale**, not the 1–100 the
  five ratings use. The authored data sits in 3–7.
- Ratings are rounded to whole numbers and clamped to 1–100 at the end. Comparing two
  attributes of *different* peak values will therefore differ by a point through
  rounding alone — do not read a sensitivity difference off that.
- The curve is anchored to the authored peak: `ratingsForSeason(career, peakSeason)`
  returns the authored ratings exactly, and a test pins it. Any change that shifts the
  peak season's output is a bug, not a re-tune.
