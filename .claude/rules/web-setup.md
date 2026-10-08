---
paths:
  - "apps/web/src/components/MainMenu.tsx"
  - "apps/web/src/components/SeasonPicker.tsx"
  - "apps/web/src/components/YearPicker.tsx"
  - "apps/web/src/components/RunSettingsCard.tsx"
  - "apps/web/src/components/PointsSetting.tsx"
  - "apps/web/src/components/BreakdownsSetting.tsx"
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/components/ReliabilitySetting.tsx"
  - "apps/web/src/components/CareerEventsSetting.tsx"
  - "apps/web/src/components/TeamNamesSetting.tsx"
  - "apps/web/src/components/TeamsAndSeatsSetting.tsx"
  - "apps/web/src/components/SettingSegments.tsx"
  - "apps/web/src/lib/run-settings.ts"
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
to start the run on the spot, which made the settings above it a trap: a reader who
reached for a year first — as most will — was into the season before they had seen that
randomness was theirs to choose. Every control on `SeasonPicker` now only *answers*
something, and one full-width `Begin …` commits the lot, so the year, the level and the
run settings reach `onStart` together and what was on screen is what gets simulated.

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

**The run settings card** (`RunSettingsCard`) holds Randomness and the run's what-ifs, in headed groups (`RunSettingsGroup`: Races and Cars,
then the era-only Drivers and Teams over the years). A setting is a *direct
child* of its group, which applies the padding and the rules between them, so adding one
is adding a child. What does not belong there is anything a reader can still change once
a season exists; the ability toggle is on the grid for that reason.

**A what-if setting** is a segmented control with the historical answer first and the
default (`SettingSegments`, copying `RatingModeToggle`'s button group), and
its value is **null when historical**, as `lineup` is. The values live in
`lib/run-settings.ts`: `RunSettings`, `HISTORICAL_SETTINGS`, `parseRunSettings` (the one
check for both the recipe and the remembered preference, which accepts only values this
build could offer) and `whatIfsOf`, the settings line's entries for anything not
historical. Remembered like Randomness (`readRunSettings` / `rememberRunSettings`).

The Races group reads Randomness, **Breakdowns**, **Reliability**, Points, on both setup
screens. What the first two do to the constants is `.claude/rules/retirement-factor.md`.

- **Breakdowns** is *Realistic* / *Fewer* / *None*, stored as null / `"fewer"` /
  `"none"` — `"realistic"` is refused by `parseRunSettings`, so there is one way to say
  historical. Labels are `BREAKDOWNS_LABELS`.
- **Reliability** is *Each year's own* (*As it was* on a season's screen) or *As in a
  year*, stored as a playable year. A
  year rather than the 1–10 factor, which is an authoring dial no reader knows. Switching
  in picks the selected year; the native `select` lists `PLAYABLE_SEASONS` by decade.
  It sets how often **cars** break down, so under Breakdowns: None it is greyed out
  (`SettingSegments`' `disabled`, on the native `fieldset`). The picker and the
  preference keep the reader's choice, so switching back restores it; `createWorld`
  records only `settingsInForce`, which drops it, so no world claims a setting that
  changed nothing.

**Points** is *Each year's own* or *Same all run* (*As it was* / *From a year* on a
season's screen) with a native `select` of
`pointsTables()`: the distinct tables in the seed data, labelled by their years and
values, derived rather than listed. Switching in picks the selected year's
table. Points are scoring only, so the same seed races the same races under any table.

**Their words follow the screen** (`unit`, a `RunUnit`, required so no caller gets the
era's by default): an era talks about every year and the run, a season about the one
year. The second answer names where the value comes from rather than calling it another
year's, because switching in starts on the selected year itself.

**The Cars group** holds **Car performance**, on both screens
(`.claude/rules/car-performance.md`). **The Drivers group is era only**: `SeasonPicker`
draws it under `eraSettings`, which `EraPicker` passes. It holds **Career events** — *As they happened* / *None*, stored as
null / `"none"`; "Career events", never "form", which the market owns. None races every
driver without their `stepDown` and `offSeasons` (`driverPoolOf`; the pool is
`.claude/rules/data-layers.md`); the events only count under `aged`, which an era always runs. One
remembered set serves both screens, so the store drops era-only settings from a
standalone season (`seasonSettings`, in `startSeason` and `simulate`) and no season
records one. A *random* careers answer (`docs/design/era-advanced.md`) is one more
segment.

**Teams over the years** is era only too, after Drivers. It holds **Team names**: *As
they happened* / *Keep the first*, stored as null / `"first"`. Under Keep, each team keeps
the name and base of its first season in the run, and its livery still changes. The rule
is `.claude/rules/team-eras.md`, and `seasonSettings` drops it from a season. Then
**Teams and seats**, null or `EmptySeatRules`: `.claude/rules/teams-and-seats.md`.

**`max-w-prose` is for paragraphs, not for one-line notes.** The setup screen's lead is
capped because it runs to two or three lines and is read down. The notes inside the
panels are not: a single sentence capped at 65ch inside a card several hundred pixels
wider leaves a stubby column with a hard edge two-thirds of the way across, which reads
as a mistake because it looks like one.

**No component may read a season fixed at import time.** Round names come from the
world's own year — `SeasonOverview` resolves `seasonSeed(world.year)` and hands
`SeasonCalendar` a `calendar` prop. This was the 1980 coupling the roadmap called
out, and getting it wrong is invisible: 1981 renders perfectly well with 1980's round
names. `seasons.smoke.test.tsx` walks every authored season through every stage and
checks each round against its own calendar entry.

**Restart season asks first**, in the run's confirm dialog
(`.claude/rules/web-run-bar.md`). It draws a **fresh seed for the same year and the same
`ratingMode`**: another go, not a replay, and everything the reader *chose* carries over
— only the dice change. An era's *Restart era* is `.claude/rules/web-era.md`.

**The grid offers the seasons either side of it**, in `SeasonSwitcher` — the shortcut
for a reader who has just watched 1980 and wants 1981. It is where Restart season lands them, and the alternative was Back plus a decade rail to
answer a one-button question. Drawn **only on the grid**, for the reason
`RatingModeToggle` is — past it the reader has seen results that switching would throw
away — and **only in a standalone season**, since an era's year belongs to the run.
The neighbours come from `adjacentSeason(year, ±1)` in `lib/seasons.ts`, which walks
`PLAYABLE_SEASONS` rather than adding one, so a gap in the seed data is skipped rather
than offered.

**A run has no Back button of its own.** The browser's Back moves between its pages,
and a Back past its first page — onto the setup page — asks whether to exit the run
(`.claude/rules/web-run-bar.md`). **A setup page has no sticky bar at all**: the bar
is the run's, and starts at its grid. The top nav is the way off a setup page. On every
page that has a bar, **navigation is its right-hand end**.

