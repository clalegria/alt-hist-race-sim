---
paths:
  - "apps/web/src/routes/**"
  - "apps/web/src/router.ts"
  - "apps/web/src/run-routes.tsx"
  - "apps/web/src/App.tsx"
  - "apps/web/src/lib/areas.ts"
  - "apps/web/src/lib/run-places.ts"
  - "apps/web/src/lib/reveal.ts"
  - "apps/web/src/components/NotReached.tsx"
  - "apps/web/src/components/TopNav.tsx"
  - "apps/web/src/routes.test.tsx"
  - "apps/web/src/test-router.tsx"
---

# Web app — routing and the frame

Which page the reader is on is the URL's; what the run is, is the store's
(`.claude/rules/web-app.md`). What is still to build is `docs/design/app-shell.md`.

## The router

**TanStack Router, file-based.** One file per URL under `src/routes/`, the path in its
name (`season/new.tsx` is `/season/new`; `__root.tsx` is the layout around them all;
`run.tsx` beside a `run/` folder is the layout around everything in it). Each exports
`Route` and nothing else; what the run's routes share lives in `src/run-routes.tsx`.
The Vite plugin (`vite.config.ts`) reads the folder and writes `src/routeTree.gen.ts`
on every `pnpm dev` and `pnpm build`. That file is **committed**, so `pnpm typecheck`
passes on a fresh clone, **excluded from Biome**, and **never edited by hand**: add,
rename or delete a route file and run the dev server or a build to regenerate it.

`router.ts` builds the router and registers it with TanStack (`declare module …
Register`). That registration is what makes every `Link`, `navigate` and `redirect`
type-checked: a link to a path with no route fails `pnpm typecheck`.

| URL | Route file | Page |
|---|---|---|
| `/` | `index.tsx` | `MainMenu`, with a `ResumeRun` card (resume, or exit) while a run exists |
| `/season/new`, `/era/new` | `season/new.tsx`, `era/new.tsx` | `SetupPage` around `SeasonPicker` / `EraPicker` |
| `/run` | `run.tsx` (layout), `run/index.tsx` | an era's overview: the roll of honour (`EraChampions` over `crowned(run)`) and the year in progress |
| `/run/1984?tab=calendar` | `run/$year/index.tsx` | that year's season page, one tab at a time (`web-season-pages.md`) |
| `/run/1984/grid` | `run/$year/grid.tsx` | that year's grid |
| `/run/1984/round/3/qualifying`, `…/race` | `run/$year/round/$round/*.tsx` | one session; the round counts from 1 |
| `/run/drivers`, `/run/teams`, `/run/driver/piquet`, `/run/team/tyrrell` | `run/drivers.tsx`, `run/teams.tsx`, `run/driver/$driverId.tsx`, `run/team/$teamId.tsx` | the people pages, through their own door, `resolveRosterPage` (`web-people-pages.md`) |

**The URL is an input, never a mirror.** A page reads where it is from the URL and what
to show from the store; nothing writes the store into the URL.

## The run's pages

Every beat of the timeline (`lib/timeline.ts`) is a page, and `lib/run-places.ts` is
the mapping: `linkTo(place)` gives the typed link for a beat (`linkOptions`, so a renamed
route fails the typecheck), and `resolveRunPage(run, page, params)` says what a URL may
show. **Params are untrusted input**: `parseYear` wants four digits, `parseRound` a
round from 1 without a leading zero, and the round must exist in that year's world.

`resolveRunPage` gives one of four answers:

- **season** or **review**: the run has the place and the cursor has **reached** it
  (`isReached`). The page gets it through the gate, below. **The season page opens with
  its grid**: `/run/1984` is the summary beat's page, but reachable from that year's
  grid on, cut at the cursor; `finished` says the summary is reached. **An era's `/run`
  is always reached**: the crowned years, plus `inProgress`, the cursor's year cut at the
  cursor (null on the review).
- **unreached**: a place still ahead that the run *can* get to. That means a later beat
  of the cursor's year, or a year in `laterYears(run)` (the `nextEraYear` walk, also
  what Jump to… offers) with a round its calendar has. `NotReached` says so and links to
  the cursor. Continue stays in the run bar.
- **redirect** to the cursor: a malformed param, a round the season doesn't have, or a
  year the run will never reach. A one-year run's `/run` goes on to its season page.

Each child route resolves **twice**: in `guardRunPage` in `beforeLoad` (only a
redirect throws, so a stray URL never draws) and in `RunPlacePage` in render. The
store can move under a page without a navigation: a restart on a race leaves its URL
naming a session the new season hasn't revealed. So a page that was *showing* its
place a render ago and has lost it returns `<Navigate replace>` to the cursor (a ref
holds the address last shown). Only an address *arrived at* ahead of the cursor draws
"Not reached yet".

## The gate

**Every page reads the run through `revealed(run)`** (`lib/reveal.ts`), so a page
can't show a result the reader hasn't reached: it is never handed one.
`resolveRunPage` is the only door. Its `season` answer carries a `RevealedWorld`, and
its `review` answer carries the crowned years.

- Years before the cursor's come back whole. The cursor's own year keeps the races
  whose *race* beat is reached.
- On a qualifying beat the round's race has run but isn't revealed, so the gate adds a
  `QualifyingSheet` copied field by field: grid, gaps, DNQs, weather, and no finishing
  order. `qualifyingOf(season, round)` is what the qualifying page reads.
- `season.rounds` is the season's length. Use it, never `races.length`, which stops at
  the cursor (the clinch arithmetic needs the rounds still to come).
- **The type is the guard.** `SeasonSoFar` requires `rounds` and `qualifying`, so a raw
  `World` can't be passed as a `RevealedWorld`, and a page handed the ungated world fails
  `pnpm typecheck`. It is still a `SeasonResult`, so standings calls read it unchanged.
  A new page (driver, team, calendar) takes what the gate gives, never the store's
  `Run`.
- Property-tested in `lib/reveal.test.ts` (every beat of a season and an era: nothing
  past the cursor, nothing reached withheld, no race key in a sheet). Also tested at
  the door in `lib/run-places.test.ts` (every cursor × every URL).

**Only the grid the cursor is on can be edited** (`editable`). Any other grid,
revisited, is `SeasonPage` with `locked`: no editor button, no ability toggle, no
season switcher, and a line saying the grid has been raced.

**Routes are thin.** A route file reads params and calls into `run-routes.tsx`.
`SeasonPage` and `RunFrame` in `App.tsx` take their actions as props, so they never
touch the router and still render through `renderToStaticMarkup` in tests.

## The run bar, and entering and leaving a run

`.claude/rules/web-run-bar.md`, which loads with the bar's own files.

## The frame

`App` is the root route's component: `TopNav` then `<Outlet />`, the slot where the
router puts the current page. Each page brings its own `Shell` — the sticky bar (only
if the page passes one) and the footer. The top nav scrolls away; the sticky bar, where
the way forward is, stays. The theme toggle lives in the top nav. **Both wear one
surface** — the bar's translucent background and blur over the page texture — so they
read as one header.

**The nav is data**, in `lib/areas.ts`, the pattern of `lib/modes.ts`: **one entry per
mode, in the menu's order** (a test holds it to `MODES`), then pages that are not a mode
(*About*). An area **shares its mode's availability** from `MODES` rather than saying
its own; it also needs a page (`to`, typed against the route tree). An unbuilt area is a
disabled button, never a link to nowhere. `TopNav` takes `areas` as a prop only so a
test can hand it an entry with a page but an unbuilt mode, which today's list lacks.

## Testing

`test-router.tsx`'s `renderRoute(path)` renders a URL through the real router over an
in-memory history. Without a DOM the router runs as on a server, where a redirect is
reported rather than followed, so `routes.test.tsx` tests every run page's guard by
calling `beforeLoad` directly. Pages that need a run cannot be rendered this way (the
store's server snapshot is its initial state): the place rules are tested in
`lib/run-places.test.ts`, the bar's in `lib/run-bar.test.ts`, and `RunBar` and
`ResumeRun` render inside a bare router (`inRouter` in `test-router.tsx`), which a
`Link` needs. The blocker and the dialogs' contents need a real browser;
`pnpm screenshots` walks Back through the run and past its start
(`.claude/rules/screenshots.md`).
