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

- **DECIDED**: the author's decision.
- **PROPOSED**: a suggested fix. Confirm with the author before building it if it changes what the reader sees.
- **OPEN**: unresolved. The author settles it first, so the chat that takes it starts by asking.

---

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
  - Fix: one `YesNoSetting` driven by a table, worded as the Copy rule in `web-run-settings.md` says.
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
