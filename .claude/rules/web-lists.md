---
paths:
  - "apps/web/src/lib/people.ts"
  - "apps/web/src/lib/sort.ts"
  - "apps/web/src/lib/sort-preference.ts"
  - "apps/web/src/lib/filter-preference.ts"
  - "apps/web/src/components/SortToggle.tsx"
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/AgeRangeInput.tsx"
  - "apps/web/src/components/SeasonGrid.tsx"
  - "apps/web/src/components/SeasonView.tsx"
---

# Web app — ordering and narrowing the lists

How the grid and the pool of drivers without a drive are *arranged*, as opposed to what
they contain. Split out of `.claude/rules/web-grid.md`, which still owns the grid itself
and its editor; both load together in `src/components/`.

- **Both lists can be reordered: alphabetically, or best first.** `SortToggle` sits on
  the grid header and on the `ReserveList` header, and the rule behind it is `sortBy` in
  `lib/sort.ts` — a pure function, unit-tested against synthetic ratings for the reason
  the pool filters are. **Alphabetical is the default and stays it**: the grid opens
  closed for a reason, and a page that opened on the pecking order would give it away
  unasked. By
  rating it is *descending* — "sorted by rating" means "show me the front of the grid" —
  and it is **the app's one ranking rule, `compareByRating` in `@alt-hist/data`: overall
  first, racing second.** Ratings are integers on a 1-100 scale and an overall is a
  *rounded* weighted average of five of them, so two cars on 84 is ordinary rather than
  exotic; racing carries most of that weight and is the only rating the race score reads
  directly, so the racier of the two is the one the season will treat as quicker, and
  answering such a tie alphabetically answers a question nobody reading a rating column
  is asking. **Name is the last word**, and it comes free from sorting by name first and
  then by rating, since `Array.prototype.sort` is stable — two rows level on both hold
  still instead of trading places between renders.
  The same rule orders a team card's own two cars, ranks the seats and the drivers in the
  editor's bulk rearrangements (`arrange.ts`), and picks who a team losing a car carries
  over (`carryOver.ts`), so a list and a rule applied to it cannot disagree about who is
  quicker. `carRacing(chassis, engine)` is the car half of it — the blend, unrounded,
  because the rounding is the thing that made the tie.
  Each list gets the switch it needs where it needs it: the grid has one on all three
  places it is drawn — the opening grid, the editor, and the season summary, where the
  pecking order is the point rather than a spoiler — and the pool has one of its own.
  **What they are set to is one shared choice**, in `lib/sort-preference.ts`, remembered
  in `sessionStorage` for the session. Sorting by rating is a way of *reading*, not a
  property of one list: the three used to hold three pieces of `useState`, and what that
  produced was a reader setting "Rating" on the grid, opening the editor, and being
  handed an alphabetical pool. Setting it anywhere sets it everywhere, and the switches
  move together because they subscribe to one `useSyncExternalStore` snapshot. The
  radio *groups* stay distinct (`team-sort`, `reserve-sort`) — the pool renders beside
  the grid while the editor is open, and two groups sharing a `name` would move together
  for the wrong reason. It is **not** in the world state: a display choice is not part
  of a save file. `sessionStorage` rather than `localStorage` because the alphabetical
  default has a reason behind it and a fresh visit should still open on it.
  Both switches show the same overall the rows already show —
  `carOverall(chassis, engine)` and `driverOverall` — so a list agrees with the numbers
  down its own right-hand edge. The pool is **filtered first and ordered second**; the counts
  in its header describe the filtering only.
  The control is **native radios in a fieldset**, visually hidden behind their labels,
  for the reason the filters are native checkboxes: arrow-key navigation and the group
  announcement come free, and a DOM-less test can read which option carries `checked=""`.
  Two collisions that cost time once: a bare `checked=""` count now catches the sort
  radio as well as the filter checkboxes, and React writes `checked` *before* `value`,
  so tests parse the input's attributes rather than matching them as one string.
- **The pool of drivers without a drive can be narrowed, and only that list.** Three
  filters in `ReserveList`: hide anyone whose real career had ended before this season
  (`finalSeason`), hide anyone whose career had not begun (`debutSeason`), and an age
  range. All three read seed data that already existed; none of them reach the
  simulation, and none of them touch the grid itself — a hidden driver is missing from a
  list, not barred from a seat. `AGE_RANGE` caps how far the range opens, at 16-56.
  **Which age the range reads is the rating mode's answer, not the calendar's** —
  `ratedAge` in `lib/people.ts`. In `aged` mode it is the age in the season on screen;
  in `peak` mode it is the age the driver was in `peak.season`, which is the season the
  ratings on the row actually describe. Both halves matter. The *display* has to say the
  same thing the numbers beside it do — printing "1980 minus his birth year" next to a
  driver's 1954 ratings describes nobody. And the *filter* is what makes a field of the
  best drivers ever possible at all: against season age, most of the pool is a child or
  a pensioner in whatever year is loaded and no range reaches them, however the ratings
  read. Against peak age every driver sits in a plausible racing band (21-54 across the
  whole pool today), so opening the range fully reaches all of them. The age row is
  labelled "Peak age" rather than "Aged" in `peak` mode, or the numbers are read as
  season ages and the list looks broken when someone from another decade survives it.
  The row is `AgeRangeInput`, shared with the settings' *Drivers who can be signed*:
  the ends cannot cross (`withAge`), and a box the reader empties or is still typing
  into ("2" on the way to "25") holds the range's last value until they leave it
  (`typedAge`, `leftAge`).
  **What the filters open on depends on the mode too** — `defaultDriverFilters`. Aged
  18-42 either way; the two career filters open **on** in `aged` mode, so the list shows
  the drivers who were actually around that year, and **off** in `peak` mode, because a
  grid built from authored peaks is already out of time and enforcing a chronology the
  mode has set aside is the app arguing with itself. They stay on the panel and still
  work, so "the drivers of 1980, at their best" is one click away. **That is all the
  mode decides**, and only until the reader has answered for themselves: switching mode
  never touches a set they set by hand. It used to lay the defaults down again on every
  switch, on the argument that the age range means a different thing on either side —
  which does not survive contact with a reader who has just narrowed the pool and
  flipped to peak to see the same people at their best. What is left of that argument is
  one line: while nothing has ever been stored, a mode switch re-lays the new mode's
  defaults, so a first flip to `peak` still opens on the field of all-time greats the
  mode exists for rather than on 1980's entry list.
  **The set is remembered**, in `lib/filter-preference.ts`, and there is one of it. The
  editor is re-mounted every time a grid is applied — an applied grid re-simulates the
  year — so filters that lived only in component state were filters set again on every
  single visit, and widening the range to reach a driver from another decade is four
  interactions. `localStorage`, not the session, and that is the split from
  `sort-preference.ts` beside it — an order is a way of reading one list, but how wide
  the pool is opened is a standing answer to which drivers someone is playing with,
  closer in kind to the ability mode. A stored set cannot strand anyone: the panel is on
  screen with the values in it and the list states both counts. Reading falls back
  **field by field**, so adding a fourth filter later does not throw away every set
  already stored, and the ages come back clamped and put the right way round.
  Without the age band, a pool spanning 1950 to 2026 is a list nobody can use. Casting a
  driver in a car they never raced is still the premise of the app; the filters are
  three clicks from off and nothing they hide is barred from a seat.
  One rule keeps the filters from producing a dead end: **whoever is selected is never
  hidden**, because a driver being held has to stay on screen to be put down again. That
  is the *only* exemption — `keep` in `filterDrivers` holds the selection and nothing
  else. A driver the season entered is **not** exempt: losing a seat puts them in the
  pool on the same terms as everyone else, and a list that quietly excused some of its
  rows would be a list whose counts lie. Reaching such a driver again is the same move
  as reaching anyone else the filters hide — widen the filters — which is why the panel
  always states both counts ("18 of 23 drivers available"): a list that silently shrinks reads
  as an app that lost half its drivers. An empty result says so in words rather than
  showing a blank panel.
  The filters are **controlled** — held in `GridStage` beside the lineup draft, passed
  down — for the reason everything in the editor is: a DOM-less test can then render any
  state the list can be narrowed to. The rules themselves are pure functions, unit-tested
  against synthetic careers in `lib/people.test.ts`, because what a filter does is a rule
  and a test reading a real career fails the day the data is corrected. The controls are
  a native checkbox and a native number input, for the reason the engine picker is a
  native `select`.
  **They live in `@alt-hist/data` now, and `lib/people.ts` is a re-export** — the
  arrangement `lib/rating.ts` has, and for the same reason. The grid editor's bulk rules
  promote drivers *out of this pool*, so `arrange.ts` reads the very same
  `matchesFilters` against the very same set: widening the age band to 45 has to add
  those names to the grid and not only to the list. A filter stopped being purely a way
  of reading a list at that point and became an input to a rule a season is run on, which
  is a thing the data package must be able to see. `.claude/rules/data-layers.md` owns
  the module; everything above still describes what the panel *means*. A snapshot of the
  set travels inside each `GridArrangement`, so a rule kept across an era does not depend
  on where the slider sits three seasons later —
  `.claude/rules/grid-arrangements.md`.
