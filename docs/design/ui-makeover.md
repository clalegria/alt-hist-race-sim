# Design: the timing tower makeover

The whole web app restyled as a pit wall's timing screens, with a racetrack along the foot
of Home and the chequer laid as a diagonal sash. Chosen by the author from mockups on
2026-10-13.

**The reference is `docs/design/ui-makeover-mockup.html`**: open it in a browser. It shows
Home and a race result, on a 1280px desktop browser and a 390px phone, in both themes. Match
its look; its CSS is a sketch, not code to copy. The app builds the look from its own tokens
and components; the palette is already in `index.css`.

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

- **`ui-review-overlap`** (DECIDED)
  - The makeover redraws what some `ui-review.md` items are about: `ui-primitives`,
    `page-heading`, `link-focus-ring`, `run-menu-destructive` and
    `classification-sideways-scroll`.
  - Fold each into the step that touches its files, and delete it from `ui-review.md` when
    that step lands. *Sort the UI review* then sorts what is left.

## Steps

### 12. `makeover-grid`
- `SeasonGrid`'s team cards (square, livery corner kept, names in `split`), `GridStage`,
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
