---
paths:
  - "apps/web/src/lib/names.ts"
  - "apps/web/src/components/DriverName.tsx"
  - "apps/web/src/components/TeamName.tsx"
  - "apps/web/src/components/FittedName.tsx"
  - "apps/web/src/components/EntryNames.tsx"
  - "apps/web/src/components/CompactStandings.tsx"
  - "apps/web/src/components/Flag.tsx"
---

# Naming a driver, a team and an entry

How every table names the same people. Which era's name a team is in is `team-eras.md`.

- **Every driver and team is named through `DriverName` / `TeamName`**, so a flag sits
  beside every name everywhere. Never draw a name with its own flag markup.
- **A name alone in a table cell is set in `TIMING_NAME`**: a driver through `SplitName`
  (given name plain, surname per `nameParts`, as `shortName` splits it), a team whole, by
  `TeamName`'s default. Prose passes `capitals={false}` and uses plain `driverName`; the
  team line under a driver stays plain. The look is `docs/style/timing-tower.md`.
- **An entry is "Williams-Ford"; a works team keeps its bare name** (`entryName`). Lists
  sort on the plain team name, so a team does not move for changing supplier.
- **The engine supply and the name's year travel by context** (`EntryNames`, `KeptNames`),
  built from `world.field`. The empty default must leave a component rendered alone
  drawable.
- **`FittedName`'s caller gives it the width it may use** (`flex-1`, or a block in a
  column): a content-sized box measures the short name and never widens back. Its
  `render` draws the probe too, so a styled name is measured styled.
- **`tight` is opted into per table**: the race sidebar fits names to its column, the full
  classification wraps them. Don't unify the two without deciding which behaviour wins.
- **Tests count flags by counting `<svg>`**, so nothing else beside a name may be an
  inline SVG: the badge, the chevron, the page icon and the chart legend's marks are CSS.
  The team car is the one SVG; flag counts skip it with `svgsBesideCars` (`test-support.ts`).
- **`Flag.tsx` imports every flag in `country-flag-icons`**; never trim it to a subset.
