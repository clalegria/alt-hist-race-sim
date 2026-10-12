---
paths:
  - "apps/web/src/components/MainMenu.tsx"
  - "apps/web/src/components/SeasonPicker.tsx"
  - "apps/web/src/components/YearPicker.tsx"
  - "apps/web/src/components/SeasonSwitcher.tsx"
  - "apps/web/src/components/BackToSetup.tsx"
  - "apps/web/src/lib/preferences.ts"
  - "apps/web/src/App.tsx"
---

# Web app — the setup screen, and getting back out

Everything before a race is simulated, plus the navigation that runs through every screen
afterwards. The screens themselves and how any of this is tested are
`.claude/rules/web-app.md`; what a season is built from is `.claude/rules/web-store.md`.

**Nothing is simulated until the button at the foot of the page.** Every control on
`SeasonPicker` only *answers* something, and one full-width `Begin …` commits the lot,
so the year, the level and the run settings reach `onStart` together and what was on
screen is what gets simulated.

**The year picker is a rail of decades, then the years in one of them**, in
`YearPicker` — seventy-seven near-identical numbers in one block was a wall rather than
a choice. It is **controlled by the selected year alone**: which decade is open is
`decadeOf(year)`, not a second piece of state beside it, so the picker cannot reach the
one incoherent position it otherwise could — a decade open with the selection somewhere
else and the Begin button quietly naming a year that is not on screen. Picking a decade
therefore *selects* its earliest playable year. That single-value shape is also what
keeps every state renderable without a click.

**The year sticks, like the settings.** `readSeasonYear` /
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

**The run settings are a line under the heading** (`RunSettingsLine`) whose ⚙ button
opens them in a dialog — the same line, in the same place, as on the grid. The line, the
dialog, the settings and when the grid may still change them are
`.claude/rules/web-run-settings.md`.

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
answer a one-button question. Drawn **only on the grid** — past it the reader has
seen results that switching would throw away — and **only in a standalone season**, since an era's year belongs to the run.
The neighbours come from `adjacentSeason(year, ±1)` in `lib/seasons.ts`, which walks
`PLAYABLE_SEASONS` rather than adding one, so a gap in the seed data is skipped rather
than offered.

**A run has no Back button of its own, but for one case.** The browser's Back moves
between its pages, and a Back past its first page — onto the setup page — asks whether
to exit the run (`.claude/rules/web-run-bar.md`). The case is **an era's first grid**,
whose year cannot be switched: `BackToSetup` (`← Back to setup`) rides in the settings
line's `extra` slot where `SeasonSwitcher` would, and pushes `/era/new`, the run left in
the store like any untouched one. `backToSetupLock(run)` in `lib/settings-lock.ts` says
whether it is drawn (undefined) and why it is greyed out: once the grid is edited
(`isUntouched`), the reason on its wrapper as the disabled Continue has; while the
editor is open, `EDITING_LOCK`. Changed settings leave it open: the setup page reopens
on them. **A setup page has no sticky bar at all**: the bar
is the run's, and starts at its grid. The top nav is the way off a setup page. On every
page that has a bar, **navigation is its right-hand end**.

