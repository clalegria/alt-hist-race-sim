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

## 1. Small bugs

Each is a small, sure commit.

- **`randomized-grid-clear-edits`** (OPEN; found by the author)
  - With *Who drives where* set to "Randomize grid", the grid shows "This grid was edited" (`SeasonGrid.tsx:~940`). Arguably wrong: it is a setting, not an edit.
  - Worse, Clear all edits then does nothing. Likely cause: it nulls only lineup, cars, ratings and trends (`GridStage.tsx:~226`), never the arrangement, which comes from the settings.
  - The author settles first: does an arrangement count as an edit, and if so, does clearing reset the setting?
  - Screenshot step: `era-grid`.
- **`qualifying-gap-overflow`** (PROPOSED)
  - A qualifying gap over a minute ("+1:17.230s", 10 characters) overflows its `w-[9ch]` box (`QualifyingResults.tsx:~83`).
  - `formatSeconds` (`lib/format.ts:~18`) also writes "s" after an m:ss time.
  - Fix: write "+1:17.230" past a minute, and size the box to fit it.
  - Screenshot step: `qualifying` (needs a year with big gaps).
- **`record-card-raw-id`** (PROPOSED)
  - A record card's chevron label falls back to `record.id`, such as "toleman" (`CareerStatistics.tsx:~193`).
  - Fix: use the driver's or team's name.
  - Screenshot step: `era-champions`.
- **`development-minus-sign`** (PROPOSED)
  - In-season development prints "-3" with a hyphen-minus (`SeasonGrid.tsx:~265`), while the stepper's delta uses `signed()` (`LineupChanges.tsx:~182`), a real "−".
  - Fix: use `signed()` in both.
  - Screenshot step: `era-grid-team`.
- **`chart-labels-collide`** (PROPOSED; a bug at every width, and the start of `chart-phone`)
  - In `StandingsEvolution.tsx`:
    - End-of-line labels move apart only for exactly equal totals (`~256-263`), so lines a point apart overlap, as 1985 drivers 3 and 4 do in the screenshot.
    - Labels move only downward with `margin.bottom` 0, so one can be clipped.
    - Axis ticks can land on odd steps (0/45/90/135).
  - Fix: separate labels by a line height in both directions, and round the tick steps.
  - Screenshot step: `era-summary`.
- **`fitted-name-menu-flip`** (OPEN; investigate first)
  - With the round ▾ menu open, the race page's championship sidebar flips from "Nelson Piquet" to "N. Piquet". Without the menu it does not.
  - Likely cause: the Radix scroll lock changes the width `FittedName` measures.
  - Fix: confirm the cause, then measure past it or ignore the lock's resize.
  - Screenshot steps: `race` vs `round-menu`.
- **`parade-tooltip-key`** (PROPOSED)
  - The parade tooltip keys its lines by text (`HomeParade.tsx:~290`).
  - Two teams with one name in one year (2011 has two "Lotus") give the same key twice.
  - Fix: key by index and text together.
  - Screenshot step: `menu`.
- **`stale-history-comment`** (PROPOSED)
  - `SeasonHistory.tsx:~203` says nothing in the panel wears a badge or a flag, but the heading draws a flag (`~227`).
  - Fix: correct the comment.

## 2. Finding your way

Page structure, navigation, and the phone screens after the two in tier 1.

- **`location-said-thrice`** (PROPOSED)
  - The run's position is repeated:
    - The grid shows the crumbs "1984 › Grid", the line "1984 · Grid" under them, and "1984 · Grid" again at the page foot.
    - A Not reached page has four ways back to the run: Back to run, the "Run is at…" link, the body link, and the foot copy.
  - Fix: show the sub-line under the crumbs only when away from the cursor ("Run is at …"), and drop the position text from the foot (`App.tsx:~191`).
  - Screenshot steps: `grid`, `not-reached`.
- **`title-only-reasons`** (PROPOSED; *Phone layout*)
  - Some reasons live only in a `title` tooltip, which a touch screen never shows:
    - why Continue is disabled ("Apply or cancel the grid edit first");
    - why Back to setup is locked (`BackToSetup`, `RunSettingsLine.tsx:~69`);
    - "Not available yet" on the nav (`TopNav.tsx:~49`) and the footer (`SiteFooter.tsx:~27`);
    - the movement arrows in the sidebar standings (`CompactStandings.tsx:~36`).
  - Fix: visible small text, or sr-only text plus a visible cue.
  - Screenshot step: `season-summary --phone`.
- **`settings-dialog-phone`** (PROPOSED; *Phone layout*)
  - On a phone the run settings dialog scrolls as a whole: the title scrolls away and Cancel/Done sit below the fold.
  - Fix: pin the header and footer, and scroll only the body.
  - Screenshot step: `era-setup --phone`.
- **`grid-editor-pool-phone`** (PROPOSED; *Phone layout*)
  - The "Without a drive" pool is a sticky sidebar only from `lg` (`GridStage.tsx:~225`). On a phone it sits below about fifteen team cards, so filling one seat means scrolling the whole page and back.
  - Fix: a bottom sheet, or a sticky "Pick a driver" bar.
  - Screenshot step: `grid-editor --phone`.
- **`raced-grid-unreachable`** (PROPOSED)
  - Once raced, a grid page ("This grid has been raced, so it can no longer be changed.") has no link pointing to it. Only browser Back or a typed URL reaches it.
  - The season page's Grid tab (`lib/season-tabs.ts:~20`) shows the grid inside the season page instead.
  - Fix: either link the raced grid page from somewhere visible, or retire it in favour of the tab. Decide which.
  - Screenshot step: `grid-raced`.
- **`future-person-redirect`** (PROPOSED)
  - An unreached season gets a "Not reached yet" page, but a driver or team only on a future grid is silently redirected to the index (`lib/roster-places.ts:~117`).
  - Fix: use `NotReached` for both.
  - Screenshot step: `not-reached`.
- **`era-sections-discoverability`** (OPEN)
  - In an era, the drivers and teams pages are reached only through a 16px caret on the "Era" crumb, plus two small "All drivers →" / "All teams →" links.
  - Proposed: a visible section row on the era pages, Champions · Drivers · Teams, drawn like the season page's tabs.
  - Screenshot steps: `sections-menu`, `era-champions`.
- **`era-end-dead-end`** (PROPOSED; after `one-year-run-dead-end`)
  - An era that reaches the last authored year says "That's the last season there is, so the era ends here." (`EraChampions.tsx:~338`) and offers nothing.
  - Fix: give it the same way on.
  - Screenshot step: none; needs a run ending at 2026.
- **`chart-phone`** (OPEN; *Phone layout* calls it unsolved)
  - On a phone the legend wraps each name over two lines, and the round labels crowd the axis.
  - What the chart should become at 390px is still open: fewer series, a one-column legend, or a different chart.
  - Builds on `chart-labels-collide`.
  - Screenshot step: `season-summary --phone`.

## 3. One way to draw each thing

Visual consistency. The first three settle how a name is drawn, which later items lean on.

- **`entry-vs-team-name`** (PROPOSED)
  - The same season reads "McLaren-TAG Porsche" in the standings but "McLaren" in the career popover and the history panel.
  - Affected: `SeasonHistory.tsx:~297`, `LineupChanges.tsx:~260`.
  - Rule: a row about one season uses `entryName`; a row across seasons (record cards, the roster) uses the plain team name.
  - Fix: apply the rule, and write it into `web-names.md`.
  - Screenshot steps: `career-panel`, `driver-page`.
- **`team-mark-order`** (PROPOSED)
  - Grid cards and their popovers draw the flag, then the team badge (`SeasonGrid.tsx:~846,870`). Every other table draws the badge, then the flag (`TeamName.tsx:~32`).
  - Fix: make grid cards match, and fix the comment at `SeasonGrid.tsx:~862`.
  - Screenshot step: `grid`.
- **`names-outside-shared-components`** (PROPOSED)
  - These places draw a name by hand instead of through `DriverName`/`TeamName`:
    - `RosterIndex.tsx:~144`
    - `SeasonOverview.tsx:~106,124` (champion cards)
    - `QualifyingResults.tsx:~63`
    - the grid popover header (`SeasonGrid.tsx:~426`)
  - The team page's lineup line has no flags at all (`PersonPages.tsx:~377-390`), which breaks the flag rule in `web-names.md`. Its `pl-6` also differs from `TEAM_LINE`'s `pl-[1.625rem]`.
  - Fix: route them through the shared pair.
  - Screenshot steps: `team-page`, `drivers-index`.
- **`position-format`** (PROPOSED)
  - Person pages put ordinals ("1st", with "after round 1" under it) in a Pos column (`PersonPages.tsx:~206`). Every other Pos column is a plain number.
  - Words inside `tabular-nums` also render in the mono face: "after round 5", "winner", "pole".
  - Fix:
    - plain numbers in Pos columns, ordinals only in prose;
    - keep words out of `tabular-nums` spans;
    - one column order: Pts · Wins · Podiums · Poles. The roster puts Pts last; race-by-race puts Grid before Pos while the classification does the reverse.
  - Screenshot steps: `driver-page`, `team-page`, `drivers-index`.
- **`zero-points`** (PROPOSED)
  - Zero points is shown four ways:
    - blank in the race tables (`RaceClassification.tsx:~179`, `RaceByRace.tsx:~121`);
    - dim "0" in the standings and roster;
    - plain "0" on the person pages (`PersonPages.tsx:~214`) and in the roll of honour wins (`EraChampions.tsx:~97`);
    - left out of prose.
  - Fix: dim "0" in every table, blank only in a single race's Pts column.
  - Screenshot steps: `driver-page`, `season-midseason`.
- **`weather-badge-forms`** (PROPOSED)
  - The race page says "Wet 72%"; the calendar says "72%".
  - Fix: one form everywhere, and say what the percentage means in fan words.
  - Screenshot steps: `race`, `season-calendar`.
- **`rating-chip-accent`** (OPEN)
  - The overall chip turns teal at 85 and above (`SeasonGrid.tsx:~224`, also the reserve pool at `ReserveList.tsx:~246`), so a grid shows a dozen teal chips.
  - The accent is reserved for "won the thing on screen" (`lib/highlight.ts`). The open-seats notice's `border-primary/50 bg-primary/5` (`SeasonGrid.tsx:~744`) is the same clash.
  - The thresholds are also unexplained colour bands.
  - Proposed: weight or ink steps instead of the accent.
  - Screenshot step: `grid`.
- **`arbitrary-text-sizes`** (PROPOSED; what is left of `ui-primitives`)
  - `text-[0.5rem]` on the movement arrows (`CompactStandings.tsx:~38`) and
    `text-[0.65rem]` on the luck slider's ticks (`RandomnessSlider.tsx:~148`).
  - Fix: a size from the scale, or a comment on why neither fits one.

Tightening the timing tower look, against `docs/style/timing-tower.md` and its mockup:

- **`one-spelling-per-voice`** (PROPOSED)
  - Display and control capitals are spelled by hand in about a dozen places (`PageHeading`, `MainMenu`, `ui/card`, `ui/dialog`, `TitleBanner`, `ResumeRun`, `SeasonCalendar`, `CareerStatistics`, `TopNav`, `TabLinks`, `ui/button`, `ui/dropdown-menu`), with tracking that drifts between none, `0.01em` and `wide`.
  - Mono labels come in three sizes and two trackings: `MONO_LABEL` at 11px, table heads, breadcrumbs and `PageHeading`'s sub-line at `text-xs`.
  - Fix: `DISPLAY_CAPS` and `CONTROL_CAPS` beside `MONO_LABEL` and `TIMING_NAME`; two label sizes at most, one tracking. Then a voice is tweaked in one line.
  - Screenshot steps: `menu`, `race`, `season-summary`.
- **`given-name-narrow`** (PROPOSED)
  - The mockup sets the given name a little narrower and heavier than body text (80% width, medium), so it reads as part of the name. The app draws it at full width, and on a phone the race page wraps long names onto two lines.
  - Fix: in `SplitName` only.
  - Screenshot steps: `race --phone`, `season-summary`.
- **`popover-head-band`** (PROPOSED)
  - Panels and dialogs have a darker head band; the popovers (the career panel, the grid's rating popovers) have a title over a rule.
  - Fix: the band on every popover's heading, one shared piece in `ui/popover.tsx`.
  - Screenshot steps: `career-panel`, `grid-editor-team`.
- **`segmented-in-capitals`** (OPEN)
  - `web-styling.md` keeps choices (Sort A–Z / Rating, Start / End of the season) in sentence case and only tabs in capitals, so on one screen a toggle and a tab look like different kinds of control. The mockup's toggle is in capitals.
  - Screenshot steps: `grid`, `era-jump`.
- **`wet-pill-square`** (OPEN; with `weather-badge-forms`)
  - The wet pill is round by a choice made before the makeover (`WeatherBadge.tsx`); the mockup draws it square, like every other tag.
  - Screenshot step: `race`.
- **`chart-legend-names`** (PROPOSED)
  - The standings chart's legend names drivers in plain text; every table beside it uses timing names.
  - Screenshot step: `season-summary`.
- **`grid-popover-labels`** (PROPOSED)
  - In the grid's popovers, the rating names (Racing, Qualifying…) are body text while the section names above them are mono labels.
  - Fix: mono labels for the rating names, as a table's column heads are.
  - Screenshot step: `grid-editor-team`.

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
    | Clearing edits | "Clear all edits" / "Clear all grid edits?" / "Clear edits" |
    | Restarts | "Restart this season?" / "Restart the era?" |
    | Start buttons | "Start an era in 1984" (screen-reader label) / "Begin an era from 1984" (`SeasonPicker.tsx:~157`) |
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
