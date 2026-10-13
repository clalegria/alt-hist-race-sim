# Design: the timing tower makeover

The whole web app restyled as a pit wall's timing screens, with a racetrack along the foot
of Home and the chequer laid as a diagonal sash. Chosen by the author from mockups on
2026-10-13.

**The reference is `docs/design/ui-makeover-mockup.html`**: open it in a browser. It shows
Home and a race result, on a 1280px desktop browser and a 390px phone, in both themes. Match
its look; its CSS is a sketch, not code to copy. The app builds the look from its own tokens
and components, and the mockup's colour values are where step 1 starts.

- **Take one step per chat, top to bottom**, by its id (for example, do
  `makeover-type-and-palette`). Each step ships on its own; old and new styles side by side
  between steps is expected.
- **Settle the OPEN points below before the step that needs them.** That chat starts by
  asking.
- When a step is built, its lasting rules move to the owning `.claude/rules/web-*.md` and
  the step is deleted here. The last step deletes this file and the mockup.
- **DECIDED**: the author's choice. **PROPOSED**: confirm before building it if it changes
  what the reader sees. **OPEN**: the author settles it first.

## The look

- DECIDED: **keep what the tables already have**: the circular sash badges, flags, the 1×
  car in every row, IBM Plex Mono on every figure, header bands darker than their panel,
  the home star, the wet pill, and the one accent meaning "won the thing on screen".
- DECIDED: **change the frame around them**:
  - Archivo's narrow width, set in capitals by CSS, for headings, names, nav and buttons;
  - small labels in mono capitals;
  - square corners, panels drawn by their border, full-width rows with alternating fills;
  - a cooler graphite palette in both themes, keeping the teal accent.
- DECIDED: **Home is a timing tower**: a narrow-capitals hero beside the modes as a tower
  of rows, the run in progress as a live session, and a racetrack along the foot.
- DECIDED: **the chequer stays, as a diagonal sash** at the livery badge's angle, in place
  of the texture over the whole background.
- Not chosen: the arcade, race programme, livery tiles and year dial directions, and the
  chequer in a corner.

## Settle first

- **`phone-nav`** (OPEN; settle before `makeover-top-nav`)
  - The mockup scrolls the nav sideways as one row of tabs.
  - `ui-review.md` (`top-nav-wrap`) and `publish.md` decided a menu.
  - Pick one, and correct the other docs.
- **`phone-classification`** (OPEN; settle before `makeover-race-page`)
  - The mockup's phone row: position, badge, flag, short name, car, gap. A retirement shows
    as DNF or DNQ in the gap column. Grid, Status and Pts are hidden.
  - `ui-review.md` (`classification-sideways-scroll`) proposed the opposite: drop Grid, Gap
    and the car, and keep Pts, with the status under the name.
- **`wordmark`** (OPEN; settle before `makeover-top-nav`)
  - The mockup's nav reads "ALT-HIST" beside the chequered mark, with Home as a tab.
  - The app has no name on screen today (its `<title>` is "Racing history simulator").
  - Keep "Home" as the mark's label, or pick a name.
- **`parade-and-track`** (OPEN; settle before `makeover-home-track`)
  - PROPOSED: the track becomes the parade's road. The parade keeps its cars, formations
    and hidden game, but drives on the track instead of over the page.
  - The alternative: both stay, with the parade still crossing the page above the track.
- **`mode-titles`** (OPEN; settle before `makeover-home`)
  - The mockup shortens "Simulate an era (basic version)" to "Simulate an era", and the
    advanced one to "Era · advanced".
  - This is the "Era mode" row of `one-name-per-thing` in `ui-review.md`.
- **`ui-review-overlap`** (PROPOSED)
  - The makeover redraws what some `ui-review.md` items are about: `disabled-treatment`,
    `ui-primitives`, `segmented-controls`, `page-heading`, `link-focus-ring`,
    `run-menu-destructive`, `top-nav-wrap` and `classification-sideways-scroll`.
  - Fold each into the step that touches its files, and delete it from `ui-review.md` when
    that step lands. *Sort the UI review* then sorts what is left.

## Steps

### 1. `makeover-type-and-palette`
- **Fonts**: import `@fontsource-variable/archivo/standard.css` (weight and width) in place
  of `wght.css` in `main.tsx`. Add one utility for the narrow width in `index.css`.
- **Palette**: give both themes' `--color-*` tokens the mockup's graphite values (its
  `.d-tower` block). Keep every token name, so components follow without edits.
  - Re-measure primary and destructive at 4.5:1 under their foreground, and as text on the
    card and on the header, in both themes (`web-styling.md`).
  - Rewrite each token's comment.
- **Corners**: square through the `--radius-*` tokens. Badges and flags keep their shapes.
- **Capitals by CSS only** (`uppercase`), never in the source text: tests and the
  screenshot steps find elements by their text.
- Screenshots: `menu`, `race`, `season-midseason`, `grid`, in both themes at one width.

### 2. `makeover-sash`
- Mask `body::before`'s texture to one diagonal band at the badge's 135°, in both themes.
  It stays fixed while the page scrolls, as now.
- PROPOSED: tints a little stronger than today's, since the band fades out (the mockup's
  `--chq-*`).
- The parade's behind-the-page layer must still paint over the texture (`web-team-car.md`).
- Screenshots: `menu`, `race`, in both themes.

### 3. `makeover-panels-and-tables`
- `ui/card.tsx` and `ui/table.tsx`:
  - square panels drawn by their border, with the header band kept;
  - rows in two alternating fills, and column heads in small mono capitals;
  - the position cell drawn as a block, filled with the accent on the accented row.
- Still one accented row per view (`lib/highlight.ts`). Keep the substring contract
  between the standout and podium classes (`web-display.md`).
- The classification still wraps rather than scrolls (`web-display.md`).
- Screenshots: `race`, `season-midseason`, `grid`, on desktop and phone.

### 4. `makeover-controls`
- `ui/button.tsx`: square, narrow capitals, the primary filled with the accent.
- Every segmented control becomes one bordered group with the chosen segment filled:
  `SessionNav`, the season tabs in `SeasonOverview`, `SettingSegments`, `SortToggle` and
  `YearPicker`. This takes in `segmented-controls` from `ui-review.md` if it is kept.
- Disabled means `text-subtle`, never opacity (`disabled-treatment`).
- Screenshots: `race`, `season-setup`, `grid`.

### 5. `makeover-names`
- `DriverName` in tables and the race sidebar: first name regular, SURNAME in bold narrow
  capitals. Prose and page headings keep plain names.
- `FittedName`'s short form follows ("N. PIQUET"); it measures the new widths itself.
- `TeamName` in the constructors' sidebar: narrow capitals. The team line under a driver
  stays plain.
- Tests count flags by counting `<svg>` (`web-names.md`).
- Screenshots: `race`, `season-midseason`, `driver-page`.

### 6. `makeover-top-nav`
- `TopNav.tsx`:
  - the header band;
  - the areas as narrow-capital tabs, with an accent underline on `aria-current`;
  - unbuilt areas in `text-subtle`;
  - a square theme toggle.
- The mark's label follows `wordmark`, the phone form follows `phone-nav`. It keeps
  `PARADE_COVER`.
- Screenshots: `menu`, on desktop and phone.

### 7. `makeover-run-bar`
- `RunBar.tsx`:
  - the crumb in mono capitals behind a live dot;
  - under it, the season as one segment per round, done or to come;
  - square buttons, with Continue in the accent.
- The phone keeps its ⋯ form.
- The segments' numbers come from `lib/run-bar.ts` (`runBarFor` decides, `RunBar` draws).
  Add the round and the season's round count there, with a test.
- PROPOSED: none done at the grid, all done at the summary.
- Screenshots: `grid`, `race`, `season-summary`, on desktop and phone.

### 8. `makeover-home`
- `MainMenu.tsx`:
  - The hero: eyebrow, narrow-capitals title, lede, and a row of facts: how many seasons,
    the first year and the last. The facts come from `authoredSeasons`, never written down
    (`web-app.md`).
  - The modes as a tower: a stripe, the title, a one-line blurb and a READY or SOON chip.
    Titles follow `mode-titles`.
  - Two columns on desktop, one on a phone.
- `ResumeRun.tsx`: the run as a live session.
  - A live-dot label, the run's title, the cursor line, the round segments from step 7,
    and Resume and Exit run.
  - PROPOSED: the car shown is the current leader's team.
  - `RunNotResumed` is restyled to match.
- Both keep `PARADE_COVER`. `MainMenu` still renders through `renderToStaticMarkup`.
- Screenshots: `menu`, `home-resume`, on desktop and phone, in both themes.

### 9. `makeover-home-track`
- A track along the foot of Home:
  - a verge, kerbs, and tarmac with a dashed line;
  - a chequered start/finish line labelled S/F;
  - cars from several decades lapping in two lanes at different paces, so they overtake.
- On desktop it sits at the bottom of the window, above the footer: Home's main column
  grows to push it there. On a phone it comes after the modes.
- The cars are `LiveryCar` at the large size, with turning wheels. They are picked the
  parade's way (`lib/parade.ts`, `Math.random()` passed in, never the world). How the track
  and the parade share the screen follows `parade-and-track`.
- With reduced motion, the cars stand still, spread along the track.
- The logic (picks, lanes, paces) lives in `lib/` with tests; the component gets a smoke
  test. Rules go to `web-team-car.md`.
- Screenshots: `menu`, on desktop and phone. Screenshots run with reduced motion, so the
  cars are still.

### 10. `makeover-race-page`
- The race header: the flag and the name in narrow capitals, the wet pill in mono capitals,
  and the sub-line in mono.
- `RaceClassification`:
  - Desktop columns as in the mockup: position block, badge, name with flag and team, car,
    grid, gap, status, points.
  - A retirement in `text-loss`.
  - The phone row follows `phone-classification`.
- `CompactStandings`: the sidebar as small towers, with "Show all" as a mono foot.
- `QualifyingResults` matches.
- Screenshots: `qualifying`, `race`, `round-menu`, on desktop and phone.

### 11. `makeover-season-pages`
- `SeasonOverview` (the champion cards and the tabs), `SeasonStandings`, `StandingsTable`,
  `SeasonCalendar`, `TitleBanner`.
- The charts' frame (`StandingsEvolution`); the lines are unchanged (`web-charts.md`).
- Screenshots: `season-midseason`, `season-calendar`, `season-summary`.

### 12. `makeover-grid`
- `SeasonGrid`'s team cards (square, with the livery corner kept), `GridStage`,
  `ReserveList`, `LineupChanges`, and the grid editor and its popovers.
- Screenshots: `grid`, `grid-editor`, `grid-editor-team`, `grid-edited`.

### 13. `makeover-era-and-people`
- `EraChampions`, `CareerStatistics`, `PersonPages`, `RosterIndex`, `NotReached`.
- Screenshots: `era-champions`, `career-panel`, `driver-page`, `team-page`,
  `drivers-index`, `not-reached`.

### 14. `makeover-setup-and-dialogs`
- `SeasonPicker`, `RunSettingsDialog`, `RunSettingsLine`, `RunDialogs`, `SiteFooter`.
- The rest of `components/ui/`: dialog, alert dialog, popover and dropdown menu.
- Screenshots: `season-setup`, `season-settings`, `era-setup`, `exit-dialog`,
  `clear-edits-dialog`.

### 15. `makeover-wrap-up`
- Take every screenshot step at both widths and in both themes, and fix what was missed.
- Delete this file, the mockup and the roadmap item. Drop `!docs/design/*.html` from
  `biome.json` if no other mockup is left.

## Verification for every step

- `pnpm typecheck`, `pnpm lint`, `pnpm test`. Read the `Test Files` line, not just `Tests`.
- A test that asserted a class string this step changed is rewritten to the new rule,
  never deleted.
- Screenshots of the steps named, beside the mockup (`.claude/rules/screenshots.md`).
- Move the step's lasting rules into its `web-*.md`, then delete the step here.
