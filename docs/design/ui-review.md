# Design: UI consistency pass

A to-do list from a review of the whole web app. The review covered every screenshot step at both widths and in both themes, and swept `apps/web/src` three ways:
- components and styling
- pages and navigation
- data display

It found mostly **drift**: the same thing drawn, named or placed in several ways because features landed one at a time.

**The file reads in priority order: take the items top to bottom.**
- **The author has not sorted it yet** (*Sort the UI review*, `docs/ROADMAP.md`). Until an item is kept there, it is a suggestion, not a to-do.
- **Take one item per chat**, by its id (for example, do `qualifying-gap-overflow`).
- Each item names its files and the screenshot step that shows it.
- Line numbers marked `~` are approximate.
- When an item is built, its rule moves to the owning `.claude/rules/web-*.md` and the item is deleted here.
- When nothing is left, delete this file.

Some items also belong to a roadmap item in `docs/ROADMAP.md` and are tagged with it:
- *Phone layout* owns how phone screens are approached;
- *The text pass* is the wider copy rewrite.

- **DECIDED**: the author's decision.
- **PROPOSED**: a suggested fix. Confirm with the author before building it if it changes what the reader sees.
- **OPEN**: unresolved. The author settles it first, so the chat that takes it starts by asking.

---

## 4. Words

Mostly OPEN: the author picks the wording.

- **`settings-dialog-lead-when-locked`** (PROPOSED; *The text pass*)
  - The dialog's lead says "Set these before you start. They can't be changed once the racing begins." (`RunSettingsDialog.tsx:~309`). It says this even when opened read-only after racing has begun.
  - Fix: a lead for the locked state, or none.
  - Screenshot step: `grid-settings-locked`.
- **`settings-answer-polarity`** (OPEN; *The text pass*)
  - The real-history choice changes name and position from setting to setting:
    - "Yes" means real history for team names, liveries and engine suppliers.
    - "As they were that year" for *Driver ability* (`DriverAbilitySetting`).
    - Elsewhere real history is "Historical" (`PerformanceSetting.tsx:~79`, `DevelopmentSetting`) or "Realistic" (`BREAKDOWNS_LABELS`).
  - "Off" is variously "No", "Off" and "None".
  - Proposed: the real-history choice always first, always worded the same.
  - Screenshot step: `era-setup`.
- **`modeller-speak`** (OPEN; *The text pass*)
  - Strings a casual fan would not say:

    | String | Where |
    |---|---|
    | "Random factor is added", "Totally random", "Varies by up to ±20", "rating points" | `PerformanceSetting.tsx:~85-102` |
    | "Real → this run", "{year} spec", "Adaptability", "Composure" | `SeasonGrid.tsx:~44-46,892,935` |
    | "Weaken/Strengthen … chassis" | `SeasonGrid.tsx:~190,206` |
    | "Still ahead of the run" | `NotReached.tsx` |
    | "Simulate through 1985" | the Jump dialog |
    | "Seed 13601" | `SiteFooter.tsx:~43` |

  - Screenshot steps: `era-setup`, `era-grid-team`, `not-reached`.
- **`settings-summary-wall`** (OPEN; *The text pass*)
  - In an era, the settings line (`SimulationSettings` via `RunSettingsLine`) is a run-on wall of `Label: value`: three lines on desktop and about ten on a phone. It ends in "last year's driver first · ages 18–42 · real-grid drivers only".
  - Proposed: list only what differs from history, in plain words, collapsed behind "Settings ▸" past about three items.
  - Screenshot steps: `era-grid`, `era-champions --phone`.
- **`one-name-per-thing`** (OPEN; *The text pass*)
  - One thing, several names. Proposed winner first:

    | Thing | Variants today |
    |---|---|
    | Team | Team / Constructor (`SeasonView.tsx:~152,175`, `SeasonStandings.tsx:~89`) / Entry (`PersonPages.tsx`) |
    | Podiums | Podiums / Pods (`StandingsTable.tsx:~30`) |
    | Season | Season (`EraChampions.tsx:~198`) / Year (`PersonPages.tsx:~144`) |
    | Round 3 of 16 | Round 3 of 16 / Round 3/16 (`timeline.ts:~129`) |
    | Pick | Pick / Select ("Select any name…", "Select a race…") |
    | Era mode | "Era (basic)" in the nav (`areas.ts:~32-36`) / "Simulate an era" on Home and as the h1 |
    | Era overview | Era summary / Champions so far / Roll of honour / Between seasons |
    | Season page | the crumb "1984" / "1984 season page" / "Season summary" (an unseen title) |
    | Not yet | Not reached yet / not yet / (not yet) / Not yet / Not available yet / Not raced yet |
    | Grid-edit lock | "Finish or cancel the grid edit first." (`settings-lock.ts:~4`) / "Apply or cancel the grid edit first" (`run-bar.ts:~115`) / "Editing the grid. Apply or cancel it to carry on." (`RunBar.tsx:~235`) |
    | Drivers without a seat | Without a drive / unemployed / without a seat (`ReserveList.tsx:~199`, `LineupChanges.tsx:~66`) |
    | Age | (34y) / 34 years old. The grid and its popover show the rated age (the peak age in peak mode, unlabelled); the driver page shows the calendar age. |
    | Settings | Run settings / Settings / Default settings / Simulation settings |
    | Clearing edits | "Clear all edits" or "Clear manual edits" / "Clear your grid edits?" / "Clear edits" / "Clear your edits to change them" |
    | Restarts | "Restart this season?" / "Restart the era?" |
    | Start buttons | "Start an era in 1984" (screen-reader label) / "Begin an era starting in 1984" (`SeasonPicker.tsx:~157`) |
    | Skip | "Simulate full season" / "Simulate rest of the season" (`run-bar.ts:~64`) |
    | Spelling | "Randomize grid" (`LineupChanges.tsx:~43`) in a British-spelling app |
    | Capitals | "Drivers' Championship" / "Drivers' champion" / "drivers' title" |

## 5. Code health

No visible change.

- **`a11y-names`** (PROPOSED)
  - Flags are named by ISO code: `title={nationality}` gives "GB" (`DriverName.tsx:~82`, `Flag.tsx:~45`, and about ten more).
  - `CompactStandings` and `CareerStatistics` record cards have no header row.
  - No `scope` is set on any header cell.
  - Fix: country names for flags, and visually hidden header rows.
- **`small-duplicates`** (PROPOSED)
  - `plural()` is defined in `SeasonView.tsx:~54` and again in `SeasonOverview.tsx:~26`, next to `count()` in `lib/history.ts`.
  - More pluralisation is written by hand as ternaries.
  - `NAME_TARGET` and `HISTORY_TARGET` differ by `min-w-0`.
  - `SETTING_SELECT_CLASS` is retyped in `SeasonGrid.tsx:~507`.
  - The redundant `font-mono` next to `tabular-nums` appears in `StandingsEvolution.tsx`.
- **`yes-no-setting`** (PROPOSED)
  - `EngineSuppliersSetting`, `LiveriesSetting`, `TeamNamesSetting` and `CareerEventsSetting` are the same component, differing in name, key and note.
  - Fix: one `YesNoSetting` driven by a table, in the shape `settings-answer-polarity` settled.
- **`expandable-row`** (OPEN)
  - The expanded-row markup is pasted four times.
  - The behaviour differs: one row open at a time in the standings, calendar and roll of honour (`StandingsTable.tsx:~91`, `SeasonCalendar.tsx:~225`, `EraChampions.tsx:~184`); many at once in careers and records (`PersonPages.tsx:~131`, `CareerStatistics.tsx:~247`).
  - Decide one behaviour, then make one `ExpandableRow`.
- **`split-season-grid`** (PROPOSED)
  - `SeasonGrid.tsx` is about 1065 lines. Its team card and popover are about 260 lines inline in `entries.map` (`~801-1060`).
  - `ChassisStepper` closures are created per rating per card, and `byTeam` / the `Map` / the `Set` (`~698-706`) are rebuilt every render.
  - Fix: extract `TeamCard`, and memoise the lookups.

---

## Verification for every item

- `pnpm typecheck`, `pnpm lint`, `pnpm test`. Read the `Test Files` line, not just `Tests`.
- A test states the rule over synthetic data, never an authored rating or a seed's outcome. Mutation-check it.
- Screenshots of only the step the item names, in one variant (`.claude/rules/screenshots.md`). Width or theme only when the item is about width or theme.
- Move the rule the item settles into its `web-*.md` file, then delete the item here.
