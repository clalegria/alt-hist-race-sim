---
paths:
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/SeasonGrid.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/components/RatingModeToggle.tsx"
  - "apps/web/src/lib/rating.ts"
---

# Web app — the grid and its editor

The opening screen of a season and the only screen that changes what gets simulated.
Split out of `.claude/rules/web-display.md`, which still owns everything downstream of
the grid — the sessions, the tables and the accent — and which loads alongside this one
whenever you are in `src/components/`. How either list is *ordered* and how the pool is
*narrowed* moved out again, to `.claude/rules/web-lists.md`, which loads here too. The
architecture underneath all three, including why the draft lives where it does, is in
`.claude/rules/web-app.md`.

- **The grid opens closed.** Teams and drivers with a flag, an age and one overall
  rating; the individual ratings live behind a popover, and teams are listed
  alphabetically rather than by pace so the pecking order is not given away before a
  wheel turns. A test asserts no rating label appears in the closed markup. The age on a
  row is `ratedAge` — the age the ratings beside it describe, which under `peak` is the
  driver's age at their peak and not their age in the year loaded. `SeasonGrid` takes
  `ratingMode` for that one purpose: the ratings arrive already resolved on the
  entrants, and the age does not.
- **A clickable name is marked by a fill, never an underline.** `NAME_TARGET` in
  `SeasonGrid.tsx` is the one definition — nothing at rest, `bg-accent` under the
  cursor or the keyboard focus, and the same fill held while a panel is open — and it
  is shared by the popover triggers and by the edit-mode buttons in `DriverEntry` and
  `ReserveList`, which are the same name in the same slot doing a different job. The
  mark used to be a dotted underline; it is the right convention for one link in a
  paragraph and the wrong one for forty-odd names on a page, which read as ruled paper
  and worst of all in dark. **The affordance is not restated per row** — the section
  header says "Select any name for its full ratings" once, which is also what pays for
  the trade: touch has no hover and so sees nothing until it taps. `bg-accent` and not
  `bg-muted` because a swapped-in driver's row already carries `SWAPPED_IN`, and the
  hover has to be visible on top of that fill. `components.test.tsx` counts the whole
  shared string against seats-plus-teams and asserts the word "underline" appears
  nowhere in a rendered grid.
- **The overall on a team card already has the engine in it**, via
  `carOverall(chassis, engine)` → the model's own `powertrain()`. Showing the bare
  chassis would be a number nothing races on. The popover behind it shows the parts instead:
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
  That claim is now two ratios, not one — 0.3 of pace and half of reliability — so a
  local copy would be twice as easy to get wrong. The card's rating rows come from
  `CHASSIS_RATINGS`, and they are the chassis as authored, not the blend.
