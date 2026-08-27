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

## The setup screen

**Nothing is simulated until the button at the foot of the page.** Picking a year used
to start the run on the spot, which made the preferences above it a trap: a reader who
reached for a year first — as most will — was into the season before they had seen that
randomness was theirs to choose. Every control on `SeasonPicker` now only *answers*
something, and one full-width `Begin …` commits the lot, so the year and the level reach
`onStart` together and what was on screen is what gets simulated.

**The year picker is a rail of decades, then the years in one of them**, in
`YearPicker` — seventy-seven near-identical numbers in one block was a wall rather than
a choice. It is **controlled by the selected year alone**: which decade is open is
`decadeOf(year)`, not a second piece of state beside it, so the picker cannot reach the
one incoherent position it otherwise could — a decade open with the selection somewhere
else and the Begin button quietly naming a year that is not on screen. Picking a decade
therefore *selects* its earliest playable year. That single-value shape is also what
keeps every state renderable without a click.

**The year sticks, like the other two answers.** `readSeasonYear` /
`rememberSeasonYear` in `lib/preferences.ts` seed the picker and are written on every
selection, so coming back to try the season after the one just run does not hand the
reader 1950 again. It was deliberately *not* remembered while a run was a one-off — the
year is the question the screen is asking — and that reasoning stopped holding once
readers started stepping through a decade. **One key for both pickers**: a season and
an era ask the same question of the same years, and two answers to "which year was I
on" is worse than one. Validated against `isPlayable` on the way out rather than merely
parsed, since a stored year with no seed file behind it reaches `seasonSeed`, which
throws.

**`YearPicker` takes `playable` as a prop** (defaulting to `isPlayable`) purely so the
disabled branches can be tested. Every season from 1950 to 2026 is authored, so against
the seed data an unavailable year cannot occur — assertions about it pass just as
happily with the disabling removed, which is how the test this replaced was passing.
The two tests that care hand it a range with a gap in it.

**Randomness lives in `Preferences`**, a panel named for the category rather than for
its one occupant, because it is going to gain others. A setting is a *direct child* —
the padding and the rules between them are applied by the panel — so adding one is
adding a child. What does not belong there is anything a reader can still change once a
season exists; the ability toggle is on the grid for that reason, and moving it would be
a decision about when it stops being changeable rather than a tidying-up.

**`max-w-prose` is for paragraphs, not for one-line notes.** The setup screen's lead is
capped because it runs to two or three lines and is read down. The notes inside the
panels are not: a single sentence capped at 65ch inside a card several hundred pixels
wider leaves a stubby column with a hard edge two-thirds of the way across, which reads
as a mistake because it looks like one.

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

**The grid offers the seasons either side of it**, in `SeasonSwitcher` — the shortcut
for a reader who has just watched 1980 and wants 1981. It is where "Start again →
Beginning of the season" lands them, and the alternative was Back plus a decade rail to
answer a one-button question. Drawn **only on the grid**, for the reason
`RatingModeToggle` is — past it the reader has seen results that switching would throw
away — and **only in a standalone season**, since an era's year belongs to the run.
The neighbours come from `adjacentSeason(year, ±1)` in `lib/seasons.ts`, which walks
`PLAYABLE_SEASONS` rather than adding one, so a gap in the seed data is skipped rather
than offered.

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
