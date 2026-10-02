---
paths:
  - "apps/web/src/components/MainMenu.tsx"
  - "apps/web/src/components/SeasonPicker.tsx"
  - "apps/web/src/components/YearPicker.tsx"
  - "apps/web/src/components/Preferences.tsx"
  - "apps/web/src/components/RandomnessSlider.tsx"
  - "apps/web/src/components/SimulationSettings.tsx"
  - "apps/web/src/components/SeasonSwitcher.tsx"
  - "apps/web/src/lib/preferences.ts"
  - "apps/web/src/App.tsx"
---

# Web app — the setup screen, and getting back out

Everything before a race is simulated, plus the navigation that runs through every screen
afterwards. The screens themselves and how any of this is tested are
`.claude/rules/web-app.md`; what a season is built from is `.claude/rules/web-store.md`.

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

**"Start again" asks first, inline in the run bar** — it only re-runs this year, so it
does not need the exit dialog. It draws a **fresh seed for the same year and the same
`ratingMode`**: another go, not a replay, and everything the reader *chose* carries over
— only the dice change. Both copies of the action row — sticky bar and page foot — share
one confirming flag so they cannot disagree. There is no *Main menu* beside it: going
Home no longer ends a run.

**The grid offers the seasons either side of it**, in `SeasonSwitcher` — the shortcut
for a reader who has just watched 1980 and wants 1981. It is where Start again lands them, and the alternative was Back plus a decade rail to
answer a one-button question. Drawn **only on the grid**, for the reason
`RatingModeToggle` is — past it the reader has seen results that switching would throw
away — and **only in a standalone season**, since an era's year belongs to the run.
The neighbours come from `adjacentSeason(year, ±1)` in `lib/seasons.ts`, which walks
`PLAYABLE_SEASONS` rather than adding one, so a gap in the seed data is skipped rather
than offered.

**A run has no Back button of its own.** The browser's Back moves between its pages,
and a Back past its first page — onto the setup page — asks whether to exit the run
(`.claude/rules/web-routing.md`). The year picker's Back is `BackBar` in `App.tsx`, rendered into the **sticky
bar** — it draws none of its own navigation — so every screen keeps its way out in the
same place, rather than one of them hiding it under six rows of year buttons.
**Navigation is always the right-hand end of that bar**, on every screen that has any.

