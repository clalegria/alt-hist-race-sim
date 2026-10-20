---
paths:
  - "apps/web/src/components/StandingsEvolution.tsx"
  - "apps/web/src/lib/evolution.ts"
  - "apps/web/src/lib/chart-layout.ts"
---

# Charts

The season summary's standings evolution (`StandingsEvolution.tsx`, `lib/evolution.ts`).

- **Recharts is the chart library, and this chart is the pattern** for the next one (the
  ratings editor's driver progression): theming, axes and series colour are settled here.
- **The fold runs the engine's own standings over `races.slice(0, n + 1)`**; never a
  hand-rolled running total, which would drift from the engine's tie-breaks.
- **Series colour follows the entity**: the team's livery through `legible()`. Team-mates
  are never recoloured; they take `TEAM_DASHES`.
- **`var()` does not work in an SVG presentation attribute.** Series colours are
  `--series-N` properties on the card, applied by the `SERIES_STROKE` rules aimed at
  `.recharts-curve`. Keep `SERIES_STROKE` literal class strings so Tailwind generates them.
- **The legend and tooltip are plain HTML**, and the legend's dash marks are CSS gradients
  from the same numbers (`dashGradient`), not SVG (`web-names.md`).
- **Recharts renders nothing without a DOM**: test the data in `lib/evolution.ts` and the
  exported display rules directly. No test sees whether the lines are drawn; if the colour
  mechanism changes, read `getComputedStyle(path).stroke` back in a real browser.
- **Only the season page draws them** (`charts` on `SeasonStandings`, default off), and
  heads them "was won" only once the season is `finished`: before that, "race stands".
- **End-of-line labels are laid out together, never one by one**: `EndLabels` reads the
  chart's own scales and `spreadLabels` (`lib/chart-layout.ts`) keeps them a label apart,
  inside the plot. The y axis is `niceTicks`, with its domain set to match.
- **On a phone the legend is one column and the round axis numbers only `phoneRoundTick`'s**,
  hidden by CSS in `RoundTick`; the axis keeps `interval={0}`, so Recharts never thins it.
