---
paths:
  - "apps/web/src/App.tsx"
  - "apps/web/src/run-routes.tsx"
  - "apps/web/src/lib/run-bar.ts"
  - "apps/web/src/components/RunBar.tsx"
  - "apps/web/src/components/RunDialogs.tsx"
  - "apps/web/src/components/ResumeRun.tsx"
---

# Web app — the run bar

What can be done to a run, and how a run is entered and left. The pages it sits over
and the router are `.claude/rules/web-routing.md`; the store actions behind each button
are `.claude/rules/web-app.md` and `.claude/rules/web-era.md`.

`RunLayout` (the `/run` layout) draws `RunFrame`: `Shell` with `RunBar` in the sticky
bar, the same actions again at the page foot, and the dialogs. **Pages read, the run
bar acts** — a page never advances or edits the run, the cursor's own grid excepted —
so a read-only view of a run later is these pages with the bar's actions hidden.

- **Breadcrumbs describe the page, the cursor text the run.** `crumbsFor(run, place)`:
  `Era › 1984 › Round 3 › Race`, a one-year run starting at the year. A crumb links
  only to a page reached — *Era* to the era's overview, the year to its season page,
  both reached from the year's grid on; the last is the page itself,
  `aria-current="page"`.
- **The year and the round are also switchers**: a `▾` beside each (`CrumbMenu`, from
  `crumbsFor`) opens a Radix `DropdownMenu` of its siblings, so the trail moves across
  as well as up. Years: every year reached, each to its season page, once there are two.
  Rounds: every round of the year, each where `roundLink` (`lib/session-nav.ts`) sends
  it, the same rule as the round links at a session's foot; a round ahead is listed,
  disabled, "not yet". Each item is `DropdownMenuItem asChild` around a `Link`, so it
  is a real anchor. The items render in a portal, so they are tested as data. The
  layout finds the page from the deepest match's `routeId` (`runPageOf`). Under them,
  `1984 · Round 3/16 · Race` says where the cursor is.
- **Three kinds of action** (`runBarFor(run)` in `lib/run-bar.ts` decides which are
  offered, and is what the tests read):
  - **Forward** — *Continue* (the primary button; its `title` names the next beat),
    the skip to this season's end (*Simulate full season* / *Simulate rest of the
    season*, not after the last race), and *Jump to…* (an era with a later year ahead).
    All three **push**, so Back returns to the page the reader was on.
  - **Over again** — *Restart season* (off the grid, not on the review) and *Restart
    era* (an era past its first grid). New dice, never a rewind; they **replace** the
    URL with the new grid, since the page left belongs to results that no longer exist.
  - **Out** — *Exit run*.
- **All of them on the bar from `md` up; on a phone, Continue plus ⋯** (Radix
  `DropdownMenu`) holding the rest. Both layouts are rendered from one list and a media
  query shows one, so they cannot offer different things.
- **Away from the cursor's page, the way back comes first** — the "jump to live" a
  stream shows once you scroll back. `returnFor(run, place)` is null on the cursor's
  own page; elsewhere it gives *↩ Back to 1985 · Grid*, a `Link` wearing the primary
  button's look (`buttonClass` in `ui/button.tsx`: it navigates, so it is an `<a>`).
  Continue drops to `outline` beside it, since it acts on the cursor, not on the page
  on screen; on a phone it moves into ⋯. The cursor line under the crumbs becomes the
  same link, "Run is at …".
- **Jump to…** opens `JumpDialog`: a `YearPicker` over `jumpYears(run)` and *Stop at*
  the season's **start** (its grid, to set it up) or **end** (its summary).
  `jumpTarget(run, chosen)` decides where it lands — a choice the run has overtaken
  falls back to one still ahead; the default is the end of the next year. The store's
  `jumpTo` does the rest (`.claude/rules/web-era.md`); the skip is `jumpTo` with this
  season's end.
- While the grid editor is open the actions give way to a note: the grid page raises
  it through `GridEditingContext`, since the page is an `<Outlet />` the frame does
  not render, and clears it on unmount.
- The scroll-to-top on every change to the run lives in `RunLayout`; a change of URL
  resets scroll by itself.

## Entering and leaving a run

- **Start** on a setup page (`SetupPage` in `run-routes.tsx`) calls
  `startSeason`/`startEra`, then **pushes** the grid — so the entry behind a run's first
  page is always its setup page.
- **Navigation never discards a run.** Home, the top nav and back/forward leave it
  waiting. Home's `ResumeRun` card links to the cursor's page, with *Exit run* beside
  the link — not inside it, since an `<a>` cannot hold a button.
- **One dialog for everything that throws work away** — `RunConfirmDialog` (Radix
  `AlertDialog`), worded per case in `RUN_CONFIRM_COPY`: the two restarts and the ways
  out of a run.
- **A way out asks only when there is something to lose.** `isUntouched(run)` in the
  store: the cursor still on the run's first grid, and that grid as it was entered.
  Until then the run is still being set up, and going back to change the randomness is
  not abandoning anything. The ability toggle and the year switcher keep a run
  untouched; a grid edit, anything revealed, or a later era year does not. An untouched
  run is left in the store by Back — navigation never discards one — and the setup
  page's Start replaces it without asking.
  - *Exit run*, from the bar or the Home card: `exitRun`; from the bar, then `/` with
    `replace`.
  - **Back past the run's first page**: `useBlocker` in `RunLayout` holds any
    navigation `isBackPastStart(action, from, to)` matches — a `BACK` from `/run…` onto
    `/season/new` or `/era/new` — when the run is not untouched, reading the store at
    the moment of the navigation, and opens the dialog. Confirm is `proceed()` then
    `exitRun()`; cancel is `reset()`.
  - **Start while a touched run exists**: the setup page asks "Start a new run?" first.
- The confirm buttons are plain buttons, not Radix's `Action`: `Action` also closes
  through `onOpenChange`, which is the cancel path here.
- **`/run` with no run redirects to `/`** in its `beforeLoad` guard: a typed URL, a
  reload whose saved run would not rebuild (`.claude/rules/web-persistence.md`), or
  forward onto an exited run.

