---
paths:
  - "packages/engine/src/season/**"
---

# Season model

The season loop, the standings derived from it, and when a title is settled.

- **The points scale is authored per season** (`points` in each season file) and
  required everywhere: never give `pointsForPosition`, the standings or the clinch
  functions a default. A season scored on another era's table looks plausible and errors
  nowhere. The web world carries it as `World.points`.
- **The array is the whole rule** (the author's call): no dropped scores, no fastest-lap
  or sprint points, no half points. Every race counts, and only finishing position scores.
- A constructor scores with every car it enters, in every season.
