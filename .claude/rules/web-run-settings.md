---
paths:
  - "apps/web/src/components/RunSettingsDialog.tsx"
  - "apps/web/src/components/RunSettingsLine.tsx"
  - "apps/web/src/components/SettingSegments.tsx"
  - "apps/web/src/components/RandomnessSlider.tsx"
  - "apps/web/src/components/PointsSetting.tsx"
  - "apps/web/src/components/BreakdownsSetting.tsx"
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/components/EnginePerformanceSetting.tsx"
  - "apps/web/src/components/DevelopmentSetting.tsx"
  - "apps/web/src/components/DriverAbilitySetting.tsx"
  - "apps/web/src/components/WhoDrivesSetting.tsx"
  - "apps/web/src/components/DriverPoolSetting.tsx"
  - "apps/web/src/components/AgeRangeInput.tsx"
  - "apps/web/src/components/CareerEventsSetting.tsx"
  - "apps/web/src/components/TeamsSetting.tsx"
  - "apps/web/src/components/TeamNamesSetting.tsx"
  - "apps/web/src/components/LiveriesSetting.tsx"
  - "apps/web/src/components/EngineSuppliersSetting.tsx"
  - "apps/web/src/components/SimulationSettings.tsx"
  - "apps/web/src/components/ui/dialog.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/settings-lock.ts"
  - "apps/web/src/store/settings.test.ts"
---

# Web app — the run settings

The randomness level (*Luck on the day* on screen), a season's driver ability and the
run's what-ifs: how they are shown, changed and locked.
The setup screen around them is `.claude/rules/web-setup.md`; what a world keeps of them
is `.claude/rules/web-store.md`.

## The line and the dialog

**`RunSettingsLine` is the same row on the setup screen and on the grid**, the first
thing under the heading on both: what differs from the defaults (`SimulationSettings` over
`settingsOf`: the level off `STARTING_RANDOMNESS_LEVEL`, *At their best*, then each what-if
in force in the form's order, `whatIfsOf`; "Default settings" when nothing does, there and
on the summary and roll of honour) and a **⚙ Settings** button. After a non-empty line, a
**Restore defaults** link (styled as the grid's Clear all edits) commits `defaultChoice`
at once, unasked; not drawn under a lock or without `onCommit`. On the grid the year
switcher (`SeasonSwitcher`) rides in its `extra` slot. A season's screen states
`seasonSettings` of what it holds, never an era's answers. The cog is `.settings-icon` in
`index.css`, a mask over `currentColor`, because tests count flags by counting `<svg>`.

**`RunSettingsDialog`** (Radix `Dialog`, `ui/dialog.tsx`) holds a **draft**, seeded each
time it opens — Radix unmounts the content on close, so `DraftForm`'s state is fresh.
Done hands it to `onCommit`; Cancel, Escape or a click outside drop it. On the grid a
commit re-simulates the season, which is worth asking once rather than on every click.
On setup, `SeasonPicker`'s commit remembers it (`rememberRandomness`,
`rememberRunSettings`, and on a season's screen `rememberRatingMode`; an era's opens on
`ERA_RATING_MODE`). **Restore defaults**, on the footer's left, sets the draft to
`historicalSettings`, `STARTING_RANDOMNESS_LEVEL` and, on a season's, drivers as they
were. Each screen keeps what it does not show: an era's the ability, a season's the
era-only answers and, while those keep teams, their signing pool. Disabled when there
is nothing to restore, absent under a lock.

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

`setRunSettings(randomness, settings, ratingMode)` in the store refuses unless
untouched, then rebuilds **on a fresh seed** — `startSeason`'s or `startEra`'s own build,
so the era's first-year records (`gridKeptFrom`, `namesKeptFrom`) follow — and the run
stays untouched. Fresh because on the same seed *Chassis performance* turned away and back
rolls the same cars, so the pecking order never moves. A Done that changes nothing in
force (`sameSettings` over `settingsInForce`) rebuilds nothing. It remembers what it
sets; on a standalone season through `rememberedAfterSeason`, which keeps the remembered
era-only answers (and an era's walk the season only read as the real car).

## The form

`RunSettingsForm`, controlled, in groups (`RunSettingsGroup`; a setting is a *direct
child*, which applies the padding and the rules between): **Races** — Luck on the day,
Points system; **Drivers** — Driver ability (season only), Who drives where, Drivers who
can be signed, Driver career events (era only); **Cars** — Chassis performance, Engine
performance, In-season development, Mechanical failures (with Cars as reliable as under
it); **Over the years**, era only (`eraSettings`) — Teams, Team name changes, Livery
changes, Engine supplier changes. Two columns from `lg`, Races + Drivers beside Cars (+
Over the years); one column below it, in that order. The form passes the whole
remembered set through, so a season's screen never drops an era answer it does not show.

**A what-if has its historical answer first**, its value **null when historical**:
segments (`SettingSegments`) or, picked from a list, a native `select` (`SettingSelect`).
**The historical answer is *Historical*, or *Yes* / *No* for an on-off setting.** **A
note only for a what-if** (`SettingNote`), following `unit` (`RunUnit`): an era's says
every season. Sub-options sit in `SettingSub` under their answer — `sub` segments, a
select, a tick box (`SettingCheck`) — with no note of their own, and are remembered
while the dialog is open.

The values live in `lib/run-settings.ts`: `RunSettings`, `HISTORICAL_SETTINGS`,
`parseRunSettings` (the one check for the recipe and the remembered preference, accepting
only values this build could offer) and `whatIfsOf`, the line's entries.

- **Driver ability**: *As they were that year* / *At their best*, `world.ratingMode`
  rather than a setting, carried in `RunChoice` (`web-store.md`). Season only.
- **Who drives where**: `seating`, null or `{ kind, includeUnemployed }`, both screens:
  a `select` of *Historical* then `ARRANGEMENT_LABELS`, with *Drivers without a drive can
  take a seat* under a rule. Every year's grid reseated (`grid-arrangements-app.md`).
- **Drivers who can be signed**: `driverPool`, a `SigningPool`, never null: an age range
  (`AgeRangeInput`, "Peak age" at their best) and *Only drivers racing that year*. Shown
  only while something signs (`signsDrivers`: a reseat taking drivers without a drive, or
  an era's kept teams); else in force as `OPENING_DRIVER_POOL`, and only named off it.
- **Driver career events**: *Yes* / *No*, null / `"none"` — never "form", which the
  market owns. No races every driver without `stepDown` and `offSeasons` (`driverPoolOf`).
- **Mechanical failures**: *Realistic* / *Fewer* / *None*, null / `"fewer"` / `"none"`
  (`BREAKDOWNS_LABELS`; the constants are `retirement-factor.md`). Under Realistic and
  Fewer, **Cars as reliable as**: *Each season* (*This season*) then every playable year,
  stored as the year, never the 1–10 factor. Hidden under None, the choice kept;
  `createWorld` records only `settingsInForce`. One note for the pair.
- **Points system**: a `select` of *Historical* then `pointsTables()`, the distinct tables
  in the seed data. Scoring only: the same seed races the same races under any table.
- **Chassis performance** and **Engine performance**: `.claude/rules/car-performance.md`.
- **In-season development**: *Historical* / *Random* / *Off*, null / `"random"` /
  `"none"` (`DEVELOPMENT_LABELS`): `.claude/rules/car-development.md`.
- **Teams**: *Historical* / *The first season's teams*, `teams`, null or `{ fill }`, era
  only; *Empty seats go to* under it, hidden under a reseat (`teams-and-seats.md`).
- **Team name changes**, **Livery changes**, **Engine supplier changes**: *Yes* / *No*,
  null / `"first"`: under No each team keeps its first season's name and base, livery or
  engine supplier (`team-eras.md`; `withFirstEngines`, `data-layers.md`).

`parseRunSettings` also reads `teamsAndSeats`, the shape before `teams`, `seating` and
`driverPool` split. One remembered set serves both screens; the store drops the era-only
ones from a standalone season (`seasonSettings`, in `startSeason`, `simulate` and
`setRunSettings`).

## Testing

The dialog renders into a portal, so its contents are tested through `RunSettingsForm`
(`settingsForm(unit, settings, ratingMode)` in `test-support.ts`) and `RunSettingsFields`:
which row shows when in each setting's own test (`drivers-settings.test.tsx` for the
Drivers group and the age range); the line, the lock's `title` and the Clear link in
`run-settings-dialog.test.tsx`; Restore defaults and the line's entries in
`lib/run-settings.test.ts`; the lock rule in `lib/settings-lock.test.ts`; the rebuild and
the no-op in `store/settings.test.ts` (mutation-checked: dropping the guard fails three;
`Math.random` is stubbed there, so the fresh seed is known). Opening, committing and the
read-only state run in a real browser in `pnpm screenshots` (`season-settings`,
`grid-settings`, `grid-settings-locked`, `era-setup`).
