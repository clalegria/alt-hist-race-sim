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
Downstream of the grid — the sessions, the tables, the accent — is
`.claude/rules/web-display.md`; naming is `.claude/rules/web-names.md`, the card
liveries `.claude/rules/web-liveries.md`, and how either list is *ordered* and the pool
*narrowed* is `.claude/rules/web-lists.md`, which loads here too. Why the draft lives in
component state rather than the store is `.claude/rules/web-store.md`.

- **The grid is a `Card`, like every results panel** (`SeasonCalendar`,
  `StandingsTable`, each `Section`); a bare panel lets the background checkerboard run
  through it. Its header is `CardHeader` with `flex-row` overriding the default
  `flex-col` through `cn`, which keeps the sort switch and the Edit/Apply buttons
  opposite the title rather than stacked under the description. The **team tiles inside
  stay `bg-card` on a `bg-card` panel**, drawn by their borders and liveries and not by
  a fill step — the qualifying grid nests the same way, and it is the case
  `.claude/rules/web-styling.md` means when it says the border draws the panel on dark.

- **The grid opens closed.** Teams and drivers with a flag, an age and one overall
  rating; the individual ratings live behind a popover, and teams are listed
  alphabetically by default so the pecking order is not given away before a wheel
  turns. A test asserts no rating label appears in the closed markup. The age on a
  row is `ratedAge` — the age the ratings beside it describe, which under `peak` is the
  driver's age at their peak and not their age in the year loaded. `SeasonGrid` takes
  `ratingMode` for that and for `ArrangementNote`'s wording: the ratings arrive already
  resolved on the entrants, and the age does not.
- **Inside a card, drivers are in ranking-rule order** (`compareByRating`, then name),
  in `seatsInOrder` — the same `sortBy("overall")` the team list uses, ties and all.
  Which of a team's drivers is its *first* driver is the one comparison a card exists to
  make, so unlike the team order it does not follow the sort switch: a card is a pairing
  and not a league table.
  **It returns `{ entrant, seat }` pairs rather than reordered entrants.** The seat
  index is a `SeatRef` to the editor — what an empty seat is selected and filled by, and
  what the React key is — so it has to keep meaning the seat the season entered rather
  than the row this ordering produced. An empty seat carries all-zero ratings and so
  falls to the bottom of the card with no case of its own.
- **A clickable name is marked by a fill, never an underline.** `NAME_TARGET` in
  `SeasonGrid.tsx` is the one definition — nothing at rest, `bg-accent` under the
  cursor or the keyboard focus, and the same fill held while a panel is open — shared
  by the popover triggers and by the edit-mode buttons in `DriverEntry` and
  `ReserveList`, which are the same name in the same slot doing a different job. An
  underline under every name reads as ruled paper. **The affordance is not restated
  per row** — the section header says "Select any name for its full ratings" once.
  `bg-accent` and
  not `bg-muted` because a swapped-in driver's row already carries `SWAPPED_IN`, and the
  hover has to show on top of that fill. `components.test.tsx` counts the whole shared
  string against seats-plus-teams and asserts "underline" appears nowhere in a grid.
- **The overall on a team card already has the engine in it**, via
  `carOverall(chassis, engine)` → the model's own `powertrain()`; a bare chassis is a
  number nothing races on. The popover's header is the card's flag, badge and name, then
  the team's car (`web-team-car.md`). Below it the popover shows the parts: the four chassis
  ratings (`CHASSIS_RATINGS`, the chassis, not the blend), then the
  engine's three under its own heading — an engine has no consistency, so that panel is
  one row shorter, which is the point rather than an omission. A car with an authored
  `developmentTrend` gets a third panel, a bar filling from the **middle** — zero is a
  real value there, not the bottom of a scale — plus a sentence saying what it means.
  It is deliberately **not** in `carOverall`: a trend rotates pace about mid-season, so
  the overall already *is* the average of its year. A test renders the grid with a
  trend on every car and asserts the markup is unchanged.
  `.claude/rules/car-development.md`.
- **The driver popover** lists the six ratings in `DRIVER_RATINGS` order, "Wet weather"
  between composure and the muted adaptability row.
- **The grid can be rearranged: drivers by swapping, engines by picking.** `Edit grid`
  turns every driver row into a select button, puts a supplier `select` on every team
  card, and opens `ReserveList` — everyone in the pool without a seat — as a sticky
  sidebar; the team cards drop from three columns to two to make room. Select a driver,
  then whoever takes the seat: seated ↔ reserve, or seated ↔ seated between two teams.
  The whole interaction is the pure `pickUp`. Nothing here can *add* a car, by
  construction rather than by validation — and the engine picker offers only what the
  season rates, so nothing can invent a supplier either. A native `select` because the platform
  control is keyboard- and screen-reader-correct for free.
- **A chassis can be made stronger or weaker, in the editor only.** Each card has a
  labelled Chassis row under the Engine picker (one `ROW_LABEL` width, so the two line
  up), whose − and + move all four chassis ratings by one (`stepChassis`). Its own row
  because a stepper in the header took its width out of the team name. After the
  buttons the row says what moved **in words** (`chassisSummary`: "+2 each", or "racing
  +3, reliability −1"), never a number beside the overall: the overall blends chassis
  and engine and weights racing heavily, so +4 reliability moves it about 0.2. The team
  popover gives each chassis rating its own stepper with that rating's change between
  the buttons (the popover widens to `w-96` for it). The grid with the editor shut has
  none, and the engine panel never does. A button is disabled once nothing it would
  move can move further. A step is a hand edit and ends a bulk rule, since the rules
  rank the cars.
- **Three buttons reseat the whole field at once** — fastest drivers in fastest teams,
  fastest in slowest, shuffled — in their own panel above the cards. **The cast they
  draw on is this editor's own pool filters**, so whoever the "Without a drive" panel is
  showing is whoever may be promoted. `.claude/rules/grid-arrangements-app.md` (which
  loads here too) has the panel and why a hand edit ends a rule;
  `.claude/rules/grid-arrangements.md` has the rules themselves.
- **`Copy <year> grid` puts last season's drivers over this one**, and is the reason
  the editor has an empty-seat state at all. It reads the *previous playable* season —
  `adjacentSeason(year, -1)`, so a gap in the seed data is skipped — and is not drawn
  at the start of the authored range. The rules live in `packages/data/src/carryOver.ts`;
  what belongs here is where it reads from and what it does to the draft:
  - Inside an **era** it copies the grid the reader actually raced, not the seed file:
    `App.tsx` finds last year in `run.seasons` and passes its `lineup` down through
    `SeasonView` as `previousLineup`. A standalone season passes null and gets history,
    which is the only version of last year it has.
  - It composes onto the **draft**, not the applied grid, so it can be pressed after
    other changes and twice in a row without meaning something different the second
    time. Whatever is held is put down first.
- **A seat can be empty, but only mid-edit.** Carrying drivers back to last year's
  teams leaves the cars they were in this year with nobody in them, and there is no
  sensible automatic answer to "who drives it" — so the reader is asked. An empty seat
  is a `GridPick` like a driver is: select it, then a name. `Apply grid` is **disabled**
  while one is open, and a notice at the top of the card counts them.
  Swapping never adds one: moving a seated driver into an empty seat empties the seat
  they left, so the count is unchanged — which is why the fixture in
  `grid-editor.test.tsx` writes one out rather than clicking it into existence.
  - `buildField` cannot make an entrant with no driver, so **`previewField` in
    `GridStage` splices placeholder entrants in**: the team's own chassis and engine,
    the `EMPTY_SEAT` sentinel as the driver id, zeroed ratings. That is what keeps
    `SeasonGrid` a plain function of a field — otherwise a team whose every seat was
    open would vanish from the page the reader has to fill it in on. Nothing simulated
    ever sees one: the field is drawn and thrown away, and the draft behind it cannot
    be applied.
- **An edited grid says so, in the same muted dashed frame everywhere.** Deliberately
  *not* the `lib/highlight.ts` accent: "the grid was changed" is a caveat on a result,
  not something that was won, and borrowing the accent would also break the test that
  counts exactly two accented cards per summary. A driver who is not where history put
  them carries the same soft fill (`SWAPPED_IN`) in the grid, and so does the header of
  a team running an engine it was not given, so the note and the cards agree without the
  reader matching names; a re-rated chassis marks the header the same way. The summary
  declares it **twice** — `EditedGridBanner` above the champions, because finding out
  at the foot of the page is too late, and the full list on the grid at the end.
  **Every kind of change shares one notice**, in `GridChanges`: one row per team, "Alain
  Prost for Jody Scheckter", "Renault engine for Ferrari" and the chassis on the same
  line if all happened. `chassisNote` says "Chassis +2" when all four ratings moved
  together and "Chassis: racing +3, reliability −1" otherwise. `changeCount` totals
  seats, engines and chassis, a re-rated chassis counting once per team.
- **`lib/rating.ts` is a re-export** of `driverOverall`, `carOverall`, `carRacing` and
  `compareByRating` from `@alt-hist/data`: a **display heuristic, not model truth** —
  nothing in the engine reads it. The weights, why reliability and adaptability sit
  where they do, and why the engine is folded in through `powertrain()` rather than
  weighted locally are `.claude/rules/data-layers.md`; they move by hand, so do not
  copy them here or re-implement them in the app.
