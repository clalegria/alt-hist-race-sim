---
paths:
  - "packages/data/src/keptGrid.ts"
  - "packages/data/src/keptGrid.test.ts"
  - "apps/web/src/lib/kept.ts"
  - "apps/web/src/components/TeamsSetting.tsx"
  - "apps/web/src/components/teams-setting.test.tsx"
  - "apps/web/src/components/WhoDrivesSetting.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/components/grid-arrangement.test.tsx"
  - "apps/web/src/store/season.ts"
---

# Teams and seats

The two run settings that decide who sits where before a race: *Teams: The first
season's teams* (the kept grid, `keptGrid.ts`) and *Who drives where* (the reseat,
`arrange.ts`).

- **Both are the year's starting grid, not edits.** The world keeps their results
  (`kept`, `keptSeats`, `reseated`) and `enteredSeason` applies them, so Restore, Clear
  all edits and every change notice measure hand edits from them.
- **`baselineSeason` (`store/season.ts`) is the one place either reaches a season**,
  in a fixed order: the kept season, the run's own cars (`withRunCars`), the signings
  (`fillSeats`), then the reseat. Drivers are ranked on the cars the run races, so
  nothing that ranks drivers may move ahead of the car rolls.
- **One signing pool**, `RunSettings.driverPool`, feeds the kept grid's empty seats and
  the reseat alike; never give either its own band or filter.
- **A hand edit never ends a reseat**: next year is reseated on its own entry list. An
  era carries the setting, never a lineup, and the grid editor offers no rule of its own.
- **`kept` is an input, not a derived value**: an action that rebuilds a year in place
  passes it on, and the next year comes only from `keptYearAfter`, so stepping, jumping
  and reloading a recipe build the same year.
- **The reseat's dice are the season's seed through their own `createRng`**, never the
  races' stream. A new action that rebuilds a year decides on purpose whether it keeps
  the seed (same reseat) or takes a fresh one (a new throw).
- **What these settings did is said in their own notes** (`KeptNote`, `ArrangementNote`,
  `keptNotes`), never in the edited-grid notice or the summary's banner, which list hand
  edits only; a kept or signed driver is never marked as swapped in.
