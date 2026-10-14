---
paths:
  - "packages/data/src/teams.json"
  - "packages/data/src/eras.ts"
  - "packages/data/src/types.ts"
  - "apps/web/src/lib/names.ts"
  - "apps/web/src/lib/livery.ts"
  - "apps/web/src/components/Liveries.tsx"
  - "apps/web/src/components/EntryNames.tsx"
  - "packages/data/src/identity.ts"
---

# Team eras

A team's name, base and livery are era lists on one lineage `id`; how to read them.

- **The id is the lineage's first name**: the modern Mercedes is `tyrrell`, Red Bull is
  `stewart`, Alpine is `toleman`. The ids `honda`, `mercedes` and `aston_martin` are only
  those names' first teams.
- **Never key anything off a team's name.** One name belongs to several lineages, even in
  one season (2011 has two teams called Lotus). Saves, targets and lookups use `teamId`.
- **Every name, flag and colour is read at a year**, through `teamIdentityIn` /
  `teamLiveryIn` (`eras.ts`, the only indexers). On screen that year comes from the
  hooks in `EntryNames.tsx` and `Liveries.tsx`, so the run's *keep* settings apply; only
  a component handed a year of its own (`SeasonGrid`, the editor's draft) passes it.
- **An era is a substantial change**, not a season's drift. A span of years gets a
  `LiveryEra`; a season entry's livery override is for a single odd year.
- Liveries are researched with the `livery-research` skill, which also checks each grid
  for clashing colours.

## Keeping the first name, livery or engine
- *Team name changes*, *Livery changes* and *Engine supplier changes: No* are three
  settings, each with its own `keptFrom` on the `World` (`namesKeptFrom`,
  `liveriesKeptFrom`, `enginesKeptFrom`). All go through `firstYearInRun`: a year, not a
  name, so everything still resolves through the era lists.
- `buildField` takes the names' `keptFrom`, because the base is what pays home advantage.
- **Never route a car drawing through a kept year**: a car's shape follows the season.
- A kept livery can meet a later team in the same colours. Accepted, and the setting's
  note says so: don't add a clash check for it.
