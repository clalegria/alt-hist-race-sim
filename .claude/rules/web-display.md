---
paths:
  - "apps/web/src/lib/highlight.ts"
  - "apps/web/src/lib/results.ts"
  - "apps/web/src/components/QualifyingResults.tsx"
  - "apps/web/src/components/RaceClassification.tsx"
  - "apps/web/src/components/SeasonView.tsx"
  - "apps/web/src/components/SeasonStandings.tsx"
  - "apps/web/src/components/StandingsTable.tsx"
  - "apps/web/src/components/RaceByRace.tsx"
  - "apps/web/src/components/DisclosureButton.tsx"
  - "apps/web/src/components/CompactStandings.tsx"
  - "apps/web/src/components/TitleBanner.tsx"
---

# Drawing the sessions and the standings

The accent, the session sheets and the championship tables.

- **One accent (`lib/highlight.ts`) means "won the thing on screen"**: pole, a race
  winner, each champion, and the sidebar's champion row from the round the title is
  settled. One accented row or card per view; never give it a second meaning.
- **Second and third get the half-strength podium accent, in the race classification
  only.** No accent string may be a substring of another, because tests tell rows apart
  by substring; `PODIUM_TEXT` does contain `STANDOUT_TEXT`, so a count of that allows for it.
- **The title banner shows on the round that settles it, and only that one.**
- **The qualifying stagger is a `translate-y` of exactly half the row height**, never a
  margin; a test holds the two numbers at 2:1.
- **The classification wraps rather than scrolls**: its prose columns wrap, its numeric
  columns never. Its tighter padding goes on each cell through `cn`, not a `[&_td]:` variant.
- **Expansions are unaccented** (`RaceByRace`): a win is marked by weight, a retirement by
  `text-loss`.
- **`SeasonStandings` is the one drawing of a championship**, used by the season summary
  and by a year opened from the roll of honour; `StandingsTable` serves drivers and teams.
  Never copy it per screen. Its `badge`, `car` and `charts` props default off.
- **A team's expansion is a row per car, ordered by championship finish; a round a
  competitor missed is left out, not blanked** (`lib/results.ts`). It walks the same rows
  as the standings, so its points must add up to the row above.
- **A row that opens uses `DisclosureButton`.** Where its text is a name, the chevron
  stands alone with a `label` (the two-control row, `web-careers.md`). `PageLink` sits
  beside the chevron, never inside it: a link cannot go inside a button.
