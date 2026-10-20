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
  - "apps/web/src/components/YesNoSetting.tsx"
  - "apps/web/src/components/TeamsSetting.tsx"
  - "apps/web/src/components/SimulationSettings.tsx"
  - "apps/web/src/components/ui/dialog.tsx"
  - "apps/web/src/components/SeasonPicker.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/settings-lock.ts"
  - "apps/web/src/store/settings.test.ts"
---

# Run settings

The what-ifs in the settings dialog, beside the luck on the day and the driver ability.
`lib/run-settings.ts` holds the values; each setting's meaning is its doc comment there.

- **Fixed once the run is under way**: changeable only while it is `isUntouched`
  (`settingsLock`), and `setRunSettings` rebuilds on a fresh seed. Never add a way to
  change a setting mid-run.
- **A new setting** is: a `RunSettings` field whose historical answer is null, in
  `HISTORICAL_SETTINGS`; read in `parseRunSettings`, accepting only what this build
  offers; its one place into the simulation (`web-store.md`); a line in `whatIfsOf`;
  a component as a direct child of its tab's group in `RunSettingsForm`, and its answer
  under that tab in `SETTINGS_TABS`, which lights the tab's dot. Under another setting,
  its dependence goes in `settingsInForce`.
- **`parseRunSettings` requires every key**: a new required one resets every reader's
  remembered settings and refuses every saved run. Old shapes stay readable
  (`teamsAndSeats`).
- **An era-only setting** goes in `ERA_ONLY` and in the keys `seasonSettings`,
  `historicalSettings` and `rememberedAfterSeason` list by hand: a standalone season
  never runs one, and never erases the reader's remembered answer.
- **The driver ability is not a run setting**: it is `world.ratingMode`, carried beside
  them in `RunChoice`, season only. An era runs `ERA_RATING_MODE` and never reads or
  remembers it.
- **The screen keeps what it does not show.** The form passes the whole remembered set
  through; a sub-option is remembered while the dialog is open; a world records only
  `settingsInForce`.
- Copy: the historical answer comes first, named *Historical*, or *Yes* / *No* for an
  on-off; a note only under a what-if, following `unit`. Never call driver career events
  "form": the planned driver market owns that word.
- **A Yes / No setting is a row in `YesNoSetting`'s table**, never a component of its own.
  Every native `select`, the grid's engine picker too, takes `SETTING_SELECT_CLASS`.
- **`SimulationSettings` over `settingsOf` is the only list** of what a run was
  simulated under. Add to it, never write copy on a screen; folding a scenario into its
  name (`withScenario`) and "N more" are drawing only, so `settingsOf` stays whole.
