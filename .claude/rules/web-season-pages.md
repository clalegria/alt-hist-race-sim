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

# Web app — the season page and the links around a session

Which URL shows what, and the gate that cuts it at the cursor, are
`.claude/rules/web-routing.md`; how the tables inside are drawn is
`.claude/rules/web-display.md`.

## The season page

`/run/1984` is `SeasonOverview`: **one page, finished or not**, reachable from the
year's grid on and cut at the cursor like every page. Its top is the edited-grid banner,
then the two champion cards once the summary is reached (`finished`) or "1984 season ·
After round 3 of 16" before, then the settings line; under them **one tab at a time**:

- **Standings** — `SeasonStandings` with its charts, as of the cursor. Before the first
  race, a line rather than two empty tables.
- **Calendar** — `SeasonCalendar` over every round of the calendar (`rounds`), not just
  the races revealed. A round not reached is greyed, does not open, and shows `NOT_YET`
  in place of its pole and winner; the cursor's qualifying-only round (`pending`) shows
  its pole and nothing more.
- **Grid** — `SeasonGrid` with the shared sort switch.

**A tab is a search param, not a path**: the path says *which* season, the query how it
is viewed. The route's `validateSearch` is `seasonSearch`: anything that is not a tab
reads as the standings, and the standings are left out of the URL, so `/run/1984` is the
season's one address. Tabs are `Link`s, so Back moves between them; the current one is a
`<span aria-current="page">`, and the others pass `activeOptions={{ exact: true }}`,
since TanStack otherwise matches search as a subset and would mark the empty-search
standings link active on every tab.

## The links around a session

A session page has `SessionHeader` — the round's name, flag, number and circuit, the
*Qualifying | Race* switch and the weather — and `RoundLinks` at its foot, both from
`sessionNav(cursor, place, rounds)`. The session's own card says only *Starting grid*
or *Classification*. **They move between places and never reveal**: a link only to a
place reached, anything ahead drawn disabled (a `span`, never an `<a>` to nowhere). The
next round keeps the session on screen, or goes to its qualifying while its race is
ahead. They stay within a season.

## Testing

Both take their links as props, like the run bar, so `SeasonView` renders without them
in a test with no router; a test that needs them renders inside `inRouter`
(`test-router.tsx`). `lib/session-nav.test.ts` walks every cursor × every reached
session; `season-pages.test.tsx` counts the calendar's rows, its openable rounds and its
`NOT_YET` markers against the cursor.
