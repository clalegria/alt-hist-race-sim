# Design: routing and the app shell

The persistent navigation, the URL scheme, the pages a run can be browsed through, and
how a run lives, survives a reload and ends. Design intent, not a description of code:
none of it is built. Where it sits in the build order is *routing and the app shell* in
`docs/ROADMAP.md`; §11 is its own build order, one step per session.

- **DECIDED** — the author's decision.
- **PROPOSED** — a suggested design. Confirm with the author before building on it.
- **OPEN** — unresolved; needs the author before or during implementation.

---

## 1. Three kinds of state

| | Lives in | Moved by back/forward? |
|---|---|---|
| **Place** — which page | the URL | yes |
| **Run** — worlds, settings, grid edits | the store | no |
| **Reveal cursor** — how far through | the store, part of the run | no |

- **DECIDED** — The URL is an input, never a mirror: a page reads its place from the URL
  and its data from the store, and nothing writes the store back into the URL.
- **DECIDED** — Back and forward move between *places*, never through time, as in
  Football Manager. **Continue is the only thing that advances the reveal**; nothing
  rewinds it, and a page revisited shows the run as it stands now.
- **DECIDED** — **Continue jumps to the session it just revealed**, from wherever the
  reader is, pushing a history entry. Back then returns to the page they were browsing,
  now one session further on.
- **PROPOSED** — **One gate for the cursor.** `revealed(run, cursor)` returns only what
  the reader has reached, and every page reads through it, so a page *cannot* show a
  race the reader has not reached — it never receives one. Property-tested: no result
  past the cursor reaches any page.
- **PROPOSED** — A URL past the cursor (typed, or kept from an older tab) renders a
  **"Not reached yet"** page with the Continue button, rather than a silent redirect.

## 2. The run timeline

- **PROPOSED** — The cursor is **a position in an ordered list of beats**, not today's
  `View` union of grid/qualifying/race/summary plus a separate champions screen. Today's
  beats: `grid → qualifying 1 → race 1 → … → season summary → era review → next grid`.
  Each beat kind knows its page, so Continue is "next beat, then go to its page", and the
  run bar's stage label is "describe this beat".
- **PROPOSED** — This is the seam the market and game mode land on (§9). Kinds are added,
  not redesigned: a market event stamped with its round (`era-advanced.md` §2) becomes a
  beat; a **decision** beat blocks Continue until answered, the button turning into
  "Respond to …".
- **OPEN** — Whether an event *stops* Continue (an interstitial the reader must pass, FM's
  news pop-up) or only lands in the feed with an unread badge. Probably both, per event
  importance; settle with the market.

## 3. The lifetime of a run

- **DECIDED** — **A run survives a reload, and closing the tab.** It ends only when the
  reader exits it.
- **PROPOSED** — How: on every Continue and every grid edit, the run's **recipe** (start
  year, seed, ability mode, randomness, retained bulk rule, grid edits) and its cursor go
  to `localStorage`; on load, the store rebuilds the run from them. Simulation is
  deterministic, so the recipe *is* the run. A snapshot (`JSON.stringify` of every world)
  would also work but a long era is likely to outgrow `localStorage`'s few megabytes.
  This is not the save-file feature (§8) — one slot, the current run, nothing to manage.
- **PROPOSED** — The recipe carries a **build stamp**. Resumed on a different build, the
  same recipe would replay to different results; then the app says the run was made on
  an older version and cannot be resumed, rather than silently rewriting history. Only
  matters once the app is public.
- **DECIDED** — Exiting asks first. **PROPOSED** — the ways out, all through **one
  confirm dialog** ("Exit this run? It will be discarded."):
  - **Exit run** in the run bar's overflow menu.
  - **Back past the run's first page** — a router navigation blocker.
  - **Starting a new run** while one exists ("This will end your current run").

  Not exits: Home, About or any other area (the run waits; Home shows a *Resume run*
  card and the run bar comes back with it), a reload, closing the tab. The browser's own
  leave-site prompt is therefore not needed. Today's inline confirms (*Start again*,
  *Main menu*) cannot serve the blocker, which interrupts a browser navigation, so this
  brings in a dialog primitive (shadcn's AlertDialog, Radix underneath) — used for all
  three. *Start again* (re-run this year) keeps its inline confirm; *Main menu* stops
  needing one, since going home no longer discards.

## 4. Routes

**PROPOSED** — the URL scheme. Public once *publish it* ships: renaming a route then
breaks every shared link.

```
/                              home: mode cards (+ Resume run while one exists)
/about    /report              stubs until *publish it*
/season/new   /era/new         setup: year, seed, settings

/run                           era overview (a one-year run redirects to its season)
/run/1984                      season          ?tab=standings|calendar|grid
/run/1984/grid                 pre-season grid
/run/1984/round/3/qualifying   a session
/run/1984/round/3/race
/run/drivers   /run/teams      everyone who has appeared in the run
/run/driver/piquet             a driver, across the whole run
/run/team/williams             a team, across the whole run
/share?…                       entry only: rebuild the run from the recipe, then redirect
```

- **Path params say which thing, search params say how it is viewed** (a tab, a sort).
  Both come from the reader and are validated like any untrusted input.
- `/run` is singular, no run id: phase 1 has one run at a time. Saved runs (§8) add
  `/run/:id/…` if they ever need more than one open.
- **A standalone season is a one-year run** — same routes, no overview.
- **OPEN** — Team URLs use the lineage id (`.claude/rules/team-eras.md`), so today's
  Mercedes is `/run/team/tyrrell`. Stable, since a name-based slug would change with each
  era, but odd to read. Alternative: accept a name slug and redirect to the id.

## 5. The shell

**PROPOSED** — on every page:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ◆ alt-hist   Simulate   Eras   Editor·   Game·   About               [☾]    │  · = disabled
├─────────────────────────────────────────────────────────────────────────────┤
│ Era 1980 › 1984 › Round 3 › Race     Rd 3/16 · Race   [Share] [Continue ▸] ⋯│
│ Overview   Season   Drivers   Teams                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Top nav** — areas as data, like `lib/modes.ts`: an unbuilt area is a disabled entry,
  and a future one (Market, Inbox, My team) is a row, not a layout change.
- **Run bar**, inside a run only — breadcrumbs, the current beat, Share, Continue, and an
  overflow menu holding *Skip* (rest of season / jump to year, with today's confirms) and
  *Exit run*. A one-year run's breadcrumbs start at the year: `1984 › Round 3 › Race`.
- **Run tabs** — the run's sections, also data.
- The phone form (*phone layout*, the next roadmap item) collapses the top nav to a menu
  and the run bar to Continue plus the overflow; keep both as data so that is a restyle.

## 6. Pages

**PROPOSED** — each is a thin route component: read the params, read the store through
`revealed()`, pass props to a component. The components stay props-driven, so they keep
rendering through `renderToStaticMarkup` in tests, as today.

- **Home, setup** — `MainMenu`, `SeasonPicker` and `SimulationSettings` as they are.
  *Start* builds the run and goes to `/run/<year>/grid`, the run's first page.
- **Grid** — `GridStage`. Editable while the cursor is on the grid; afterwards the same
  page read-only, saying so.
- **Session** — today's reveal stage. Prev/next round links move between places and never
  reveal; a round not reached is disabled.

  ```
   Brazilian GP · Round 3                    [Qualifying | Race]    ☂ wet
   ┌ Classification ─────────────────────┐  ┌ Championship after Rd 3 ┐
   │ 1  Piquet    Brabham-BMW            │  │ 1 Piquet  24            │
   │ 2  Prost     McLaren-TAG   +4.2s    │  │ 2 Prost   18            │
   └─────────────────────────────────────┘  └─────────────────────────┘
   ‹ Round 2                                            Round 4 (not yet) ›
  ```
- **Season** — tabs: *Standings* (both tables and the evolution chart, as of the cursor),
  *Calendar* (every round with its winner, unreached rounds listed but greyed), *Grid*
  (the entry list). Finished, it is the season summary (`SeasonStandings`).
- **Era overview** — `EraChampions`: roll of honour and career statistics, plus the year
  in progress as a last row ("1984 — in progress, leader after round 3").
- **Driver** — header (flag, name, age, current team, rating), the run's totals, season
  by season (`lib/history.ts`), and the current season race by race, unreached rounds
  as `···`. On the grid but not yet raced: the entry alone.

  ```
   🇧🇷 Nelson Piquet · 31 · Brabham-BMW (1984)
   3 titles · 21 wins · 40 podiums · 18 poles
   1984  Brabham  1st  24 pts · 1 win        (through round 3)
   1983  Brabham  1st  …
   1984: BRA P1 · RSA DNF · BEL P4 · ··· · ···
  ```
- **Team** — the same shape; name and livery as of its latest season, lineup lines from
  `lineupOf`, lineage spells as `CareerStatistics` shows them.
- **Drivers, Teams** — one sortable table each of everyone in the run, career totals
  from `lib/records.ts`, ordered by the ranking rule.

## 7. Names: panel first, page second

- **DECIDED** — The career panels (`SeasonHistory`: select a driver or team on the era
  screen, a panel lists their seasons) stay, and gain a **"Full page →"** link.
- **PROPOSED** — One affordance everywhere: any driver or team name in any table opens
  that panel, and the panel links to the page. A name never navigates directly, so there
  is one gesture to learn, not two.

## 8. Sharing and saving

Four different things, built at different times. **Only the first is in this item.**

| | What it carries | Survives a new build? | When |
|---|---|---|---|
| **Share link** | the recipe and how far through | no — replays | this item |
| **Save file** | recipe, input log *and* every world (snapshot) | yes | the ratings editor |
| **Read-only view** | a snapshot, opened with no Continue | yes | after save files |
| **Account / other device** | a save file, uploaded | yes | a backend phase |

- **PROPOSED** — A snapshot can be **continued**, not just read: each world carries its
  `rngState`, so the next season draws from where the saved one stopped.
- **PROPOSED** — The read-only view costs almost nothing if pages never act on the run:
  only the run bar advances or edits, so a viewer is the same pages with the run bar's
  actions hidden. Keep it that way.
- In game mode a run is the seed plus the player's **decision log**
  (`era-advanced.md` §2). That log can outgrow a URL, so sharing a game run is a save
  file; a link may still carry a short one.
- What a link or a save replays against when the data moves is open in
  `docs/DECISIONS.md`.

## 9. Ready for the market and game mode

Nothing here builds them; these rules keep them a matter of adding, not reworking:

1. **Player inputs go through one log in the store** — grid edits now, decisions later.
   The log is what reload (§3) and Share (§8) serialise.
2. **The cursor is a timeline of beats** (§2): an event or a decision is a new kind.
3. **Pages read, the run bar acts** (§8): a page never advances or edits the run.
4. **Navigation is data** (§5): Inbox, Market, *Next season's grid*, My team
   (`era-advanced.md` §12) are rows, each with an optional unread count.
5. **Every page goes through `revealed()`** — events and next season's grid included.

## 10. Router

**OPEN** — `docs/DECISIONS.md` listed it; owned here now. Both have the navigation blocker
§3 needs.

- **TanStack Router** — **for:** links and params are **checked by `tsc`** (a link to a
  route that does not exist, or a missing `year`, fails `pnpm typecheck`), which suits a
  codebase where the compiler is the guard on generated code; **search params are
  validated by a schema** at the route, which is what a Share link needs. **Against:**
  smaller community, fewer examples, more set-up (a route tree and a type registration).
- **React Router** (v7) — **for:** the most used, the most examples, the simplest mental
  model. **Against:** params arrive as `string | undefined` and search params as raw
  text, so parsing and validation are hand-written on every page; full typing comes with
  its "framework mode", which brings server-rendering machinery phase 1 does not want.

Leaning: TanStack, with a **code-based route tree** (one `routes.tsx` read top to bottom)
rather than file-based routing, which generates a file to keep in sync.

## 11. Build order

One session each, in order; each ends green and documented in `.claude/rules/`, leaving
this file smaller.

1. **The router and the shell.** Today's flow mapped onto routes one to one — home,
   setups, the run — under the top nav. No new pages. The `Screen` union's "which screen"
   moves to the router.
2. **The timeline and the run bar.** Cursor as beats (§2); Continue navigating to the
   revealed beat; breadcrumbs; Skip; the exit dialog and the back-past-start blocker;
   the *Resume run* card.
3. **Surviving a reload.** The input log, the recipe in `localStorage`, the build stamp.
4. **The gate.** `revealed()` and its property tests; the "Not reached yet" page.
5. **Season and session pages**, browsable by URL.
6. **Driver and team pages**, the two index lists, the panel's page link.
7. **Share.** The link and the `/share` entry route.
8. **Screenshots from URLs** (`.claude/rules/screenshots.md`), then a candidate visual
   check in CI.

Deep links on the host (`/run/…` answering with `index.html`) are settled in *publish it*.
