---
paths:
  - "apps/web/src/components/RunSettingsDialog.tsx"
  - "apps/web/src/components/RunSettingsLine.tsx"
  - "apps/web/src/components/SettingSegments.tsx"
  - "apps/web/src/components/RandomnessSlider.tsx"
  - "apps/web/src/components/PointsSetting.tsx"
  - "apps/web/src/components/BreakdownsSetting.tsx"
  - "apps/web/src/components/ReliabilitySetting.tsx"
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/components/CareerEventsSetting.tsx"
  - "apps/web/src/components/TeamNamesSetting.tsx"
  - "apps/web/src/components/TeamsAndSeatsSetting.tsx"
  - "apps/web/src/components/SimulationSettings.tsx"
  - "apps/web/src/components/ui/dialog.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/settings-lock.ts"
  - "apps/web/src/store/settings.test.ts"
---

# Web app — the run settings

The randomness level and the run's what-ifs: how they are shown, changed and locked.
The setup screen around them is `.claude/rules/web-setup.md`; what a world keeps of them
is `.claude/rules/web-store.md`.

## The line and the dialog

**`RunSettingsLine` is the same row on the setup screen and on the grid**, the first
thing under the heading on both: the settings in force (`SimulationSettings` over
`settingsOf`, "everything else as it was" when nothing is a what-if) and a **⚙ Settings**
button. On the grid the year switcher (`SeasonSwitcher`) rides in its `extra` slot. A
season's screen states `seasonSettings` of what it holds, never an era's answers. The
cog is `.settings-icon` in `index.css`, a mask over `currentColor` like the page link's,
because tests count flags by counting `<svg>`.

**`RunSettingsDialog`** (Radix `Dialog`, `ui/dialog.tsx`) holds a **draft**, seeded each
time it opens — Radix unmounts the content on close, so `DraftForm`'s state is fresh.
Done hands it to `onCommit`; Cancel, Escape or a click outside drop it. On the grid a
commit re-simulates the season, which is worth asking once rather than on every click.
On setup, `SeasonPicker`'s commit remembers it (`rememberRandomness`,
`rememberRunSettings`).

**Read-only under a `lock`** (`RunSettingsFields`): the reason above the form, the form in
one disabled native `fieldset` (which disables every control inside it at once while
still showing the choice), and Close instead of Cancel and Done. The button stays live
and carries the reason as its `title`.

## When the grid can change them

**While the run is untouched** (`isUntouched`): its first grid, as entered. The reasons
are `settingsLock(run)` in `lib/settings-lock.ts` — an edited first grid says Clear all
edits gets them back; past the grid or a later era year, fixed for the run. `RunPlacePage`
computes it; `SeasonBody` adds `EDITING_LOCK` while the grid editor is open, since a
rebuild under a draft is what hides the year switcher too. Every grid page draws the
line, a raced one read-only.

`setRunSettings(randomness, settings)` in the store refuses unless untouched, then
rebuilds **on the same seed** — `startSeason`'s or `startEra`'s own build, so the era's
first-year records (`gridKeptFrom`, `namesKeptFrom`) follow — and the run stays
untouched. It remembers what it sets; on a standalone season through
`rememberedAfterSeason`, which keeps the remembered era-only answers (and an era's walk
the season only read as the real car) that the season never showed.

## The form

`RunSettingsForm`, controlled, in groups (`RunSettingsGroup`; a setting is a *direct
child*, which applies the padding and the rules between): **Races** — Randomness,
Points; **Cars** — Car performance, Breakdowns, Reliability (together because one greys
the other out); **Over the years**, era only (`eraSettings`) — Career events, Team names,
Teams and seats. Two columns from `lg`: an era's Races + Cars beside its years, a
season's Races beside Cars. The form passes the whole remembered set through, so a
season's screen never drops an era answer it does not show.

**A what-if has its historical answer first**, and its value is **null when
historical**, as `lineup` is: segments (`SettingSegments`, copying `RatingModeToggle`'s
button group) or, for an answer picked from a list, one native `select` whose first
option is historical (`SettingSelect`). **A note only for a what-if** (`SettingNote`):
the historical label says what it is. Sub-options sit in `SettingSub`, set in under
their answer, with `sub` segments and no note of their own. The words follow `unit`
(`RunUnit`): an era talks about every year, a season about the one.

The values live in `lib/run-settings.ts`: `RunSettings`, `HISTORICAL_SETTINGS`,
`parseRunSettings` (the one check for the recipe and the remembered preference, accepting
only values this build could offer) and `whatIfsOf`, the line's entries.

- **Breakdowns**: *Realistic* / *Fewer* / *None*, null / `"fewer"` / `"none"`
  (`BREAKDOWNS_LABELS`). What it does to the constants is
  `.claude/rules/retirement-factor.md`.
- **Reliability**: a `select` of *Each year's own* (*As it was* on a season) then every
  playable year by decade, stored as the year — not the 1–10 factor, an authoring dial no
  reader knows. Greyed out under Breakdowns: None; the choice is kept, and `createWorld`
  records only `settingsInForce`, so no world claims a setting that changed nothing.
- **Points**: a `select` of the historical answer (a season's names its own table)
  then `pointsTables()`, the distinct tables in the seed data, derived. Scoring only: the
  same seed races the same races under any table.
- **Car performance**: `.claude/rules/car-performance.md`.
- **Career events**: *As they happened* / *None*, null / `"none"` — never "form", which
  the market owns. None races every driver without `stepDown` and `offSeasons`
  (`driverPoolOf`); the events count only under `aged`, which an era always runs.
- **Team names**: *As they happened* / *Keep the first*, null / `"first"`: each team keeps
  its first season's name and base, its livery still changes (`team-eras.md`).
- **Teams and seats**: null or `EmptySeatRules` (`teams-and-seats.md`).

One remembered set serves both screens; the store drops the era-only ones from a
standalone season (`seasonSettings`, in `startSeason`, `simulate` and `setRunSettings`).

## Testing

The dialog renders into a portal, so its contents are tested through `RunSettingsForm`
(`settingsForm(unit)` in `test-support.ts`) and `RunSettingsFields`; the line, the lock's
`title` and the Clear link in `run-settings-dialog.test.tsx`; the lock rule in
`lib/settings-lock.test.ts`; the rebuild in `store/settings.test.ts` (mutation-checked:
dropping the guard fails three). Opening, committing and the read-only state run in a
real browser in `pnpm screenshots` (`season-settings`, `grid-settings`,
`grid-settings-locked`, `era-setup`).
