---
paths:
  - "apps/web/src/routes/**"
  - "apps/web/src/router.ts"
  - "apps/web/src/run-routes.tsx"
  - "apps/web/src/App.tsx"
  - "apps/web/src/lib/areas.ts"
  - "apps/web/src/lib/run-places.ts"
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
| `/` | `index.tsx` | `MainMenu`, with a `ResumeRun` card while a run exists |
| `/season/new`, `/era/new` | `season/new.tsx`, `era/new.tsx` | `SetupPage` around `SeasonPicker` / `EraPicker` |
| `/run` | `run.tsx` (layout), `run/index.tsx` | the era's roll of honour (`EraChampions` over `crowned(run)`) |
| `/run/1984` | `run/$year/index.tsx` | that year's summary |
| `/run/1984/grid` | `run/$year/grid.tsx` | that year's grid |
| `/run/1984/round/3/qualifying`, `…/race` | `run/$year/round/$round/*.tsx` | one session; the round counts from 1 |

**The URL is an input, never a mirror.** A page reads where it is from the URL and what
to show from the store; nothing writes the store into the URL.

## The run's pages

Every beat of the timeline (`lib/timeline.ts`) is a page, and `lib/run-places.ts` is
the mapping: `linkTo(place)` gives the typed link for a beat (`linkOptions`, so a renamed
route fails the typecheck), and `resolveRunPage(run, page, params)` says what a URL may
show. **Params are untrusted input**: `parseYear` wants four digits, `parseRound` a
round from 1 without a leading zero, and the round must exist in that year's world.

A page shows a place only if the run **has** that year (`world`, or one in
`run.run.seasons`) and the cursor has **reached** it (`isReached`). Anything else — a
typo, a year never reached, a session not yet revealed — redirects to the cursor. (The
"Not reached yet" page that replaces that redirect is the gate's step in the design doc.)
A one-year run's `/run` goes on to its summary, or the cursor before it ends; an era's
`/run` is reached once a year has been crowned.

Each child route resolves **twice**, through `guardRunPage` in `beforeLoad` (a stray
URL never draws) and `RunPlacePage` in render, which returns `<Navigate replace>` when
the store has moved under a page without a navigation — a restart on a race leaves
its URL naming a session the new season has not revealed.

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
`ResumeRun` render inside a bare router, which a `Link` needs. The blocker and the
dialogs' contents need a real browser; `pnpm screenshots` walks Back through the run
and past its start (`.claude/rules/screenshots.md`).
