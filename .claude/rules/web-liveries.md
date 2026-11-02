---
paths:
  - "apps/web/src/lib/livery.ts"
  - "apps/web/src/components/TeamBadge.tsx"
  - "apps/web/src/components/Liveries.tsx"
  - "apps/web/src/components/livery.test.tsx"
---

# Team colours

How a livery reaches the page. What a livery is, and its eras, is `team-eras.md`.

- **`lib/livery.ts` is the one place a livery is resolved** (the era, then a season's
  all-or-nothing override). Display only: nothing in the engine reads one.
- **The year travels by the `Liveries` context**; its empty default gives each team's
  most recent colours. `SeasonGrid` is handed its year and draws `LiveryBadge` and
  `LiveryCar`, never the context-reading `TeamBadge` and `TeamCar`.
- **The badge and the grid card's corner are CSS on a `span`, never an SVG**
  (`web-names.md`), and draw the livery as authored.
- **A badge is opted into per call site** (`badge`, default off). **Nothing that only
  appears after a click wears one.** The one exception, by the author's call: the grid
  card's team panel header repeats the card's flag, badge and name. A panel listing other
  teams still badges none of them.
- **Count badges by `BADGE_SHAPE` and corners by `CORNER_SHAPE`, never by `aria-hidden`**,
  which chevrons, spacers and the theme toggle carry too. Keep the size out of
  `BADGE_SHAPE`: tailwind-merge drops the marker when a call site resizes the badge.
- **A team colour drawn as a line on a theme surface goes through `legible()`**, pulled by
  `--line-pull` (`index.css`, one per theme). Keep it declared in both themes and between
  0 and 100%, and never use `oklch(from …)` there: an invalid declaration vanishes the colour.
