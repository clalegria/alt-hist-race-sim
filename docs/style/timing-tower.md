# The timing tower look

The app is drawn as a pit wall's timing screens. This file and its mockup are kept, not
deleted when built: they are the reference a later tweak is checked against, so the app
stays one design. The rules that bind code live in `.claude/rules/web-*.md`. This file says
what the look is for, and which component owns each part of it.

**The mockup is `docs/style/timing-tower-mockup.html`**: open it in a browser. It shows
Home and a race result at 1280px and on a 390px phone, in both themes. Match its look, not
its CSS: the app builds the look from its own tokens (`index.css`) and components.

## The idea

- **The tables were already the app's character**, and the makeover made them the model
  for everything else: square panels drawn by their border, a head band darker than the
  panel, full-width rows with alternating fills, figures in mono.
- **Two faces, five voices.** Archivo (with its width axis) and IBM Plex Mono, nothing
  else. Each piece of text is one of the voices below, and looks the same on every screen.
- **One accent, teal, means "won the thing on screen"**: pole, the winner, a champion.
  Red means a loss or something about to be thrown away. Any other hue names a fact (wet,
  home) and comes with a glyph.
- **Graphite, cool, in both themes**; dark is the default.
- **Racing marks carry the colour**: the circular sash badge, the flag, the small car in
  every row. The chequer is one diagonal sash across the window, at the badge's angle.
- **Home is a timing tower**: a narrow-capitals hero beside the modes as rows, the run in
  progress as a live session, and a racetrack with the parade along the foot.

## The five voices

| Voice | Looks like | Used for | Owned by |
|---|---|---|---|
| Display capitals | narrow, extrabold, uppercase | page titles, the Home hero, panel and dialog titles, the title banner | `PageHeading`, `CardTitle`/`CardBand`, `DIALOG_TITLE`, `MainMenu` |
| Control capitals | narrow, bold, uppercase, a little tracking | buttons, nav, tabs, menu items | `ui/button`, `TopNav`, `Tabs`, `ui/dropdown-menu` |
| Timing names | narrow extrabold capitals | a name that stands alone in a table cell: a driver's surname (`SplitName`, given name plain), a team's whole name; a popover's title | `TIMING_NAME`, through `DriverName` and `TeamName` |
| Mono labels | Plex Mono, small, uppercase, wide tracking | column heads, band labels, kickers, breadcrumbs, statuses like READY | `MONO_LABEL`, `TableHead`, `PageHeading`'s sub-line |
| Figures | Plex Mono, tabular | every number | the `tabular-nums` class |

Everything else is body text: Archivo at full width, sentence case. That includes the team
line under a driver, a name inside a sentence, and settings captions.

- **Prose names stay plain**: "Alain Prost", "last with McLaren". A heading in capitals
  takes its case from the heading.
- **Capitals are CSS, never the text**, so tests and screen readers see the real name.

## Surfaces

- **A panel**: a border, a head band (`CardHeader`/`CardBand`, `--color-card-header`), then
  striped full-width rows. Square corners everywhere, through the radius tokens.
- **A dialog is a panel**: band, body, footer.
- **The position block**: the rank in mono on a band-coloured square at the row's start.
  The winner's block is filled teal; second and third have a teal number.
- **Round things are deliberate exceptions**: the livery badge, the live-session dot, the
  wet pill.

## Changing the look

- Change a voice in its owner, not at a call site, and look at the mockup first: if the
  change moves away from it, say so and update this file.
- Proposed tweaks are items in `docs/design/ui-review.md` (section 3), sorted with the rest.
