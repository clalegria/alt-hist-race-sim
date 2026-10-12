---
paths:
  - "apps/web/src/lib/people.ts"
  - "apps/web/src/lib/sort.ts"
  - "apps/web/src/lib/sort-preference.ts"
  - "apps/web/src/lib/filter-preference.ts"
  - "apps/web/src/components/SortToggle.tsx"
  - "apps/web/src/components/ReserveList.tsx"
  - "apps/web/src/components/AgeRangeInput.tsx"
  - "apps/web/src/components/SeasonGrid.tsx"
  - "apps/web/src/components/SeasonView.tsx"
---

# Web app — ordering and narrowing the lists

How the grid and the pool of drivers without a drive are *arranged*, as opposed to what
they contain. `.claude/rules/web-grid.md` owns the grid itself and its editor.

## Ordering

- **Both lists can be reordered: alphabetically, or best first.** `SortToggle` sits on
  the grid header and on the `ReserveList` header; the rule behind it is `sortBy` in
  `lib/sort.ts`, unit-tested against synthetic ratings. **Alphabetical is the default
  and stays it**: the grid opens closed, and a page that opened on the pecking order
  would give it away unasked.
- **By rating is descending, and it is the app's one ranking rule**, `compareByRating`
  in `@alt-hist/data`: overall first, racing second. An overall is a *rounded* weighted
  average of integer ratings, so a tie is ordinary; racing carries most of its weight,
  so the racier of the two is the one the season treats as quicker. **Name is the last
  word**, free from sorting by name first and then by rating (`Array.prototype.sort` is
  stable). The same rule orders a team card's own two cars, the reseat (`arrange.ts`)
  and who a team losing a car carries over (`carryOver.ts`). `carRacing(chassis,
  engine)` is the car half of it, unrounded.
- **Each list shows the overall it sorts by** — `carOverall(chassis, engine)` and
  `driverOverall` — so a list agrees with the numbers down its right-hand edge.
- **What the switches are set to is one shared choice**, `lib/sort-preference.ts`, in
  `sessionStorage` for the session: sorting by rating is a way of reading, not a
  property of one list. The grid has a switch on all three places it is drawn (the
  opening grid, the editor, the season summary) and the pool its own; they move together
  through one `useSyncExternalStore` snapshot. The radio *groups* stay distinct
  (`team-sort`, `reserve-sort`), since the two render side by side in the editor. Not in
  the world state: a display choice is not part of a save file. `sessionStorage` rather
  than `localStorage` so a fresh visit opens alphabetical again.
- **Native radios in a fieldset**, visually hidden behind their labels: arrow keys and
  the group announcement come free, and a DOM-less test can read `checked=""`. A bare
  `checked=""` count catches the sort radio as well as the filter checkboxes, and React
  writes `checked` *before* `value`, so tests parse the input's attributes.

## Narrowing the pool

- **The filters only narrow the list on screen.** Three in `ReserveList`: hide anyone
  whose real career had ended before this season (`finalSeason`), anyone whose career
  had not begun (`debutSeason`), and an age range. Nothing else reads them: a hidden
  driver is missing from a list, not barred from a seat, and who the run may *sign* is
  the settings' own pool (*Drivers who can be signed*, `web-run-settings.md`). The pool
  is filtered first and ordered second.
- **The age is the rating mode's**, `ratedAge` in `lib/people.ts`: the season's age under
  `aged`, the age at `peak.season` under `peak`, the age the ratings on the row describe.
  Against peak age every driver sits in a plausible racing band, so the widest range
  reaches the whole pool. The row reads "Peak age" under `peak`. It is `AgeRangeInput`,
  shared with the settings: the ends cannot cross (`withAge`), and a box emptied or
  half-typed ("2" on the way to "25") holds the last value until it is left (`typedAge`,
  `leftAge`). `AGE_RANGE` caps it at 16–56.
- **What the filters open on** is `defaultDriverFilters`: aged 18–42, the career filters
  **on** under `aged` (the drivers who were around that year) and **off** under `peak`.
  The mode decides only the opening set: a set the reader chose is kept across a mode
  switch, and the defaults are re-laid only while nothing has been stored
  (`useReserveFilters` in `ReserveList.tsx`).
- **The set is remembered** in `localStorage` (`lib/filter-preference.ts`), one set for
  both modes, since the editor re-mounts on every applied grid. Read back **field by
  field**, ages clamped and put the right way round, so a new filter later does not
  throw away a stored set.
- **Whoever is selected is never hidden**, so a held driver can be put down again — the
  *only* exemption (`keep` in `filterDrivers`). A driver just swapped off the grid is
  filtered like anyone else, which is why the header states both counts ("18 of 23
  drivers available") and an empty result says so in words.
- **Controlled** — held by the editor, passed down — so a DOM-less test renders any state
  the list can be narrowed to. The rules are pure functions in `@alt-hist/data`
  (`people.ts`, re-exported by `lib/people.ts`), because the run's reseat and signings
  read the same `matchesFilters` (`data-layers.md`), and are unit-tested against
  synthetic careers in `lib/people.test.ts`.
