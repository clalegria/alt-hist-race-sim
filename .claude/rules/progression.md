---
paths:
  - "packages/engine/src/progression/**"
---

# Driver progression

The ageing curve: `ratingsForSeason` turns an authored career into a season's ratings.

- **Deterministic, and staying so**: no `Rng` without the author's decision. The planned
  *random careers* setting (`docs/design/era-advanced.md`) is a separate path beside it.
- **The population curve owns the shape; a driver's traits own the placement.** Fix a
  career that looks wrong through the anchors or the rates, never by letting a trait
  steepen the fall; `stepDown` is where a genuine cliff belongs.
- **`peakSeasons` is a literal count.** Never reintroduce a mapping between the authored
  value and the one used.
- **Plateau width and decline onset are one lever**: a narrow plateau brings the fall
  forward in real time. Don't try to separate them.
- `ratingsForSeason(career, peakSeason)` returns the authored ratings exactly, tested in
  both packages. Anything that shifts the peak season's output is a bug.
- Seasons outside a career still return ratings (`pnpm progression` sweeps 16–55). The
  curve never reads `finalSeason`.
- `peakSeasons` 1 gives both plateau sides zero width; the warp's branches guard the
  division. Keep both halves of that guard.
- Ratings are rounded at the end: two attributes with different peaks differ by a point
  from rounding alone, and one season's fall can round to its neighbour's. Shape tests
  measure over three seasons, never one.
- Profile tests read the ordering out of the sensitivity tables, never name a pair, so a
  changed sensitivity cannot leave a test asserting a gap the table no longer makes.
- When a career looks wrong, read the `Curve` column of `pnpm progression`: it is the
  canonical age (a quick 44-year-old reads as 38).
