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

# Ordering and narrowing the lists

How the grid and the pool of drivers without a seat are arranged. The grid itself is
`web-grid.md`.

- **Both lists sort alphabetically or best first** (`sortBy`); best first is the
  default (the author's call). Teams sort on the plain team name, not the entry name.
- **The sort is one shared choice** (`lib/sort-preference.ts`, `localStorage`), so every
  switch moves together and the last pick opens the next visit; each `SortToggle` still
  needs its own radio group name.
- **The pool filters only narrow the list on screen**: a hidden driver can still take a
  seat, and who the run may sign is the settings' own pool (`web-run-settings.md`).
- **The filter rules live in `@alt-hist/data`**, re-exported by `lib/people.ts`, because
  the reseat and the signings read the same `matchesFilters`. Never copy them into the app.
- **Whoever is held is never hidden** (`keep` in `filterDrivers`), the one exemption; a
  driver just swapped out is filtered like anyone else, so the header states both counts.
- **One filter set for both modes**, in `localStorage`, read back field by field
  (`lib/filter-preference.ts`). The mode only picks the defaults, while nothing is stored.
- **In a test, a bare `checked=""` count also counts the sort radio**: match the input
  type too.
