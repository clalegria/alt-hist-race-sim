---
paths:
  - "apps/web/src/routes/run/drivers.tsx"
  - "apps/web/src/routes/run/teams.tsx"
  - "apps/web/src/routes/run/driver/**"
  - "apps/web/src/routes/run/team/**"
  - "apps/web/src/components/PersonPages.tsx"
  - "apps/web/src/components/RosterIndex.tsx"
  - "apps/web/src/components/people-pages.test.tsx"
  - "apps/web/src/lib/roster.ts"
  - "apps/web/src/lib/roster-places.ts"
  - "apps/web/src/lib/roster.test.ts"
  - "apps/web/src/components/LiveryBarcode.tsx"
  - "apps/web/src/lib/barcode.ts"
  - "apps/web/src/lib/barcode.test.ts"
---

# The people pages

A page per driver and per team, and the two index lists (`PersonPages`, `RosterIndex`,
`lib/roster.ts`, `lib/roster-places.ts`). The router and the gate are `web-routing.md`.

- **They are an era's**: in a one-year run `resolveRosterPage` sends every people URL to
  the season page, and `RunFrame` passes no `pageOf`, so nothing links to one.
- **A team's page is keyed by lineage id**: one address for every name it raced under.
- **The roster is everyone in the field of a year reached** (`rosterOf` over
  `revealed(run).years`): someone on the cursor's grid has a page, someone only on a grid
  ahead must not. The figures come off the championship tables, never the roster.
- **An id is untrusted**: a malformed one (`parseId`) or one off the roster redirects to
  its index, in `guardRosterPage` and again on render, since a restart can remove someone.
- **The pages take the revealed years and an id, never the store.**
- **A name is never a link, except on an index.** Everywhere else it opens its career
  panel; the page icon (`PageLink`) sits in that panel's heading and in the grid's
  popovers (`usePageOf`). No icon beside a name in a table, card or list.
- **Both pages show up to three cars** across from the name (`ShowcaseCars`,
  `lib/car-showcase.ts`), a driver's in each year's team: the first of the run, one picked
  at random from the years between and the latest, each only if its drawing or livery
  differs from the others'. The latest shows first as the width grows, then the first,
  then the one between; a phone has none.
- **Both pages draw a livery barcode under the heading**, a stripe per season from the
  first authored one to the run's year, never past it: the years before the run off the
  entry lists (`seasonsBefore`, `driverSeasonsBefore`), the run's off its grids. A driver's
  stripe is that year's team. Livery drawn as authored, like a badge, not through
  `legible()`: the badge's stripes as a band along the bottom (`barcodeBackground`), never
  an accent the badge doesn't draw; a year sat out is a chequer. The teal caret marks the run's year. A stripe's
  tooltip names its team on every driver's, and on a team's only once it has had two names.
- **An index's order is a search param** (`indexSearch`), the default left out of the
  URL; `sortIndex` is total, ending on the id.
- **On a phone an index row is the name, wins, points and the sorted column**; a page's
  season-by-season keeps points and wins, as a standings row does. Neither scrolls.
