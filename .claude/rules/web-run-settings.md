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
  - "apps/web/src/components/CareerEventsSetting.tsx"
  - "apps/web/src/components/TeamNamesSetting.tsx"
  - "apps/web/src/components/LiveriesSetting.tsx"
  - "apps/web/src/components/EngineSuppliersSetting.tsx"
  - "apps/web/src/components/TeamsAndSeatsSetting.tsx"
  - "apps/web/src/components/SimulationSettings.tsx"
  - "apps/web/src/components/ui/dialog.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/settings-lock.ts"
  - "apps/web/src/store/settings.test.ts"
---

# Web app — the run settings

The randomness level (*Luck on the day* on screen) and the run's what-ifs: how they are
shown, changed and locked.
The setup screen around them is `.claude/rules/web-setup.md`; what a world keeps of them
is `.claude/rules/web-store.md`.

## The line and the dialog

**`RunSettingsLine` is the same row on the setup screen and on the grid**, the first
thing under the heading on both: what differs from the defaults (`SimulationSettings` over
`settingsOf`: the level off `STARTING_RANDOMNESS_LEVEL`, then each what-if; "Default
settings" when nothing does, there and on the summary and roll of honour) and a
**⚙ Settings** button. After a non-empty line, a **Restore defaults** link (styled as the
grid's Clear all edits) commits `defaultChoice` at once, unasked; not drawn under a lock
or without `onCommit`. On the grid the year switcher (`SeasonSwitcher`) rides in its `extra` slot. A
season's screen states `seasonSettings` of what it holds, never an era's answers. The
cog is `.settings-icon` in `index.css`, a mask over `currentColor` like the page link's,
because tests count flags by counting `<svg>`.

**`RunSettingsDialog`** (Radix `Dialog`, `ui/dialog.tsx`) holds a **draft**, seeded each
time it opens — Radix unmounts the content on close, so `DraftForm`'s state is fresh.
Done hands it to `onCommit`; Cancel, Escape or a click outside drop it. On the grid a
commit re-simulates the season, which is worth asking once rather than on every click.
On setup, `SeasonPicker`'s commit remembers it (`rememberRandomness`,
`rememberRunSettings`). **Restore defaults**, on the footer's left, sets the draft to
`historicalSettings` and `STARTING_RANDOMNESS_LEVEL`; a season's keeps the era-only
answers it does not show. Disabled when there is nothing to restore, absent under a lock.

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
rebuilds **on a fresh seed** — `startSeason`'s or `startEra`'s own build, so the era's
first-year records (`gridKeptFrom`, `namesKeptFrom`) follow — and the run stays
untouched. Fresh because on the same seed *Chassis performance* turned away and back rolls
the same cars, so the pecking order never moves. Settings that leave the world as it was
(`sameSettings` over `settingsInForce`, a Done with nothing changed) rebuild nothing. It remembers what it sets; on a standalone season through
`rememberedAfterSeason`, which keeps the remembered era-only answers (and an era's walk
the season only read as the real car) that the season never showed.

## The form

`RunSettingsForm`, controlled, in groups (`RunSettingsGroup`; a setting is a *direct
child*, which applies the padding and the rules between): **Races** — Luck on the day,
Points system; **Cars** — Chassis performance, Engine performance, In-season development,
Mechanical failures (with Cars as reliable as under it); **Over the years**, era only
(`eraSettings`) — Driver career events, Team name changes, Livery changes, Engine supplier
changes, Keep the first season's teams. Two columns from `lg`: an era's Races + Cars
beside its years, a season's Races beside Cars. The form passes the whole remembered set through, so a
season's screen never drops an era answer it does not show.

**A what-if has its historical answer first**, and its value is **null when
historical**, as `lineup` is: segments (`SettingSegments`, copying `RatingModeToggle`'s
button group) or, for an answer picked from a list, one native `select` whose first
option is historical (`SettingSelect`). **The historical answer is *Historical*, or *Yes*
/ *No* for an on-off setting**, the same on both screens. **A note only for a what-if**
(`SettingNote`). Sub-options sit in `SettingSub`, set in under their answer, with `sub`
segments or select and no note of their own: the setting's one note says what the pair
does together. The notes follow `unit` (`RunUnit`): an era talks about every season, a
season about the one.

The values live in `lib/run-settings.ts`: `RunSettings`, `HISTORICAL_SETTINGS`,
`parseRunSettings` (the one check for the recipe and the remembered preference, accepting
only values this build could offer) and `whatIfsOf`, the line's entries.

- **Mechanical failures**: *Realistic* / *Fewer* / *None*, null / `"fewer"` / `"none"`
  (`BREAKDOWNS_LABELS`). What it does to the constants is
  `.claude/rules/retirement-factor.md`. Its sub-option **Cars as reliable as**, under
  Realistic and Fewer, is a `select` of *Each season* (*This season* on a season) then
  every playable year by decade, stored as the year — not the 1–10 factor, an authoring
  dial no reader knows. Hidden under None; the choice is kept, and `createWorld` records
  only `settingsInForce`, so no world claims a setting that changed nothing. One note for
  the pair (`BreakdownsSetting`); the settings line still names each.
- **Points system**: a `select` of *Historical* (a season's names its own table)
  then `pointsTables()`, the distinct tables in the seed data, derived. Scoring only: the
  same seed races the same races under any table.
- **Chassis performance** and **Engine performance**: `.claude/rules/car-performance.md`.
- **In-season development**: *Historical* / *Random* / *Off*, null / `"random"` /
  `"none"` (`DEVELOPMENT_LABELS`): `.claude/rules/car-development.md`.
- **Driver career events**: *Yes* / *No*, null / `"none"` — never "form", which
  the market owns. No races every driver without `stepDown` and `offSeasons`
  (`driverPoolOf`); the events count only under `aged`, which an era always runs.
- **Team name changes**, **Livery changes**, **Engine supplier changes**: *Yes* / *No*,
  null / `"first"`, each its own: under No each team keeps the name and base, the livery,
  or the engine supplier of its first season in the run (`team-eras.md`; the engines are
  `withFirstEngines`, `data-layers.md`).
- **Keep the first season's teams**: *No* / *Yes*, null or `EmptySeatRules`
  (`teams-and-seats.md`).

One remembered set serves both screens; the store drops the era-only ones from a
standalone season (`seasonSettings`, in `startSeason`, `simulate` and `setRunSettings`).

## Testing

The dialog renders into a portal, so its contents are tested through `RunSettingsForm`
(`settingsForm(unit)` in `test-support.ts`) and `RunSettingsFields`; the line, the lock's
`title` and the Clear link in `run-settings-dialog.test.tsx`; what Restore defaults resets
in `lib/run-settings.test.ts`; the lock rule in
`lib/settings-lock.test.ts`; the rebuild and the no-op in
`store/settings.test.ts` (mutation-checked: dropping the guard fails three; `Math.random`
is stubbed there, so the fresh seed is known). Opening, committing and the read-only state run in a
real browser in `pnpm screenshots` (`season-settings`, `grid-settings`,
`grid-settings-locked`, `era-setup`).
