---
paths:
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/SeasonGrid.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/components/RatingModeToggle.tsx"
  - "apps/web/src/lib/people.ts"
  - "apps/web/src/lib/rating.ts"
  - "apps/web/src/lib/sort.ts"
  - "apps/web/src/components/SortToggle.tsx"
---

# Web app — the grid and its editor

The opening screen of a season and the only screen that changes what gets simulated.
Split out of `.claude/rules/web-display.md`, which still owns everything downstream of
the grid — the sessions, the tables and the accent — and which loads alongside this one
whenever you are in `src/components/`. The architecture underneath both, including why
the draft lives where it does, is in `.claude/rules/web-app.md`.

- **The grid opens closed.** Teams and drivers with a flag, an age and one overall
  rating; the individual ratings live behind a popover, and teams are listed
  alphabetically rather than by pace so the pecking order is not given away before a
  wheel turns. A test asserts no rating label appears in the closed markup.
- **Both lists can be reordered: alphabetically, or best first.** `SortToggle` sits on
  the grid header and on the `ReserveList` header, and the rule behind it is `sortBy` in
  `lib/sort.ts` — a pure function, unit-tested against synthetic ratings for the reason
  the pool filters are. **Alphabetical is the default and stays it**: the point above
  holds, and a page that opened on the pecking order would give it away unasked. By
  rating it is *descending* — "sorted by rating" means "show me the front of the grid" —
  and **name is always the tie-break**, which comes free from sorting by name first and
  then by rating, since `Array.prototype.sort` is stable. Ratings are integers on a
  1-100 scale, so ties are ordinary rather than exotic, and two cars on 84 trading
  places between renders is flicker nobody can explain.
  Each list gets the switch it needs where it needs it. The grid has one on all three
  places it is drawn — the opening grid, the editor, and the season summary, where the
  pecking order is the point rather than a spoiler. The pool has its own, held
  **separately**: a reader hunting a name among the reserves has not asked for the team
  cards to be reshuffled. Both are the same overall the rows already show —
  `carOverall(car, engine)` and `driverOverall` — so a list agrees with the numbers down
  its own right-hand edge. The pool is **filtered first and ordered second**; the counts
  in its header describe the filtering only.
  The control is **native radios in a fieldset**, visually hidden behind their labels,
  for the reason the filters are native checkboxes: arrow-key navigation and the group
  announcement come free, and a DOM-less test can read which option carries `checked=""`.
  Two collisions that cost time once: a bare `checked=""` count now catches the sort
  radio as well as the filter checkboxes, and React writes `checked` *before* `value`,
  so tests parse the input's attributes rather than matching them as one string.
- **The overall on a team card already has the engine in it**, via
  `carOverall(car, engine)` → the model's own `powertrain()`. Showing the bare chassis
  would be a number nothing races on. The popover behind it shows the parts instead:
  the four chassis ratings, then the engine's three under its own heading — an engine
  has no consistency, so that panel is one row shorter, which is the point rather than
  an omission.
- **The grid can be rearranged: drivers by swapping, engines by picking.** `Edit grid`
  turns every driver row into a select button, puts a supplier `select` on every team
  card, and opens `ReserveList` — everyone in the pool without a seat — as a sticky
  sidebar; the team cards drop from three columns to two to make room. Select a driver,
  then whoever takes the seat: seated ↔ reserve, or seated ↔ seated between two teams.
  Two reserves in a row cannot swap, so the second just becomes the selection rather
  than doing nothing visible. Nothing here can *add* a car, by construction rather than
  by validation — and the engine picker offers only what the season rates, so nothing
  can invent a supplier either. A native `select` rather than a styled listbox: it is a
  plain one-of-N from a short list, and the platform control is keyboard- and
  screen-reader-correct for free.
- **The pool of drivers without a drive can be narrowed, and only that list.** Three
  filters in `ReserveList`: hide anyone whose real career had ended before this season
  (`finalSeason`), hide anyone whose career had not begun (`debutSeason`), and an age
  range read off `birthYear` against the year on screen. All three read seed data that
  already existed; none of them reach the simulation, and none of them touch the grid
  itself — a hidden driver is missing from a list, not barred from a seat.
  **All three narrow by default** — aged 18-42, both career filters on — so the list
  opens on the drivers who were actually around that year. A pool spanning 1950 to 2026
  is otherwise mostly people who were children, pensioners or not yet born in the year
  on screen, and a list of them is a list nobody can use. Casting a driver in a car they
  never raced is still the premise of the app; the filters are three clicks from off and
  nothing they hide is barred from a seat. `AGE_RANGE` caps how far the range opens, at
  16-56.
  Two rules keep the filters from producing a dead end. **Nobody the season actually
  entered is ever hidden**, so a driver dropped from the grid can always be put back —
  without it, swapping out a 43-year-old with the range ending at 42 makes them
  unreachable. **Neither is whoever is selected.** And the panel always states both
  counts ("18 of 23 in the pool"), because a list that quietly shrinks reads as an app
  that lost half its drivers. An empty result says so in words rather than showing a
  blank panel.
  The filters are **controlled** — held in `GridStage` beside the lineup draft, passed
  down — for the reason everything in the editor is: a DOM-less test can then render any
  state the list can be narrowed to. The rules themselves are pure functions in
  `lib/people.ts`, unit-tested against synthetic careers, because what a filter does is
  a rule and a test reading a real career fails the day the data is corrected. The
  controls are a native checkbox and a native number input, for the reason the engine
  picker is a native `select`.
- **An edited grid says so, in the same muted dashed frame everywhere.** Deliberately
  *not* the `lib/highlight.ts` accent: "the grid was changed" is a caveat on a result,
  not something that was won, and borrowing the accent would also break the test that
  counts exactly two accented cards per summary. A driver who is not where history put
  them carries the same soft fill (`SWAPPED_IN`) in the grid, and so does the header of
  a team running an engine it was not given, so the note and the cards agree without the
  reader matching names. The summary declares it **twice** — a banner above the
  champions, because finding out at the foot of the page is finding out too late, and
  the full list on the grid at the end.
  **Both kinds of change share one notice**, in `GridChanges`: one row per team, "Alain
  Prost for Jody Scheckter" and "Renault engine for Ferrari" on the same line if both
  happened, and `changeCount` totals seats and engines together. Two separate notices
  would make a season that changed one of each look like two unrelated caveats.
- `lib/rating.ts` computes the overall: a **display heuristic, not model truth** —
  nothing in the engine reads it — whose weights approximate how much each rating
  actually moves results. Reliability takes a quarter of the car number despite
  touching no race score, because ~42% of the 1980 field failed to finish and a
  fragile car forfeits points it had the pace to take. Adaptability is weighted zero:
  paying for it would claim a driver is better at something the sim never asks of.
  The engine is the exception to "the weights live here": `carOverall` folds it in
  through the engine package's `powertrain()` rather than giving it weights of its own,
  because how much an engine is worth is a *model* claim and there must be one answer.
