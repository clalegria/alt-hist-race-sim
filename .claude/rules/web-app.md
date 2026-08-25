---
paths:
  - "apps/web/**"
---

# Web app

`apps/web` reveals a season a session at a time. React + Vite, Tailwind 4, Zustand.
shadcn/ui components are **copied in, not a dependency** — but the Radix primitives
they wrap *are* real dependencies (currently `@radix-ui/react-popover`).

## Screens and state

**One union of screens.** `Screen` in `store/season.ts` is
`menu → season-setup → season` for a single year and
`menu → era-setup → era ⇄ era-champions` for a run of them, and a `World` is a *member
of the variants that have one* rather than a nullable field beside them — so the menu
cannot read a season nobody started and no component has to guard against one. Nothing
is simulated until a mode is chosen: the app opens on the menu having run no races at
all. **The era half is `.claude/rules/web-era.md`**, which loads alongside this file on
the store and `App.tsx`; everything below describes both unless it says otherwise, since
an era is the same season screen with a run carried beside it.

Modes come from `lib/modes.ts` and years from `lib/seasons.ts`; both list what does
not exist yet — the unbuilt modes, and any year without seed data — as disabled entries
rather than omitting it. **`lib/seasons.ts` holds no list of its own** —
`PLAYABLE_SEASONS` and `isPlayable` come straight from `authoredSeasons` in
`@alt-hist/data`, so authoring a season is a file in `packages/data/src/seasons/` and
the UI follows. The split: which years *exist* is a data decision, the `FIRST_SEASON`–
`LAST_SEASON` *range the picker draws* is a display decision and lives here. Every year
in the range is authored today, so what still proves the rule is that a year *outside*
it is not playable. `playableSummary()` writes the picker's
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

## The world, and what a season is built from

The `World` itself — the ability mode, the two halves of an editable grid, the RNG
snapshot, what is derived rather than stored, and where a seed comes from — is
`.claude/rules/web-store.md`, which loads on the store and on the `lib/` modules that
feed it.

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

Split in two, plus the era's own screens in `.claude/rules/web-era.md`.
`.claude/rules/web-display.md` owns the reveal — the sessions, their
tables and the accent — and loads alongside this file whenever you open anything in
`src/components/`. `.claude/rules/web-grid.md` owns the grid and its editor, and loads
on those files plus `lib/people.ts` and `lib/rating.ts`.

## Type, palette and theme

In `.claude/rules/web-styling.md`, which loads when you touch the stylesheet,
`index.html` or the theme module. **Read it before editing `src/index.css`** — the
nested-`@theme` trap it documents has broken this app once already.

## Testing

Vitest with **no jsdom**. `SeasonView` takes the world and the cursor as **props**
rather than reading the store, so every stage renders through `renderToStaticMarkup`
without a DOM and without clicking through fourteen rounds; `MainMenu` and
`SeasonPicker` take their callbacks the same way — the only level at which a greyed-out
mode or an unplayable year can be checked. `App` connects all three.

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
