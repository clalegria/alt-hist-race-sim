---
paths:
  - "apps/web/src/components/SeasonOverview.tsx"
  - "apps/web/src/components/SessionNav.tsx"
  - "apps/web/src/components/PageHeading.tsx"
  - "apps/web/src/components/SeasonCalendar.tsx"
  - "apps/web/src/components/season-pages.test.tsx"
  - "apps/web/src/lib/season-tabs.ts"
  - "apps/web/src/lib/tab-memory.ts"
  - "apps/web/src/lib/session-nav.ts"
  - "apps/web/src/lib/page-steps.ts"
  - "apps/web/src/components/PageSteps.tsx"
  - "apps/web/src/routes/run/$year/index.tsx"
---

# The season page and the links around a page

`/run/<year>` (`SeasonOverview`), a session page's header, and the steps to the page
either side. Which URL shows what, and the gate, are `web-routing.md`.

- **One season page, finished or not**, cut at the cursor; the champion cards head
  the standings tab, under the tab strip, once the summary is reached (`finished`).
- **A page's one `<h1>` is `PageHeading`**, which owns the heading flag's size (a team's
  badge goes in `badge`, ahead of it). Every page but Home's hero uses it; don't
  hand-roll another.
- **Every tab strip is `Tabs`**: `links` between places on a page, `panels` between
  panels on one screen (the settings dialog; a race's classification and standings below
  `lg`, where they don't fit side by side). Never hand-roll another.
- **A tab is a search param, not a path** (`seasonSearch`). Tab links pass
  `activeOptions={{ exact: true }}`: TanStack matches search as a subset and would mark
  the standings link active on every tab.
- **Every tab strip opens on the tab last left on** (`lib/tab-memory.ts`, for the visit).
  A season URL with no tab shows `lastSeasonTab`, so a tab's own link always names it,
  standings included; links to a season never do.
- **The era's sections are pages, not tabs** (`/run`, `/run/drivers`, `/run/teams`):
  `EraTabs` draws them as a strip, never remembered, from `eraSectionTabs`, the list the
  breadcrumb's sections menu reads too. Add a section there, once.
- **Only the cursor's grid has a grid page**, to edit; a raced one's URL goes to the
  season page's Grid tab (`resolveRunPage`), the one drawing of a past grid.
- **The calendar lists every round of the season.** A round not reached is greyed, does
  not open and leaves its pole and winner empty; only the round whose qualifying alone is
  revealed shows `NOT_YET`, for its winner. A reached round's name links its page
  (`pagesOf`), and opening the row is the quick look.
- **A phone's calendar row is round and winner**: Pole shows from `sm`, the Grand Prix
  wraps, and the names are `tight` in `max-w-0` cells. Never a sideways scroll, and
  nothing in a Grand Prix that cannot wrap: one row's widest line sets every row's.
- **Session links move between places and never reveal** (`sessionNav`, the
  qualifying/race switch): a place ahead is a disabled `span`, never an `<a>`. Moving
  between rounds goes through `roundPlace`, shared by the breadcrumbs' menus and the steps.
- **One `stepsFor` per page, drawn twice**: `‹` `›` (`StepArrows`) after the run bar's
  trail from `md` up and at the left of a phone's pinned foot band below it, and named at
  the foot (`StepLinks`), on a session, season, driver or team page, never "Not reached
  yet". A place ahead is a disabled span saying "not yet"; both arrows always draw, so `›`
  never moves.
- **A session step keeps its kind and crosses years** in an era; a season steps among the
  years reached; people go A to Z over the roster, drivers by surname
  (`compareBySurname`), unlike the index's own name sort.
- **Links come in as props**, so `SeasonView` renders without a router; a test that needs
  them renders inside `inRouter` (`test-router.tsx`).
