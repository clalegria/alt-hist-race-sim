# Design: routing and the app shell

The persistent navigation, the URL scheme, the pages a run can be browsed through, and
how a run lives, survives a reload and ends. Design intent, not a description of code:
what is built — the router, the top nav, the timeline of beats, a page per beat, the
gate, the season page and session links, the run bar, the ways out of a run, surviving
a reload, and the driver and team pages — is `.claude/rules/web-routing.md`,
`.claude/rules/web-season-pages.md`, `.claude/rules/web-run-bar.md`,
`.claude/rules/web-persistence.md`, `.claude/rules/web-people-pages.md` and
`.claude/rules/web-app.md`. Where it sits in the
build order is *routing and the app shell* in `docs/ROADMAP.md`; §10 is its own build
order, one step per session.

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

The URL as an input, back and forward between places, Continue pushing the page it
revealed, the gate (`revealed(run)`) and the "Not reached yet" page are built
(`.claude/rules/web-routing.md`).

## 2. The run timeline

The cursor is built as a list of beats (`.claude/rules/web-app.md`). What is left:

- **PROPOSED** — It is the seam the market and game mode land on (§9). Kinds are added,
  not redesigned: a market event stamped with its round (`era-advanced.md` §2) becomes a
  beat; a **decision** beat blocks Continue until answered, the button turning into
  "Respond to …".
- **OPEN** — Whether an event *stops* Continue (an interstitial the reader must pass, FM's
  news pop-up) or only lands in the feed with an unread badge. Probably both, per event
  importance; settle with the market.

## 3. The lifetime of a run

- **DECIDED** — **A run survives a reload, and closing the tab.** It ends only when the
  reader exits it.

Both halves are built: the recipe in `localStorage`, checked by a fingerprint of each
world (`.claude/rules/web-persistence.md`), and one dialog for Exit run, Back past the
run's first page, and Start while a run exists (`.claude/rules/web-run-bar.md`).

## 4. Routes

**PROPOSED** — the URL scheme. Public once *publish it* ships: renaming a route then
breaks every shared link. Built so far: everything below but `/about`, `/report` and
`/share` (`.claude/rules/web-routing.md`).

```
/                              home: mode cards (+ Resume run while one exists)
/about    /report              stubs until *publish it*
/season/new   /era/new         setup: year, seed, settings

/run                           era overview (a one-year run redirects to its season)
/run/1984                      season          ?tab=standings|calendar|grid
/run/1984/grid                 pre-season grid
/run/1984/round/3/qualifying   a session
/run/1984/round/3/race
/run/drivers   /run/teams      everyone who has appeared in the era (an era's only)
/run/driver/piquet             a driver, across the whole era
/run/team/williams             a team, across the whole era
/share?…                       entry only: rebuild the run from the recipe, then redirect
```

- **Path params say which thing, search params say how it is viewed** (a tab, a sort).
  Both come from the reader and are validated like any untrusted input.
- `/run` is singular, no run id: phase 1 has one run at a time. Saved runs (§8) add
  `/run/:id/…` if they ever need more than one open.
- **A standalone season is a one-year run** — same routes, no overview and no people
  pages.
- **DECIDED** — Team URLs use the lineage id, so today's Mercedes is
  `/run/team/tyrrell`. A name slug that redirects to the id can be added later without
  breaking a link.

## 5. The shell

The top nav and the run bar are built, the breadcrumbs with menus of the other years
and rounds, and the root crumb's menu of the run's sections, which is where the run's
lists are reached — **DECIDED**, in place of run tabs (`.claude/rules/web-run-bar.md`).
**PROPOSED** — still to add:

- **Share** in the run bar, beside Continue (§8).
- The top nav's phone form (*phone layout*, the next roadmap item): a menu. The run
  bar's — Continue plus ⋯ — is built.

## 6. Pages

Every page of §4 inside `/run` is built (`.claude/rules/web-routing.md`,
`.claude/rules/web-season-pages.md`, `.claude/rules/web-era.md`,
`.claude/rules/web-people-pages.md`). Pages still to come — events, next season's grid
— follow the same shape: a thin route component that reads the params and the store
through a door that cuts the run at the cursor, and passes props to a component.

## 7. Names: panel first, page second

- **DECIDED** — One affordance everywhere: a driver or team name opens its career
  panel, and the panel ends on *Full page →*. A name never navigates directly — except
  on the two index lists, which are directories. Built: the panel on every run page, its
  link, and the same link on the grid's popovers (`.claude/rules/web-careers.md`).
- Still to do: the names in the standings, the classification, the calendar, qualifying
  and the race-by-race panels do not open a panel yet. Where a name is already a row's
  expand button, it becomes the two-control row the record cards use (chevron expands,
  name opens the panel).

## 8. Sharing and saving

Four different things, built at different times. **Only the first is in this item.**

| | What it carries | Survives a new build? | When |
|---|---|---|---|
| **Share link** | the recipe and how far through | no — replays | this item |
| **Save file** | recipe *and* every world (snapshot) | yes | the ratings editor |
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

1. **A player input is recorded on the world it shaped**: grid edits now, decisions
   later. The recipe that reload (§3) and Share (§8) serialise is derived from the
   worlds, so there is no second log to keep in step with them.
2. **The cursor is a timeline of beats** (§2): an event or a decision is a new kind.
3. **Pages read, the run bar acts** (§8): a page never advances or edits the run.
4. **Navigation is data** (§5; the top nav's `lib/areas.ts`): Inbox, Market, *Next season's grid*, My team
   (`era-advanced.md` §12) are rows, each with an optional unread count.
5. **Every page goes through `revealed()`** — events and next season's grid included.

## 10. Build order

One session each, in order; each ends green and documented in `.claude/rules/`, leaving
this file smaller.

1. **Names open their panel everywhere** (§7): the standings, classification,
   calendar, qualifying and race-by-race names.
2. **Share.** The link and the `/share` entry route. The reload recipe is its
   starting point.
3. **Screenshots from URLs** (`.claude/rules/screenshots.md`), then a candidate visual
   check in CI.

Deep links on the host (`/run/…` answering with `index.html`) are settled in *publish it*.
