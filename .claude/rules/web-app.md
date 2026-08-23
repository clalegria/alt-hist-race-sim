---
paths:
  - "apps/web/**"
---

# Web app

`apps/web` reveals a season a session at a time. React + Vite, Tailwind 4, Zustand.
shadcn/ui components are **copied in, not a dependency** — but the Radix primitives
they wrap *are* real dependencies (currently `@radix-ui/react-popover`).

## Screens and state

**Three screens, one union.** `Screen` in `store/season.ts` is
`menu → season-setup → season`, and a `World` is a *member of the season variant*
rather than a nullable field beside it — so the menu cannot read a season nobody
started and no component has to guard against one. Nothing is simulated until a mode
is chosen: the app opens on the menu having run no races at all.

Modes come from `lib/modes.ts` and years from `lib/seasons.ts`; both list what does
not exist yet (the career mode, the unauthored seasons) as disabled entries rather
than omitting it. **`lib/seasons.ts` holds no list of its own** — `PLAYABLE_SEASONS`
and `isPlayable` come straight from `authoredSeasons` in `@alt-hist/data`, so
authoring a season is a file in `packages/data/src/seasons/` and the UI follows.
The split: which years *exist* is a data decision, the 1980–2026 *range the picker
draws* is a display decision and lives here. `playableSummary()` writes the picker's
subtitle from the same source, collapsing runs into ranges — it said "Only 1980 has
been authored" for a while after 1981 landed, and that is why the copy is derived.
`createWorld(seed, year)` goes through `seasonSeed`, which throws on an unauthored
year rather than quietly falling back.

**No component may read a season fixed at import time.** Round names come from the
world's own year — `SeasonView` resolves `seasonSeed(world.year)` and hands
`SeasonCalendar` a `calendar` prop. This was the 1980 coupling the roadmap called
out, and getting it wrong is invisible: 1981 renders perfectly well with 1980's round
names. `seasons.smoke.test.tsx` walks every authored season through every stage and
checks each round against its own calendar entry.

**"Start again" asks where to** — *Main menu* or *Beginning of the season*, inline on
the same button row rather than in a modal (no dialog primitive here, and one is not
worth a dependency plus a focus trap for three buttons). *Beginning of the season*
draws a **fresh seed for the same year and the same `ratingMode`**: another go, not a
replay, and everything the reader *chose* carries over — only the dice change. Both
copies of the action row — sticky bar and page foot — share one confirming flag so
they cannot disagree.

**The grid leaves through a plain Back**, to the year picker it came from — no
confirming step, because nothing has been revealed yet and leaving costs the reader
nothing. It is `actionsFor(...).back`, so the whole button set of every stage still
comes out of that one pure function; past the grid it is null and "Start again" does
the job. The year picker's Back is `BackBar` in `App.tsx`, rendered into the **sticky
bar** — it draws none of its own navigation — so every screen keeps its way out in the
same place, rather than one of them hiding it under six rows of year buttons.
**Navigation is always the right-hand end of that bar**, up against the theme toggle,
on every screen that has any.

**Driver ability is a simulation input, not a display filter.** `world.ratingMode` is
`"peak"` (authored peaks, the default and the calibrated one) or `"aged"` (each
driver's ability in that season, via the engine's curve). `RatingModeToggle` renders
**only on the grid stage** — past it the reader has seen results the other field would
never have produced — and `setRatingMode` re-runs the year *from the same seed*, so
the two modes are the same dice thrown at different drivers.

The choice **sticks**, via `lib/preferences.ts` (localStorage, guarded exactly as
`theme.ts` guards it — storage is absent under Vitest and throws in private
browsing). Two levels, and the split is the point: the *world* owns the mode it was
built with, so a finished season keeps reporting the ratings it actually raced; the
*preference* only seeds the next one. `startSeason` reads it, `setRatingMode` writes
it, `restartSeason` carries the world's own. `simulate` deliberately ignores it — it
is the entry point whose output must depend only on its arguments, and tests would
otherwise be order-dependent on whatever was last remembered.

**The grid is a simulation input too, in two halves.** `world.lineup` is the reader's
own driver allocation and `world.engines` their own engine supply — each **null for the
season as it was entered**, null rather than a copy of the authored one, so "was this
edited?" is a property of the world instead of a comparison somebody has to remember to
make. `createWorld` normalises an edit that lands back on the authored grid to null, so
undoing your last swap stops the notices.

Two fields rather than one because they are two questions — who drives the car, and
what is in the back of it — and either can be changed without the other. **One store
action, though**: `setGrid(lineup, engines)` applies both, because the editor applies
one draft and a reader who moved a driver *and* changed a supplier asked a single
question. Simulating a season in between would answer one nobody asked.

`setGrid` mirrors `setRatingMode` exactly: **grid stage only**, re-runs the year *from
the same seed*, and `restartSeason` carries it — an edited grid is something the reader
chose, like the ability mode. Unlike the ability mode it is **not** remembered in
localStorage: a lineup and a set of engine deals belong to the year they were drawn
for, so starting a season from the menu gets the real grid back.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, ratingMode, rngState, field, lineup, engines, season }`) — one per
season screen, none before one is started. `field` is the grid exactly as raced, and is
no longer derivable from the seed files: who is in it depends on `lineup`, what they
drive on `engines`, and their ratings on `ratingMode`.

**Who is running whose engine travels by context, not by prop.** A result row records a
`teamId` and nothing else, but "Williams-Ford" has to be the same name in the standings,
the classification, the qualifying sheet and the summary or it reads as a bug. Threading
a map through `StandingsTable`, `CompactStandings`, `DriverName`, `QualifyingResults` and
the summary would be six pass-through props deep, so `SeasonView` wraps its body in
`EntryNames` and those components call `useEntryName()`. The map is built from
**`world.field`**, not the seed files — the field is the record of the grid as it was
actually raced. The default is empty, so a component rendered on its own shows plain
team names rather than throwing, which is what keeps every DOM-less test renderable.
`SeasonGrid` deliberately does *not* use the context: it reads the engine off the field
it is handed, which is what lets the editor preview a draft the world has never seen.

**No `Rng` in the world** — it holds a closure and cannot be serialized. What is
stored is its numeric `getState()` snapshot, which `createRngFromState` turns back
into a generator positioned exactly where the season ended. `JSON.stringify(world)` is
therefore already a complete save file, and tests assert both the round trip and that
no function or class instance has crept in.

View state that says nothing about the simulation — which race row is expanded, the
start-again confirming flag, the grid editor's **draft** lineup and draft engines —
stays in component `useState`. The rule is that *simulation* state lives in the one
store, not that React may never hold anything. A draft becomes simulation state at the
moment Apply hands it to `setGrid`, and not before: applying re-runs fourteen races, and
a reader halfway through moving four drivers has not yet asked a question worth
answering. The two drafts open and close together, so one `null` answers for both.

While the editor is open, `App` takes the **forward buttons away** — `GridStage`
raises `onEditingChange` and `Actions` shows a note instead. Stepping on mid-edit
would discard the draft silently *and* reveal a season run on the grid the reader was
in the middle of replacing.

**Standings are derived in the component, not stored:** `championshipStandings` and
`constructorStandings` run in a `useMemo` off `world.season`. Mid-season standings
need no special support — `{ races: races.slice(0, n) }` *is* the table after round n.

A fresh random seed is drawn each time a season is started, from the picker and by
Start again. That is **not** a violation of the no-`Math.random()` rule: choosing
*which* seed to run happens before any generator exists, so it lives in `lib/seed.ts`
and never in `packages/engine`.

## The reveal

The whole year is simulated the instant a seed is drawn — one continuous RNG stream
through every round, which is what makes a season reproducible. `View` is a cursor
over results that already exist:

```
grid → qualifying 1 → race 1 → qualifying 2 → race 2 → … → summary
```

"Simulate next session" is a promise about what the reader sees next, not about when
the dice are rolled. `advance()` is a pure function over that cursor and
`actionsFor()` in `App.tsx` is the whole of the navigation — both tested directly,
because getting either wrong strands the reader mid-season.

## Display rules

Moved to `.claude/rules/web-display.md`, which loads alongside this file whenever you
open anything in `src/components/`.

## Type, palette and theme

In `.claude/rules/web-styling.md`, which loads when you touch the stylesheet,
`index.html` or the theme module. **Read it before editing `src/index.css`** — the
nested-`@theme` trap it documents has broken this app once already.

## Testing

Vitest with **no jsdom**. `SeasonView` takes the world and the cursor as **props**
rather than reading the store, so every stage renders through `renderToStaticMarkup`
without a DOM and without clicking through fourteen rounds; `MainMenu` and
`SeasonPicker` take their callbacks the same way — the only level at which the
greyed-out mode and 46 unauthored years can be checked. `App` connects all three.

That split is partly structural and partly because **zustand serves
`getInitialState()` as the `useSyncExternalStore` *server* snapshot** — a static render
always shows the world the store was built with, whatever has been simulated since.
SSR-only and irrelevant to a client-rendered SPA, but it is why store updates are
asserted in the store's own tests.

`menu.test.tsx` counts rendered `disabled=""` attributes, **not** the word "disabled"
— several perfectly clickable buttons carry `disabled:opacity-50` in their class list.

**Nothing here asserts an authored number or what a seed produced** — the rule is in
`CLAUDE.md`, and `src/test-support.ts` is how it is kept. `seededWorld()` is a fixture
(a render has to be *of* something); `findWorld(predicate)` searches seeds for a season
of the shape a test needs — a title settled with rounds to spare, a place that changed
hands — instead of pinning the seed that happened to work. Counts come off the grid:
`world.field.length`, `teamCount`, `starterCount`, `SEED.calendar.length`. `YEAR` and
`SEED` are the earliest authored season rather than a year written down, and anything
that must hold for *every* season loops `seasons` instead. The suite is checked against
this by perturbing every rating in the seed data and by adding an entry to a season; it
stays green through both.

The grid editor is split the same way, and for the same reason. `SeasonGrid` and
`ReserveList` are **controlled** — the draft lives in `GridStage` above them — so every
state they can be in renders on its own, and the interaction itself is the pure
`pickUp(lineup, selected, driverId)` in `GridStage.tsx`, which is where the
select-then-swap rule is tested. The swap rules underneath it are unit-tested in
`@alt-hist/data`; where an applied grid ends up is tested in the store.

The **supplier picker is a native `select`** partly for that reason: it is the one
control in the editor whose state a DOM-less test can read back, since React renders
`selected=""` on the chosen option. `engines.test.tsx` reads the selected values in card
order rather than searching for a name — a works team is called the same thing as one of
the options in every other team's picker.

What this level cannot reach: the click handlers, the scroll-to-top effect, the
start-again confirming flag, the editor's open/closed toggle, and popover contents,
which Radix does not render while closed. All would need jsdom. Where a click *ends
up* is covered: it ends up in the store, or in `pickUp`.
