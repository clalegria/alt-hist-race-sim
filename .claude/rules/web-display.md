---
paths:
  - "apps/web/src/lib/highlight.ts"
  - "apps/web/src/components/ui/table.tsx"
  - "apps/web/src/components/ui/card.tsx"
  - "apps/web/src/components/ui/notice.tsx"
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
  - "apps/web/src/components/EraChampions.tsx"
---

# Drawing the sessions and the standings

The accent, the session sheets and the championship tables.

- **One accent (`lib/highlight.ts`) means "won the thing on screen"**: pole, a race
  winner, each champion, and the sidebar's champion row from the round the title is
  settled. One accented row or card per view; never give it a second meaning.
- **A row with a rank carries the accent on its `TablePosition` block, never as a row
  tint**: the winner's block filled (`STANDOUT_POSITION`), second and third's number in
  the accent (`PODIUM_POSITION`, race classification only). `STANDOUT_ROW` is for a row
  with no block (the roll of honour).
- **Tests tell accents apart by substring**: `STANDOUT_POSITION` contains
  `PODIUM_POSITION` (`STANDOUT_TEXT`), so a podium check also asserts the fill's absence.
- **An opened row is `TableExpansion`**: its `data-expansion` keeps the stripes in step.
- **The title banner shows on the round that settles it, and only that one.**
- **The qualifying stagger is a `translate-y` of exactly half the row height**, never a
  margin; a test holds the two numbers at 2:1.
- **The classification wraps rather than scrolls**: its prose columns wrap, its numeric
  columns never. Its tighter padding goes on each cell through `cn`, not a `[&_td]:` variant.
- **A phone's classification row is position, name, gap and points**: the car, Grid and
  Status show from `md`, and below it the gap column says DNF or DNQ in `text-loss`.
  A standings row is position, name, points and wins; Pods and Poles show from `sm`.
- **The roll of honour restacks on a phone, never scrolls** (`RESTACK`): one set of cells
  at every width, so a name stays one control; each row is its own grid, so its columns
  are fixed. Child combinators only: an opened year holds tables of its own.
- **A panel's head band is `CardBand`**: the title and a short mono label, never a
  sentence; its controls go in as children. A how-to goes on its control or in the body.
  A card under a section's own `h2` passes `as="h3"`.
- **A dashed box inside a panel is `Notice`** (`ui/notice.tsx`), never hand-rolled.
- **A small mono-capitals label is `MONO_LABEL`** (`lib/utils.ts`), never a new spelling.
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
