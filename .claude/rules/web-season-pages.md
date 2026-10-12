---
paths:
  - "apps/web/src/components/SeasonOverview.tsx"
  - "apps/web/src/components/SessionNav.tsx"
  - "apps/web/src/components/SeasonCalendar.tsx"
  - "apps/web/src/components/season-pages.test.tsx"
  - "apps/web/src/lib/season-tabs.ts"
  - "apps/web/src/lib/session-nav.ts"
  - "apps/web/src/routes/run/$year/index.tsx"
---

# The season page and the links around a session

`/run/<year>` (`SeasonOverview`), and a session page's header and round links. Which URL
shows what, and the gate, are `web-routing.md`.

- **One season page, finished or not**, cut at the cursor; the champion cards go on top
  once the summary is reached (`finished`).
- **A tab is a search param, not a path** (`seasonSearch`), and the default tab is left
  out of the URL. Tab links pass `activeOptions={{ exact: true }}`: TanStack matches
  search as a subset and would mark the standings link active on every tab.
- **The calendar lists every round of the season.** A round not reached is greyed, does
  not open and shows `NOT_YET`; a reached round's name links its page (`pagesOf`), and
  opening the row is the quick look. `CalendarRow` is controlled.
- **Session links move between places and never reveal** (`sessionNav`): a place ahead is
  a disabled `span`, never an `<a>`. Moving between rounds goes through `roundLink`,
  shared with the breadcrumbs' menus.
- **Links come in as props**, so `SeasonView` renders without a router; a test that needs
  them renders inside `inRouter` (`test-router.tsx`).
