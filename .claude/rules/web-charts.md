---
paths:
  - "apps/web/src/components/StandingsEvolution.tsx"
  - "apps/web/src/lib/evolution.ts"
---

# Web app — charts

**Recharts**, cashing in the decision that used to sit in `docs/DECISIONS.md`. The
season summary's *standings evolution* charts are the first ones in the project and
therefore the pattern for the driver-progression chart the ratings editor needs: the
library, the theming, the axes and how a series takes a team's colours are settled
here, against simpler data, deliberately.

## What is drawn

Two line charts on the season summary, each **directly under the table it explains** —
the drivers' chart under the drivers' championship, the constructors' chart under
theirs. The table says who won and the chart says when, and splitting them would make
the reader carry six names across the page. `SeasonStandings` interleaves them, behind
a `charts` prop that defaults **off** for the reason `badge` does: the era's roll of
honour opens that same pair as the expansion of a row, and a chart inside an expansion
repeats the screen the reader just left. The **top six drivers** and the **top four
teams**, as they stood after each round.

Two questions the roadmap left open, both answered:

- **The series are the top few _at season end_**, not at any point. The reader arrives
  knowing who mattered, and a legend that grows every time a midfielder has one good
  afternoon costs more than the honesty buys.
- **The y axis is points, not championship position.** Position is the flatter, tidier
  chart and throws away the only thing worth seeing: a title settled by two points and
  one settled by forty are the same picture on it.

Lines are **straight between rounds** (`type="linear"`). A monotone curve would draw
points nobody scored, in the gaps where no racing happened.

## Nothing is stored, and nothing was added to the engine

The fold is `lib/evolution.ts`: standings are derived from result rows, so the
championship after round *n* is `{ races: races.slice(0, n + 1) }` through the engine's
own `championshipStandings` / `constructorStandings`. It runs the table once per round
rather than keeping a hand-rolled running total, which is quadratic over about twenty
rounds and worth it — a second implementation of scoring would drift from the engine's
tie-breaks and the chart would quietly disagree with the table beneath it. A test
asserts the last value of every line *is* the number on that competitor's row.

A competitor who had not entered yet scores **0 rather than a gap**: they are on the
chart for where they finished the season, and a line starting in mid-air reads as
missing data.

## Colour: livery, and how it reaches an SVG

Series colours are the teams' own, through `legible()` in `lib/livery.ts` — the same
one anti-clash mechanism the badges and cards use. **Colour follows the entity, never
its position**: a driver does not change colour for finishing second.

`legible()` returns a `color-mix(…, var(--color-foreground))`, and **`var()` does not
work in an SVG presentation attribute** — `stroke="var(--x)"` is silently ignored, and
an ignored stroke is an invisible line, which is the same failure mode
`.claude/rules/web-liveries.md` records for `oklch(from …)`. So:

- each series colour is set as a `--series-N` custom property on the card, and
- the stroke is applied by a **CSS rule** — `SERIES_STROKE`, a list of literal class
  strings, because Tailwind only generates a class it can see spelled out in the
  source. The rule targets `.recharts-curve` rather than the group Recharts puts the
  class on: the path carries its own `stroke` attribute, which beats an inherited
  colour but loses to a rule that selects the path.

Everything else that has to follow the theme uses `stroke="currentColor"` plus a text
utility (`text-border` on the grid, `text-muted-foreground` on the axes), which needs
no custom property at all.

## Two cars in one colour is the ordinary case

1950 puts three Alfas in the first three places. They are **never recoloured** to
separate them — a driver in a different red from his own car is a worse lie than a line
that needs a second look. Instead:

- **`TEAM_DASHES`**: a team's first car is solid, the rest take successive dash
  patterns. The legend's mark is drawn from the *same* numbers via `dashGradient`, so
  the two cannot drift; it is a `<span>` with a `repeating-linear-gradient` and not an
  inline SVG, for the reason `TeamBadge` is one — several tests count flags by counting
  `<svg>`.
- **The end-of-line number**, which is that line's position in the legend. Colour alone
  cannot carry six identities and a livery palette is not a categorical one. Drawn once
  (a `LabelList` content function is called for every point, and returns null for all
  but the last) and in the muted *text* token, never the series colour. `endLabelNudges`
  stacks the numbers of lines that finish level, since a tie is exactly the season worth
  looking at and two numbers in one place are a smudge.

The legend and the tooltip are **plain HTML**, below the plot rather than beside it —
which is also the phone answer, and what makes the names, their order and their totals
readable to a screen reader. The legend is a **grid, not a wrapping row**:
`legendColumns` puts three names across (six wrapped five-and-one, which reads as a
mistake) and drops to two rather than strand a single name on the last row, which is
the four-team case. Fixed columns also align the names under each other, so the legend
can be read down.

## Testing: the chart itself is invisible

**Recharts renders nothing without a DOM.** Not a `ResponsiveContainer` quirk — a
fixed-size `LineChart` static-renders an empty `div` too. So:

- everything about the *data* is tested in `lib/evolution.test.ts`;
- the pure display decisions are exported and tested directly — `plotSeries`,
  `dashGradient`, `endLabelNudges`;
- `components/charts.test.tsx` asserts what a static render can still see: the two
  headings, that each sits under its own championship table, that the roll of honour
  gets neither, and a legend that agrees with the table above it.

What no test here can reach is whether the lines are *drawn*. That was checked by
driving a real browser against the dev server and reading `getComputedStyle(path).stroke`
back off the paths. Do that again if the colour mechanism above is ever changed — a
chart with no lines on it looks exactly like a chart with no data.
