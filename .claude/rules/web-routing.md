---
paths:
  - "apps/web/src/routes/**"
  - "apps/web/src/router.ts"
  - "apps/web/src/App.tsx"
  - "apps/web/src/lib/areas.ts"
  - "apps/web/src/components/TopNav.tsx"
  - "apps/web/src/routes.test.tsx"
  - "apps/web/src/test-router.tsx"
---

# Web app — routing and the frame

Which page the reader is on is the URL's; what the run is, is the store's
(`.claude/rules/web-app.md`). What is still to build is `docs/design/app-shell.md`.

## The router

**TanStack Router, file-based.** One file per URL under `src/routes/`, the path in its
name (`season/new.tsx` is `/season/new`; `__root.tsx` is the layout around them all).
Each exports `Route` and nothing else. The Vite plugin (`vite.config.ts`) reads the
folder and writes `src/routeTree.gen.ts` on every `pnpm dev` and `pnpm build`. That file
is **committed**, so `pnpm typecheck` passes on a fresh clone, **excluded from Biome**,
and **never edited by hand**: add, rename or delete a route file and run the dev server
or a build to regenerate it.

`router.ts` builds the router and registers it with TanStack (`declare module …
Register`). That registration is what makes every `Link`, `navigate` and `redirect`
type-checked: a link to a path with no route fails `pnpm typecheck`.

| URL | Route file | Page |
|---|---|---|
| `/` | `index.tsx` | `MainMenu` |
| `/season/new`, `/era/new` | `season/new.tsx`, `era/new.tsx` | `SeasonPicker` / `EraPicker` |
| `/run` | `run.tsx` | the whole reveal: `SeasonScreen` or `EraChampionsScreen` by `run.kind` |

**The URL is an input, never a mirror.** A page reads where it is from the URL and what
to show from the store; nothing writes the store into the URL. The reveal cursor is
still store state on the one `/run` URL.

**Routes are thin.** A route file reads the store, wires navigation, and passes props.
The screens in `App.tsx` take their exits (`onBack`, `onMainMenu`) as props, so they
never touch the router and still render through `renderToStaticMarkup` in tests.

## Entering and leaving a run

- **Start** on a setup page calls `startSeason`/`startEra`, then navigates to `/run`.
- **Navigation never discards a run.** The top nav, Home and back/forward leave the run
  in the store; forward, or `/run`, shows it again.
- **Only the explicit buttons do**, all in `routes/run.tsx`: the grid's *Back*
  (`exitRun`, then `/season/new`; in an era `leaveEraSeason`, which leaves no run when
  nothing was crowned, then `/era/new`) and *Main menu* (`exitRun`, then `/`). They
  navigate with `replace`, so Back does not lead onto the discarded run.
- **`/run` with no run redirects to `/`** in its `beforeLoad` guard: a typed URL, a
  reload (nothing survives one yet), or forward onto an exited run.
- The scroll-to-top on every cursor move lives in `run.tsx`; a route change resets scroll
  by itself.

## The frame

`App` is the root route's component: `TopNav` then `<Outlet />`, the slot where the
router puts the current page. Each page brings its own `Shell` — the sticky bar (only
if the page passes one) and the footer. The top nav scrolls away; the sticky bar, where
the way forward is, stays. The theme toggle lives in the top nav. **Both wear one
surface** — the bar's translucent background and blur over the page texture — so they
read as one header; the run-bar step should keep it that way.

**The nav is data**, in `lib/areas.ts`, the pattern of `lib/modes.ts`: **one entry per
mode, in the menu's order** (a test holds it to `MODES`), then pages that are not a mode
(*About*). An area **shares its mode's availability** from `MODES` rather than saying
its own; it also needs a page (`to`, typed against the route tree). An unbuilt area is a
disabled button, never a link to nowhere. `TopNav` takes `areas` as a prop only so a
test can hand it an entry with a page but an unbuilt mode, which today's list lacks.

## Testing

`test-router.tsx`'s `renderRoute(path)` renders a URL through the real router over an
in-memory history. Without a DOM the router runs as on a server, where a redirect is
reported rather than followed, so `routes.test.tsx` tests `/run`'s guard by calling
`beforeLoad` directly. Pages that need a run cannot be rendered this way (the store's
server snapshot is its initial state); they are tested as components in `App.test.tsx`.
