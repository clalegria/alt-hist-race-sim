---
paths:
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/useGridDraft.ts"
  - "apps/web/src/components/ReserveList.tsx"
  - "apps/web/src/components/SeasonGrid.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/lib/rating.ts"
---

# The grid and its editor

The opening grid (`SeasonGrid`) and the editor around it (`GridStage`, `useGridDraft`,
`ReserveList`). How the lists are ordered and the pool narrowed is `web-lists.md`.

## The grid
- **The grid opens closed**: one overall per row, teams alphabetical, the individual
  ratings behind a popover. Never put the pecking order on the opening page by default.
- **An age is `ratedAge`**, the age the ratings beside it describe (peak age under
  `peak`). Ratings arrive resolved on the entrants and ages don't, so whatever draws an
  age takes the rating mode.
- **`SeasonGrid` is a plain function of the field it is handed**, never the `EntryNames`
  or `Liveries` context, so the editor can draw a draft the world has never seen.
- **A card's drivers follow the ranking rule whatever the sort switch says.**
  `seatsInOrder` returns `{ entrant, seat }` pairs: the seat index is the editor's
  `SeatRef`, so never reorder the entrants themselves.
- **A clickable name is marked by a fill, never an underline**: `NAME_TARGET` is the one
  definition, shared with the editor's buttons, and tests count it as a marker.
- **A development trend never enters `carOverall`** (`Development` in `SeasonGrid` says why).
- **`lib/rating.ts` re-exports `@alt-hist/data`**: the overall's weights and
  `compareByRating` are shared with the reseat. Never re-implement them in the app;
  nothing in the engine reads the overall.

## The editor
- **The editor changes only this grid**; a choice about the whole run is a setting
  (`teams-and-seats.md`). Its drafts are component state until Apply (`web-store.md`).
- **It can only swap**: drivers through `pickUp`, engines among the suppliers the season
  rates, chassis and engine ratings by one-point steps. Nothing may add a car or invent a
  supplier.
- **An empty seat exists only mid-edit** (after `Copy <year> grid`), and Apply is disabled
  while one is open. `previewField` splices in `EMPTY_SEAT` placeholders so a team with
  no driver still draws; nothing simulated may ever see one.
- **`Copy <year> grid` reads the previous playable season**: in an era the lineup as raced
  (`App.tsx` → `SeasonView` → `previousLineup`), otherwise history; it composes onto the
  draft. The carry-over rules are `packages/data/src/carryOver.ts`.
- **A chassis or engine change is said in words** (`chassisSummary`, `engineSummary`),
  never as a number beside the overall. Steppers appear only in the editor.
- **An engine step is per engine** (`stepEngine`, `World.engineRatings`): it moves every
  team running it, so the notice lists it once per engine, never per team.
- **Clear all edits sets every edit part to null**; the run's rolled cars, kept seats and
  reseat stay, being the baseline.
- **An edited grid is marked by the muted dashed frame and `SWAPPED_IN`, never the
  `lib/highlight.ts` accent**: it is a caveat, not a win. Every kind of change shares one
  notice, one row per team (`GridChanges`).
